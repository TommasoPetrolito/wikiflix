# ROADMAP_TODO.md

## Stato attuale
- [x] Cleanup TMDB/Flux e nuova documentazione Wikiflix.
- [x] Metadati arricchiti (registi, paesi, durata, generi) e sorgenti alternative (Commons/Libreflix/Vimeo/YouTube/IA).
- [x] Supporto lingua UI + preferenze + fallback.
- [x] Builder offline (SPARQL → catalogo JSONL + embedding + HNSW).

## Prossime attività
- [x] Integrare in client il caricamento del catalogo statico e ricerca locale.
- [ ] (Opz.) Worker di ricerca con fusione ANN/FTS e scoring combinato.
- [ ] Testare i flussi lingua (preferita, fallback, default EN).
- [ ] Cache TTL per eventuali chiamate wiki live rimaste (src/utils/cache.ts) o rimuoverle se non più necessarie.
- [ ] Preparare adattamenti mobile/TV (focus nav, safe areas, asset leggeri).