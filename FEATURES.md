# 🎬 Wikiflix — Feature Set

## Core
- Catalogo open (Wikidata/Commons/Libreflix/Vimeo/YouTube/IA) con filtro dominio pubblico/pre-1926.
- Player con sorgenti alternative e embedding Vimeo/YouTube; Libreflix via slug `/assistir/`.
- Metadati ricchi: registi, paesi, generi, licenza, lingua, durata, poster; hero/player/info mostrano registi e paesi.
- Multilingua UI e metadati (preferenza lingua utente con fallback); selettore lingua in navbar/player/info.

## Ricerca (in corso)
- Catalogo statico JSONL + embedding multilingua (`multilingual-e5-small`).
- Indice ANN HNSW (cosine) per ricerca semantica offline.
- FTS client-side (MiniSearch/lunr) e fusione ANN/FTS programmata.

## Esperienza utente
- UI stile Netflix, responsive web-first; ottimizzabile per mobile/TV (focus nav).
- Pillole di durata/genere/lingua, badge registi e paesi in hero/player.
- Sottotitoli da Wikidata (P1173) e upload manuale locale nel player.

## Architettura
- Frontend-only (React + TS + Vite), nessun backend proprietario.
- Build offline del catalogo con [tools/build_catalog.py](tools/build_catalog.py); output statici pronti per deploy.
- Normalizzazione URL: Commons → Special:FilePath, YouTube watch, Vimeo id, Libreflix slug, Archive.org details.

## Sicurezza/Privacy
- Nessun account, nessun tracking; tutto locale lato client.
- Contenuti da fonti aperte: verificare sempre i diritti prima di redistribuire.

## Roadmap breve
- Integrare caricamento catalogo statico e worker di ricerca (ANN+FTS).
- Testare flussi lingua (preferita, fallback, default EN).
- Cache TTL per chiamate wiki lato client (se restano fetch live).

