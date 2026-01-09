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
from concurrent.futures import ThreadPoolExecutor, as_completed
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
        ?instanceIDs ?genreIDs ?licenseIDs ?languageIDs ?countryIDs ?durationAmount ?durationUnit ?durationRaw
WHERE {
  {
    SELECT ?item 
           (SAMPLE(YEAR(?pubDate)) AS ?year)
            (SAMPLE(?durationAmount) AS ?durationAmount)
            (SAMPLE(?durationUnit) AS ?durationUnit)
            (SAMPLE(?durationRaw) AS ?durationRaw)
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
                {
                    ?item p:P10 ?commonsStmt .
                    FILTER NOT EXISTS { ?commonsStmt pq:P3831 wd:Q622550 }
                    ?commonsStmt ps:P10 ?commons .
                } UNION
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
            OPTIONAL {
                ?item p:P2047 ?durationStatement .
                ?durationStatement psv:P2047 ?durationValue .
                ?durationValue wikibase:quantityAmount ?durationAmount .
                ?durationValue wikibase:quantityUnit ?durationUnit .
            }
            OPTIONAL { ?item wdt:P2047 ?durationRaw . }
    MINUS { ?item wdt:P31 wd:Q97570383 }
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


def log(msg: str) -> None:
    print(f"[build_catalog] {msg}")

LABEL_LANGS = [
    "en",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "ru",
    "zh",
    "ja",
    "ko",
    "ar",
    "hi",
    "bn",
    "tr",
    "nl",
    "sv",
    "pl",
    "uk",
    "cs",
    "ro",
    "el",
    "he",
    "id",
    "vi",
    "th",
    "fa",
    "bg",
    "hr",
    "da",
    "et",
    "fi",
    "hu",
    "ga",
    "lv",
    "lt",
    "mt",
    "sk",
    "sl",
]

DURATION_UNIT_FACTORS = {
    "http://www.wikidata.org/entity/Q11574": 1,  # second
    "http://www.wikidata.org/entity/Q7727": 60,  # minute
    "http://www.wikidata.org/entity/Q25235": 3600,  # hour
    "http://www.wikidata.org/entity/Q573": 86400,  # day
}


def to_qid(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if value.startswith("Q"):
        return value
    return pathlib.Path(value).name if "/" in value else value


def pick_label(label_map: Dict[str, str], preferred: Sequence[str] = LABEL_LANGS) -> Optional[str]:
    for lang in preferred:
        if label_map.get(lang):
            return label_map[lang]
    return next(iter(label_map.values()), None)


def shorten_text(text: str, sentences: int = 2) -> str:
    parts = text.split(". ")
    if len(parts) <= sentences:
        return text.strip()
    return ". ".join(parts[:sentences]).strip()


@dataclass
class CatalogItem:
    id: str
    title: str
    title_labels: Dict[str, str]
    description: str
    description_long: str
    descriptions: Dict[str, str]
    year: Optional[int]
    poster: Optional[str]
    backdrop: Optional[str]
    video_url: Optional[str]
    commons_link: Optional[str]
    wikipedia_url: Optional[str]
    alt_videos: List[Dict]
    director_ids: List[str]
    genre_ids: List[str]
    instance_ids: List[str]
    language_ids: List[str]
    country_ids: List[str]
    license_id: Optional[str]
    license: Optional[str]
    language: Optional[str]
    duration_seconds: Optional[int]


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
    out = []
    for v in value.split(","):
        qid = to_qid(v)
        if qid:
            out.append(qid)
    return out


def commons_to_filepath(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    name = pathlib.Path(url).name
    if not name:
        return None
    # Decode once in case the source string already contains %xx escapes, then re-encode safely.
    decoded = requests.utils.unquote(name)
    encoded = requests.utils.quote(decoded)
    if "Special:FilePath" in url:
        return f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}"
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{encoded}"


def commons_to_filepage(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        name = pathlib.Path(url).name
        if name:
            # Decode once to strip any existing % escapes, then re-encode exactly once to avoid %2520
            decoded = requests.utils.unquote(name)
            normalized = decoded.replace(" ", "_")
            encoded = requests.utils.quote(normalized)
            return f"https://commons.wikimedia.org/wiki/File:{encoded}"
    except Exception:
        return None
    return None


def load_labels_cache(path: pathlib.Path) -> Dict[str, Dict[str, str]]:
    if not path.exists():
        return {}
    cache: Dict[str, Dict[str, str]] = {}
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
                qid = row.get("id")
                labels = row.get("labels") or {}
                if qid and isinstance(labels, dict):
                    cache[qid] = {k: v for k, v in labels.items() if isinstance(v, str)}
            except Exception:
                continue
    return cache


def save_labels_cache(path: pathlib.Path, labels: Dict[str, Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for qid, label_map in labels.items():
            f.write(json.dumps({"id": qid, "labels": label_map}, ensure_ascii=False) + "\n")


def load_existing_summaries_from_catalog(path: pathlib.Path) -> Dict[str, Dict[str, str]]:
    if not path.exists():
        return {}
    summaries: Dict[str, Dict[str, str]] = {}
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
                qid = row.get("id")
                descs = row.get("descriptions") or {}
                if qid and isinstance(descs, dict) and descs:
                    summaries[qid] = {k: v for k, v in descs.items() if isinstance(v, str)}
            except Exception:
                continue
    return summaries


def collect_label_ids(rows: List[dict]) -> List[str]:
    ids: set[str] = set()
    for r in rows:
        for key in ("item", "directorID", "instanceIDs", "genreIDs", "licenseIDs", "languageIDs", "countryIDs"):
            val = r.get(key, {}).get("value")
            if not val:
                continue
            if key.endswith("IDs"):
                ids.update(split_ids(val))
            else:
                qid = to_qid(val)
                if qid:
                    ids.add(qid)
    return [i for i in ids if i.startswith("Q")]


def fetch_labels(ids: Sequence[str], languages: Sequence[str]) -> Dict[str, Dict[str, str]]:
    out: Dict[str, Dict[str, str]] = {}
    if not ids:
        return out
    chunk_size = 50  # Wikidata API limit for ids param when using wbgetentities
    langs_param = "|".join(languages)
    total_chunks = math.ceil(len(ids) / chunk_size)
    session = requests.Session()
    for i in tqdm(range(0, len(ids), chunk_size), total=total_chunks, desc="labels", unit="chunk"):
        chunk = ids[i : i + chunk_size]
        params = {
            "action": "wbgetentities",
            "format": "json",
            "languages": langs_param,
            "props": "labels",
            "ids": "|".join(chunk),
        }
        try:
            res = session.get(WIKIDATA_API, params=params, headers=HEADERS, timeout=60)
        except Exception as e:
            log(f"Label fetch failed (chunk {i//chunk_size+1}/{total_chunks}): {e}")
            continue
        if not res.ok:
            log(f"Label fetch HTTP {res.status_code} (chunk {i//chunk_size+1}/{total_chunks})")
            continue
        data = res.json()
        if "error" in data:
            log(f"Label fetch API error (chunk {i//chunk_size+1}/{total_chunks}): {data.get('error')}")
            continue
        entities = data.get("entities", {})
        for qid, entity in entities.items():
            labels = entity.get("labels", {})
            lang_map: Dict[str, str] = {}
            for lang in languages:
                val = labels.get(lang, {}).get("value")
                if val:
                    lang_map[lang] = val
            if lang_map:
                out[qid] = lang_map
    return out


def fetch_sitelinks(ids: Sequence[str], languages: Sequence[str]) -> Dict[str, Dict[str, str]]:
    out: Dict[str, Dict[str, str]] = {}
    if not ids:
        return out
    chunk_size = 50
    sites = [f"{lang}wiki" for lang in languages]
    sitefilter = "|".join(sites)
    total_chunks = math.ceil(len(ids) / chunk_size)
    for i in tqdm(range(0, len(ids), chunk_size), total=total_chunks, desc="sitelinks", unit="chunk"):
        chunk = ids[i : i + chunk_size]
        url = f"{WIKIDATA_API}?action=wbgetentities&format=json&props=sitelinks&ids={'|'.join(chunk)}&sitefilter={sitefilter}"
        res = requests.get(url, headers=HEADERS, timeout=60)
        if not res.ok:
            continue
        data = res.json().get("entities", {})
        for qid, entity in data.items():
            links = entity.get("sitelinks", {})
            lang_map: Dict[str, str] = {}
            for site, meta in links.items():
                if not site.endswith("wiki"):
                    continue
                lang = site.replace("wiki", "")
                if lang in languages and meta.get("title"):
                    lang_map[lang] = meta["title"]
            if lang_map:
                out[qid] = lang_map
    return out


def _fetch_wiki_extract(session: requests.Session, lang: str, title: str, exchars: int) -> Optional[str]:
    # Primary: query API with character cap and redirects
    url = f"https://{lang}.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "prop": "extracts",
        "explaintext": 1,
        "exchars": exchars,
        "redirects": 1,
        "format": "json",
        "titles": title,
    }
    res = session.get(url, params=params, headers=HEADERS, timeout=30)
    if res.ok:
        pages = res.json().get("query", {}).get("pages", {})
        page = next(iter(pages.values()), {})
        extract = page.get("extract")
        if extract:
            return extract.strip()

    # Fallback: REST summary endpoint (usually shorter intro)
    summary_url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}"
    res2 = session.get(summary_url, headers=HEADERS, timeout=20)
    if res2.ok:
        extract2 = res2.json().get("extract")
        if extract2:
            return str(extract2).strip()

    return None


def fetch_wikipedia_summaries(
    sitelinks: Dict[str, Dict[str, str]],
    languages: Sequence[str],
    exchars: int = 2600,
    base_summaries: Optional[Dict[str, Dict[str, str]]] = None,
) -> Dict[str, Dict[str, str]]:
    summaries: Dict[str, Dict[str, str]] = {
        qid: {**langs} for qid, langs in (base_summaries or {}).items()
    }
    session = requests.Session()

    tasks = []
    for qid, sites in sitelinks.items():
        for lang in languages:
            title = sites.get(lang)
            if not title:
                continue
            if lang in summaries.get(qid, {}):
                continue
            tasks.append((qid, lang, title))

    log(
        f"Fetching Wikipedia summaries: {len(tasks)} requests across {len(languages)} languages (threads=4, exchars={exchars})"
    )

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(
                lambda qid=qid, lang=lang, title=title: (
                    qid,
                    lang,
                    _fetch_wiki_extract(session, lang, title, exchars),
                )
            )
            for qid, lang, title in tasks
        ]

        with tqdm(total=len(futures), desc="wiki summaries", unit="req") as pbar:
            for future in as_completed(futures):
                try:
                    qid, lang, extract = future.result()
                    if extract:
                        summaries.setdefault(qid, {})[lang] = extract
                except Exception:
                    pass
                finally:
                    pbar.update(1)

    have_any = len(summaries)
    have_en = sum(1 for v in summaries.values() if "en" in v)
    log(f"Wikipedia summaries ready for {have_any} items (with EN: {have_en})")
    return summaries


def binding_val(b: dict, key: str) -> Optional[str]:
    return b.get(key, {}).get("value")


def normalize_duration_seconds(amount: Optional[str], unit: Optional[str], fallback_raw: Optional[str]) -> Optional[int]:
    """Normalize duration to seconds using unit if available, otherwise fall back to raw."""
    if amount and unit:
        try:
            factor = DURATION_UNIT_FACTORS.get(unit)
            if factor:
                return int(round(float(amount) * factor))
        except Exception:
            pass
    if fallback_raw:
        try:
            return int(float(fallback_raw))
        except Exception:
            return None
    return None


def build_catalog(
    rows: List[dict],
    labels: Dict[str, Dict[str, str]],
    sitelinks: Dict[str, Dict[str, str]],
    summaries: Dict[str, Dict[str, str]],
) -> List[CatalogItem]:
    items: List[CatalogItem] = []
    for r in rows:
        qid = to_qid(binding_val(r, "item"))
        if not qid:
            continue
        title_labels = labels.get(qid, {})
        title = pick_label(title_labels) or binding_val(r, "itemLabel")
        if not title:
            continue

        desc_label = binding_val(r, "itemDescription") or ""
        wiki_descs = summaries.get(qid, {})
        if desc_label and "en" not in wiki_descs:
            wiki_descs = {**wiki_descs, "en": desc_label}
        desc_long = wiki_descs.get("en") or desc_label
        desc_short = shorten_text(desc_long) if desc_long else desc_label
        descriptions = wiki_descs if wiki_descs else ({"en": desc_label} if desc_label else {})

        year_raw = binding_val(r, "year")
        year = int(year_raw) if year_raw and year_raw.isdigit() else None

        duration_amount = binding_val(r, "durationAmount")
        duration_unit = binding_val(r, "durationUnit")
        duration_raw = binding_val(r, "durationRaw")
        duration_seconds = normalize_duration_seconds(duration_amount, duration_unit, duration_raw)
        poster = commons_to_filepath(binding_val(r, "image"))

        commons_raw = binding_val(r, "commonsVideo")
        commons = commons_to_filepath(commons_raw)
        commons_link = commons_to_filepage(commons_raw)
        youtube = binding_val(r, "youtubeID")
        vimeo = binding_val(r, "vimeoID")
        libreflix = binding_val(r, "libreflixID")
        ia = binding_val(r, "iaID")

        video_url = commons or (libreflix and f"https://libreflix.org/i/{libreflix}") or None
        alt_videos: List[Dict] = []
        if commons:
            alt_videos.append({"kind": "commons", "url": commons})
        if youtube:
            alt_videos.append({"kind": "youtube", "url": f"https://www.youtube.com/watch?v={youtube}", "label": "YouTube"})
        if vimeo:
            alt_videos.append({"kind": "vimeo", "url": f"https://vimeo.com/{vimeo}", "label": "Vimeo"})
        if libreflix:
            alt_videos.append({"kind": "libreflix", "url": f"https://libreflix.org/i/{libreflix}", "label": "Libreflix"})
        if ia:
            alt_videos.append({"kind": "archive", "url": f"https://archive.org/details/{ia}", "label": "Internet Archive"})

        director_ids = split_ids(binding_val(r, "directorID"))
        genre_ids = split_ids(binding_val(r, "genreIDs"))
        instance_ids = split_ids(binding_val(r, "instanceIDs"))
        language_ids = split_ids(binding_val(r, "languageIDs"))
        country_ids = split_ids(binding_val(r, "countryIDs"))
        license_ids = split_ids(binding_val(r, "licenseIDs"))

        license_id = license_ids[0] if license_ids else None
        license_label = pick_label(labels.get(license_id, {})) if license_id else None
        language_label = pick_label(labels.get(language_ids[0], {})) if language_ids else None

        def pick_wikipedia_url() -> Optional[str]:
            sites = sitelinks.get(qid, {})
            for lang in LABEL_LANGS:
                title = sites.get(lang)
                if title:
                    return f"https://{lang}.wikipedia.org/wiki/{requests.utils.quote(title.replace(' ', '_'))}"
            if sites:
                lang, title = next(iter(sites.items()))
                return f"https://{lang}.wikipedia.org/wiki/{requests.utils.quote(title.replace(' ', '_'))}"
            return None

        wikipedia_url = pick_wikipedia_url()

        items.append(
            CatalogItem(
                id=qid,
                title=title,
                title_labels=title_labels,
                description=desc_short or desc_label,
                description_long=desc_long or desc_label,
                descriptions=descriptions,
                year=year,
                poster=poster,
                backdrop=poster,
                video_url=video_url,
                commons_link=commons_link,
                wikipedia_url=wikipedia_url,
                alt_videos=alt_videos,
                director_ids=director_ids,
                genre_ids=genre_ids,
                instance_ids=instance_ids,
                language_ids=language_ids,
                country_ids=country_ids,
                license_id=license_id,
                license=license_label,
                language=language_label,
                duration_seconds=duration_seconds,
            )
        )
    return items


def to_jsonl(items: Iterable[CatalogItem], labels: Dict[str, Dict[str, str]], path: pathlib.Path) -> None:
    def tag_entries(ids: List[str]) -> Optional[List[Dict]]:
        if not ids:
            return None
        entries = []
        for qid in ids:
            label_map = labels.get(qid, {})
            entries.append(
                {
                    "id": qid,
                    "label": pick_label(label_map),
                    "labels": label_map or None,
                }
            )
        return entries

    with path.open("w", encoding="utf-8") as f:
        for it in items:
            obj = {
                "id": it.id,
                "wikidataId": it.id,
                "title": it.title,
                "titleLabels": it.title_labels or None,
                "description": it.description,
                "descriptionLong": it.description_long,
                "descriptions": it.descriptions or None,
                "type": "movie",
                "year": it.year,
                "poster": it.poster,
                "backdrop": it.backdrop,
                "videoUrl": it.video_url,
                "commonsLink": it.commons_link,
                "wikipediaUrl": it.wikipedia_url,
                "altVideos": it.alt_videos or None,
                "directorIds": it.director_ids or None,
                "genreIds": it.genre_ids or None,
                "instanceIds": it.instance_ids or None,
                "languageIds": it.language_ids or None,
                "countryIds": it.country_ids or None,
                "directors": tag_entries(it.director_ids),
                "genres": tag_entries(it.genre_ids),
                "instances": tag_entries(it.instance_ids),
                "languages": tag_entries(it.language_ids),
                "countries": tag_entries(it.country_ids),
                "licenseId": it.license_id,
                "license": it.license,
                "licenseLabels": labels.get(it.license_id) if it.license_id else None,
                "language": it.language,
                "durationSeconds": it.duration_seconds,
            }
            f.write(json.dumps({k: v for k, v in obj.items() if v is not None}, ensure_ascii=False) + "\n")


def build_embeddings(items: Sequence[CatalogItem], model_name: str, batch_size: int = 64, device: str = "cpu") -> np.ndarray:
    model = SentenceTransformer(model_name, device=device)
    texts = []
    for it in items:
        parts = [it.title]
        en_desc = it.descriptions.get("en") if it.descriptions else None
        if en_desc:
            parts.append(en_desc)
        elif it.description_long:
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
    parser.add_argument(
        "--out",
        type=pathlib.Path,
        default=pathlib.Path("public/catalog"),
        help="Output directory (default: public/catalog for direct app consumption)",
    )
    parser.add_argument(
        "--catalog-input",
        type=pathlib.Path,
        default=None,
        help="Existing catalog file to reuse summaries from (optional; default is live fetch)",
    )
    parser.add_argument(
        "--labels-cache",
        type=pathlib.Path,
        default=pathlib.Path("data/catalog/labels_cache.jsonl"),
        help="JSONL cache of QID -> labels across languages",
    )
    parser.add_argument(
        "--basename",
        default="catalog",
        help="Base name for newly generated artifacts (catalog, embeddings, index, ids, manifest)",
    )
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

    log("Fetching SPARQL results…")
    rows = fetch_sparql(query_text, endpoint=args.endpoint)
    log(f"Rows fetched: {len(rows)}")
    if not rows:
        print("No data returned; aborting", file=sys.stderr)
        return 1

    label_ids = collect_label_ids(rows)
    cached_labels = load_labels_cache(args.labels_cache)
    missing_label_ids = [qid for qid in label_ids if qid not in cached_labels]
    log(
        f"Fetching labels for {len(missing_label_ids)} missing ids (cached={len(cached_labels)}) across {len(LABEL_LANGS)} languages…"
    )
    fresh_labels = fetch_labels(missing_label_ids, languages=LABEL_LANGS) if missing_label_ids else {}
    labels = {**cached_labels, **fresh_labels}
    save_labels_cache(args.labels_cache, labels)
    log(f"Labels ready: {len(labels)} ids (cache saved at {args.labels_cache})")

    item_ids = [qid for r in rows for qid in [to_qid(binding_val(r, "item"))] if qid]
    log(f"Fetching sitelinks for {len(item_ids)} items across {len(LABEL_LANGS)} languages…")
    sitelinks = fetch_sitelinks(item_ids, languages=LABEL_LANGS)
    log(f"Sitelinks fetched for {len(sitelinks)} items")

    base_summaries: Dict[str, Dict[str, str]] = {}
    if args.catalog_input:
        base_summaries = load_existing_summaries_from_catalog(args.catalog_input)
        if base_summaries:
            log(f"Reusing summaries from {args.catalog_input} for {len(base_summaries)} items")
        else:
            log(f"No summaries found at {args.catalog_input}; will fetch from Wikipedia")
    else:
        log("No catalog-input provided; fetching summaries from Wikipedia")
    log("Fetching Wikipedia summaries (multi)…")
    summaries = fetch_wikipedia_summaries(
        sitelinks, languages=LABEL_LANGS, exchars=2600, base_summaries=base_summaries
    )

    catalog_items = build_catalog(rows, labels, sitelinks, summaries)
    catalog_path = args.out / f"{args.basename}.jsonl"
    to_jsonl(catalog_items, labels, catalog_path)
    log(f"Wrote catalog: {catalog_path} ({len(catalog_items)} items)")

    log(f"Building embeddings (model={args.model}, batch={args.batch}, device={args.device})…")
    embeddings = build_embeddings(catalog_items, model_name=args.model, batch_size=args.batch, device=args.device)
    emb_path = args.out / f"{args.basename}_embeddings.f32"
    save_embeddings(emb_path, embeddings)
    log(f"Saved embeddings: {emb_path} shape={embeddings.shape}")

    log("Building HNSW index…")
    index_path = args.out / f"{args.basename}_hnsw.index"
    build_hnsw(index_path, embeddings)
    log(f"Saved HNSW index: {index_path}")

    ids_path = args.out / f"{args.basename}_ids.txt"
    write_ids(ids_path, catalog_items)

    manifest_path = args.out / f"{args.basename}_manifest.json"
    write_manifest(
        manifest_path,
        model=args.model,
        dim=embeddings.shape[1],
        catalog=catalog_path.name,
        embeddings=emb_path.name,
        index=index_path.name,
        ids=ids_path.name,
    )
    log(f"Saved manifest: {manifest_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
