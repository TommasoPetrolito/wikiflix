"""
Build a static catalog from Wikidata/Wikipedia and generate an ANN index for client-side search.

Outputs (default: data/catalog/):
- catalog.jsonl : one JSON object per line with Content-like fields
- embeddings.f32: float32 binary matrix (row-major) aligned with catalog order
- hnsw.index    : HNSW index (cosine) over normalized embeddings
- ids.txt       : one id per line, matching catalog/embedding order
- manifest.json : metadata about model, files, dimensions

Suggested model: intfloat/multilingual-e5-small (multilingual, 384-dim).
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence

import numpy as np
import requests
import hnswlib
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
DEFAULT_QUERY = r"""
SELECT 
  ?item ?itemLabel ?itemDescription ?year 
  ?directorID ?image 
  ?commonsVideo ?youtubeID ?vimeoID ?libreflixID ?iaID 
  ?instanceIDs ?genreIDs ?licenseIDs ?languageIDs ?countryIDs
WHERE {
  {
    SELECT ?item 
           (SAMPLE(YEAR(?pubDate)) AS ?year)
           (SAMPLE(?poster) AS ?image)
           (SAMPLE(?commons) AS ?commonsVideo) 
           (SAMPLE(?youtube) AS ?youtubeID) 
           (SAMPLE(?vimeo) AS ?vimeoID) 
           (SAMPLE(?libreflix) AS ?libreflixID) 
           (SAMPLE(?ia) AS ?iaID)
           (SAMPLE(?dir) AS ?directorID)
           (GROUP_CONCAT(DISTINCT ?instanceOf; separator=",") AS ?instanceIDs)
           (GROUP_CONCAT(DISTINCT ?genre; separator=",") AS ?genreIDs)
           (GROUP_CONCAT(DISTINCT ?license; separator=",") AS ?licenseIDs)
           (GROUP_CONCAT(DISTINCT ?language; separator=",") AS ?languageIDs)
           (GROUP_CONCAT(DISTINCT ?country; separator=",") AS ?countryIDs)
    WHERE {
      ?item wdt:P31/wdt:P279* wd:Q11424 .
      {
        { ?item wdt:P6216 wd:Q19652 . } UNION
        { ?item wdt:P10 ?commons . } UNION
        { ?item wdt:P577 ?pubDate . FILTER(YEAR(?pubDate) < 1926) }
      }
      {
        { ?item wdt:P10 ?commons . } UNION
        { ?item wdt:P1651 ?youtube . } UNION
        { ?item wdt:P4015 ?vimeo . } UNION
        { ?item wdt:P6614 ?libreflix . } UNION
        { ?item wdt:P724 ?ia . }
      }
      OPTIONAL { ?item wdt:P31 ?instanceOf . }
      OPTIONAL { ?item wdt:P136 ?genre . }
      OPTIONAL { ?item wdt:P275 ?license . }
      OPTIONAL { ?item wdt:P364 ?language . }
      OPTIONAL { ?item wdt:P495 ?country . }
      OPTIONAL { ?item wdt:P57 ?dir . }
      OPTIONAL { ?item wdt:P18 ?poster . }
      OPTIONAL { ?item wdt:P577 ?pubDate . }
      MINUS { ?item wdt:P31 wd:Q97570383 }
      MINUS { ?item p:P10/pq:P3831 wd:Q622550 }
    }
    GROUP BY ?item
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,es,pt,it,nl,da,sv,no,sl,sk,cz,bg,hu,po,pl,ru". }
}
ORDER BY ?item
"""

HEADERS = {
    "User-Agent": "wikiflix-catalog-builder/0.1 (https://github.com/)",
}


@dataclass
class CatalogItem:
    id: str
    title: str
    description: str
    description_long: str
    year: Optional[int]
    poster: Optional[str]
    backdrop: Optional[str]
    video_url: Optional[str]
    alt_videos: List[Dict]
    directors: List[str]
    countries: List[str]
    genres: List[str]
    license: Optional[str]
    language: Optional[str]


def fetch_sparql(query: str, endpoint: str = WIKIDATA_SPARQL, timeout: int = 60) -> List[dict]:
    res = requests.post(
        endpoint,
        data={"query": query, "format": "json"},
        headers=HEADERS,
        timeout=timeout,
    )
    res.raise_for_status()
    data = res.json()
    return data.get("results", {}).get("bindings", [])


def split_ids(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [v for v in value.split(",") if v]


def commons_to_filepath(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if "Special:FilePath" in url:
        return url
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{requests.utils.quote(pathlib.Path(url).name)}"


def collect_label_ids(rows: List[dict]) -> List[str]:
    ids: set[str] = set()
    for r in rows:
        for key in ("directorID", "genreIDs", "licenseIDs", "languageIDs", "countryIDs"):
            val = r.get(key, {}).get("value")
            if key.endswith("IDs"):
                ids.update(split_ids(val))
            else:
                if val:
                    ids.add(val)
    return [i for i in ids if i.startswith("Q")]


def fetch_labels(ids: Sequence[str], languages: str = "en|it") -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not ids:
        return out
    chunk_size = 200
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i : i + chunk_size]
        url = f"{WIKIDATA_API}?action=wbgetentities&format=json&languages={languages}&props=labels&ids={'|'.join(chunk)}"
        res = requests.get(url, headers=HEADERS, timeout=60)
        if not res.ok:
            continue
        data = res.json().get("entities", {})
        for qid, entity in data.items():
            labels = entity.get("labels", {})
            label = labels.get("it", {}).get("value") or labels.get("en", {}).get("value")
            if not label and labels:
                label = next(iter(labels.values())).get("value")
            if label:
                out[qid] = label
    return out


def binding_val(b: dict, key: str) -> Optional[str]:
    return b.get(key, {}).get("value")


def build_catalog(rows: List[dict], labels: Dict[str, str]) -> List[CatalogItem]:
    items: List[CatalogItem] = []
    for r in rows:
        qid = binding_val(r, "item")
        title = binding_val(r, "itemLabel")
        if not qid or not title:
            continue
        desc = binding_val(r, "itemDescription") or ""
        year_raw = binding_val(r, "year")
        year = int(year_raw) if year_raw and year_raw.isdigit() else None
        poster = commons_to_filepath(binding_val(r, "image"))

        commons = commons_to_filepath(binding_val(r, "commonsVideo"))
        youtube = binding_val(r, "youtubeID")
        vimeo = binding_val(r, "vimeoID")
        libreflix = binding_val(r, "libreflixID")
        ia = binding_val(r, "iaID")

        video_url = commons or (libreflix and f"https://libreflix.org/assistir/{libreflix}") or None
        alt_videos: List[Dict] = []
        if commons:
            alt_videos.append({"kind": "commons", "url": commons})
        if youtube:
            alt_videos.append({"kind": "youtube", "url": f"https://www.youtube.com/watch?v={youtube}", "label": "YouTube"})
        if vimeo:
            alt_videos.append({"kind": "vimeo", "url": f"https://vimeo.com/{vimeo}", "label": "Vimeo"})
        if libreflix:
            alt_videos.append({"kind": "libreflix", "url": f"https://libreflix.org/assistir/{libreflix}", "label": "Libreflix"})
        if ia:
            alt_videos.append({"kind": "archive", "url": f"https://archive.org/details/{ia}", "label": "Internet Archive"})

        directors = [labels.get(d) for d in split_ids(binding_val(r, "directorID")) if labels.get(d)]
        countries = [labels.get(c) for c in split_ids(binding_val(r, "countryIDs")) if labels.get(c)]
        genres = [labels.get(g) for g in split_ids(binding_val(r, "genreIDs")) if labels.get(g)]
        license_label = None
        license_ids = split_ids(binding_val(r, "licenseIDs"))
        for lid in license_ids:
            if labels.get(lid):
                license_label = labels[lid]
                break
        language_label = None
        language_ids = split_ids(binding_val(r, "languageIDs"))
        for lang_id in language_ids:
            if labels.get(lang_id):
                language_label = labels[lang_id]
                break

        items.append(
            CatalogItem(
                id=qid,
                title=title,
                description=desc,
                description_long=desc,
                year=year,
                poster=poster,
                backdrop=poster,
                video_url=video_url,
                alt_videos=alt_videos,
                directors=directors,
                countries=countries,
                genres=genres,
                license=license_label,
                language=language_label,
            )
        )
    return items


def to_jsonl(items: Iterable[CatalogItem], path: pathlib.Path) -> None:
    with path.open("w", encoding="utf-8") as f:
        for it in items:
            obj = {
                "id": it.id,
                "wikidataId": it.id,
                "title": it.title,
                "description": it.description,
                "descriptionLong": it.description_long,
                "type": "movie",
                "year": it.year,
                "poster": it.poster,
                "backdrop": it.backdrop,
                "videoUrl": it.video_url,
                "altVideos": it.alt_videos or None,
                "directors": it.directors or None,
                "countries": it.countries or None,
                "genres": it.genres or None,
                "license": it.license,
                "language": it.language,
            }
            f.write(json.dumps({k: v for k, v in obj.items() if v is not None}, ensure_ascii=False) + "\n")


def build_embeddings(items: Sequence[CatalogItem], model_name: str, batch_size: int = 64, device: str = "cpu") -> np.ndarray:
    model = SentenceTransformer(model_name, device=device)
    texts = []
    for it in items:
        parts = [it.title]
        if it.description_long:
            parts.append(it.description_long)
        elif it.description:
            parts.append(it.description)
        texts.append(". ".join(parts))
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    return np.asarray(embeddings, dtype=np.float32)


def save_embeddings(bin_path: pathlib.Path, embeddings: np.ndarray) -> None:
    bin_path.write_bytes(embeddings.tobytes(order="C"))


def build_hnsw(index_path: pathlib.Path, embeddings: np.ndarray, m: int = 32, ef_construction: int = 200) -> None:
    dim = embeddings.shape[1]
    index = hnswlib.Index(space="cosine", dim=dim)
    index.init_index(max_elements=embeddings.shape[0], ef_construction=ef_construction, M=m)
    index.add_items(embeddings, np.arange(embeddings.shape[0]))
    index.save_index(str(index_path))


def write_ids(ids_path: pathlib.Path, items: Sequence[CatalogItem]) -> None:
    with ids_path.open("w", encoding="utf-8") as f:
        for it in items:
            f.write(f"{it.id}\n")


def write_manifest(manifest_path: pathlib.Path, model: str, dim: int, catalog: str, embeddings: str, index: str, ids: str) -> None:
    manifest = {
        "model": model,
        "dim": dim,
        "metric": "cosine",
        "catalog": catalog,
        "embeddings": embeddings,
        "index": index,
        "ids": ids,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build static catalog and ANN index from Wikidata")
    parser.add_argument("--out", type=pathlib.Path, default=pathlib.Path("data/catalog"), help="Output directory")
    parser.add_argument("--query", type=pathlib.Path, help="Path to SPARQL query file (defaults to built-in)")
    parser.add_argument("--endpoint", default=WIKIDATA_SPARQL, help="SPARQL endpoint")
    parser.add_argument("--model", default="intfloat/multilingual-e5-small", help="SentenceTransformer model")
    parser.add_argument("--batch", type=int, default=64, help="Embedding batch size")
    parser.add_argument("--device", default="cpu", help="Embedding device")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    query_text = DEFAULT_QUERY
    if args.query:
        query_text = args.query.read_text(encoding="utf-8")

    print("Fetching SPARQL results…")
    rows = fetch_sparql(query_text, endpoint=args.endpoint)
    print(f"Rows fetched: {len(rows)}")
    if not rows:
        print("No data returned; aborting", file=sys.stderr)
        return 1

    label_ids = collect_label_ids(rows)
    print(f"Fetching labels for {len(label_ids)} ids…")
    labels = fetch_labels(label_ids)

    catalog_items = build_catalog(rows, labels)
    catalog_path = args.out / "catalog.jsonl"
    to_jsonl(catalog_items, catalog_path)
    print(f"Wrote catalog: {catalog_path} ({len(catalog_items)} items)")

    print("Building embeddings…")
    embeddings = build_embeddings(catalog_items, model_name=args.model, batch_size=args.batch, device=args.device)
    emb_path = args.out / "embeddings.f32"
    save_embeddings(emb_path, embeddings)
    print(f"Saved embeddings: {emb_path} shape={embeddings.shape}")

    print("Building HNSW index…")
    index_path = args.out / "hnsw.index"
    build_hnsw(index_path, embeddings)
    print(f"Saved HNSW index: {index_path}")

    ids_path = args.out / "ids.txt"
    write_ids(ids_path, catalog_items)

    manifest_path = args.out / "manifest.json"
    write_manifest(
        manifest_path,
        model=args.model,
        dim=embeddings.shape[1],
        catalog=catalog_path.name,
        embeddings=emb_path.name,
        index=index_path.name,
        ids=ids_path.name,
    )
    print(f"Saved manifest: {manifest_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
