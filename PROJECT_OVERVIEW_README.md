# PROJECT_OVERVIEW.md

## 1. Visione del Progetto
Creare un'app di streaming "Netflix-style" basata su **Ennyw/flux**, alimentata esclusivamente da contenuti di pubblico dominio provenienti da **Wikidata** e **Wikimedia Commons**. L'app è totalmente **client-side**, senza server backend proprietario.

## 2. Stack Tecnologico
* **Frontend:** React + Vite + Tailwind CSS.
* **Data Source:** ~~Wikidata Query Service (SPARQL)~~ → MediaWiki/Wikidata API (Cirrus search P31=Q11424 + P10) con mapping client-side.
* **Video Engine:** HTML5 Standard Player (supporto .webm, .ogv, .mp4).
* **Caching:** LocalStorage per metadati e preferenze.
* **Piattaforme:** Web, Mobile (Capacitor), Smart TV (Spatial Navigation).

## 3. Filosofia Architetturale: Client-Side First
* **Zero Backend:** Le chiamate API e la trasformazione dei dati avvengono nel browser/app dell'utente.
* **Hybrid Content:** La UI è un clone di Netflix, ma i contenuti sono "Open" (Wikiflix).
* **Localizzazione:** Gestione di tracce audio e sottotitoli disponibili su Wikimedia Commons.



## 4. Istruzioni per l'IA (Copilot/Cursor)
> "Questo progetto è un clone di Netflix che usa esclusivamente API pubbliche (Wikidata). Non creare file di backend Node.js. Tutta la logica di fetching e caching deve risiedere in `src/services/`. Priorità assoluta alla velocità di caricamento tramite cache locale."