# DATA_INTEGRATION_TECHNICAL.md

## 1. Origine dati

~~Query SPARQL per i Contenuti (storico)~~

L'approccio attuale usa l'API MediaWiki/Wikidata (action=query + Cirrus search) con vincoli `haswbstatement:P31=Q11424` (film) e `haswbstatement:P10` (video su Commons), più fallback `wbsearchentities` per coprire casi mancanti. I claim letti includono P10 (video), P18 (poster), P1173 (sottotitoli) e P577 (anno).

Schema di massima della chiamata:

```
action=query&list=search&srsearch="<query> haswbstatement:P10 haswbstatement:P31=Q11424"
→ ids → wbgetentities (labels, descriptions, claims P10/P18/P1173/P577)
```

## 2. Sistema di Cache Locale (Client-Side)

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