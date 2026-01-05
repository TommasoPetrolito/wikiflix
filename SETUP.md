# Setup Guide

Istruzioni per avviare Wikiflix (frontend-only, fonti open).

## Prerequisiti

- Node.js 18 (vedi [.nvmrc](.nvmrc)).
- npm o pnpm.
- (Opzionale) Python 3.10+ se vuoi rigenerare il catalogo offline.

## Installazione

```bash
# Clona il repo
git clone <repo-url>
cd wikiflix

# Installa dipendenze frontend
npm install
```

## Avvio sviluppo

```bash
npm run dev
```

Apri http://localhost:5173.

## Build produzione

```bash
npm run build
npm run preview
```

## Generare il catalogo offline (opzionale)

```bash
python -m pip install -r tools/requirements.txt
python tools/build_catalog.py --out data/catalog --model intfloat/multilingual-e5-small --device cpu
```

Gli artifact (catalog.jsonl, embeddings.f32, hnsw.index, ids.txt, manifest.json) finiscono in `data/catalog/`.

## Note legali

L'app usa solo contenuti da fonti aperte (Wikimedia Commons, Libreflix, Vimeo, YouTube, Internet Archive). Verifica i diritti di ciascun asset prima di distribuirlo o pubblicarlo.

