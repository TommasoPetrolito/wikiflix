# DATA_INTEGRATION_TECHNICAL.md

## 1. Origine dati

Pipeline attuale (solo build offline, nessuna chiamata live in runtime):

- SPARQL su Wikidata per estrarre film con almeno una fonte aperta (Commons/YouTube/Vimeo/Libreflix/IA) e attributi chiave (generi, istanze, registi, paesi, lingue, anno, poster).
- `wbgetentities` per labels/descriptions multilingua e normalizzazione ID.
- Normalizzazione URL: Commons → Special:FilePath, YouTube → watch, Vimeo → vimeo.com/{id}, Libreflix → /assistir/{slug}, IA → archive.org/details/{id}.
- Output: catalog JSONL + embeddings.f32 + hnsw.index + ids.txt + manifest.json, poi copiati in `public/catalog/` e caricati integralmente dal client.

## 2. Build offline del catalogo (GitHub Action)

Pipeline attuale (client-side only):

1) In CI/local: esegui `tools/build_catalog.py` che:
  - Lancia la SPARQL (vedi query sotto) sull'endpoint Wikidata e salva i binding.
  - Recupera le label dei Q-id con `wbgetentities` (registi, paesi, generi, licenze, lingue).
  - Normalizza le fonti video (Commons P10 → Special:FilePath, YouTube P1651 → watch, Vimeo P4015, Libreflix P6614 → /assistir/, IA P724 → details).
  - Scrive `data/catalog/catalog.jsonl` con i campi tipo `Content` (title, descrizioni, year, poster, altVideos, directors, countries, genres…).
  - Calcola embedding multilingua (default `intfloat/multilingual-e5-small`), salva `embeddings.f32` e un indice ANN HNSW `hnsw.index`, più `ids.txt` e `manifest.json`.

2) Deploy: copia gli artifact statici in `public/catalog/` (già referenziati dal loader client). Nessuna API key esterna.

3) Runtime: filtri strutturati e ricerca semantica/testuale sul catalogo in memoria; nessuna chiamata live a Wikidata/MediaWiki.

Comandi utili (CI):
```
python tools/build_catalog.py --out data/catalog \
  --model intfloat/multilingual-e5-small \
  --device cpu
```

Dipendenze: `pip install -r tools/requirements.txt` (requests, numpy, hnswlib, sentence-transformers, tqdm).

## 3. Sistema di Cache Locale (Client-Side)

Mappatura dei dati salvata in `localStorage` per evitare chiamate ripetitive.

*Nota:* il layer TTL in `src/utils/cache.ts` è ancora da implementare (vedi roadmap Fase 2.1) per rendere i bucket MediaWiki meno “chatty”.

```typescript
// Struttura Oggetto Cache
{
  "key": "movies_popular",
  "timestamp": 1704278400000,
  "data": [
    {
      "id": "Q123",
      "title": "Metropolis",
      "videoUrl": "[https://upload.wikimedia.org/](https://upload.wikimedia.org/)...",
      "poster": "https://...",
      "subs": "https://..."
    }
  ]
}

```

## 3. Gestione Sottotitoli (HTML5)

- L'adapter MediaWiki mappa P1173 in `Content.subtitles` e normalizza l'URL via `Special:FilePath`.
- Il player HTML5 aggiunge `<track>` per ogni traccia disponibile e imposta la prima come default.
- È presente un bottone "Carica sottotitoli (.vtt)" che consente l'upload locale (tramite `URL.createObjectURL`) per supplire alla mancanza di P1173.

## 4. Localizzazione UI

- Default: Italiano (se disponibile in Wikidata/MediaWiki labels).
- Fallback: Inglese.

```
```
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

```

Script: `tools/build_catalog.py`
- Output (default `data/catalog/`): `catalog.jsonl`, `embeddings.f32`, `hnsw.index`, `ids.txt`, `manifest.json`.
- Modello embedding default: `intfloat/multilingual-e5-small` (multilingua, 384-dim).
- Norme URL: Commons → Special:FilePath, YouTube → watch, Vimeo → vimeo.com/{id}, Libreflix → /assistir/{slug}, IA → archive.org/details/{id}.