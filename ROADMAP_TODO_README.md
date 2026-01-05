# ROADMAP_TODO.md

## 📅 Fase 1: Setup & Clean-up
- [x] Clonare `Ennyw/flux` e installare dipendenze.
- [x] Rimuovere logicamente l'integrazione TMDB (API Key e servizi correlati).

## 🔗 Fase 2: Motore Dati (Wikidata + Cache)
- [ ] **Fase 2.1: Cache Layer:** Implementare utility in `src/utils/cache.ts` per gestire `localStorage` con TTL (scadenza).
- [ ] **Fase 2.2: Wikidata Service:** Creare il servizio di fetch per film e documentari (oggi usiamo query MediaWiki statement-based + adattatore client-side).
- [ ] **Fase 2.3: Data Mapping:** Convertire i dati Wikidata nel formato richiesto dai componenti `Row` e `Banner` di Flux (parzialmente coperto dall'adapter attuale).

## 🎬 Fase 3: Video Player & Sottotitoli
- [x] **Fase 3.1: HTML5 Player:** Ottimizzare il player per i formati video di Wikimedia.
- [x] **Fase 3.2: Sottotitoli:** Implementare il supporto per file `.vtt` o `.srt` esterni (P1173 ingest e `<track>` automatico).
- [x] **Fase 3.3: Caricamento Manuale:** Aggiungere opzione per l'utente di caricare sottotitoli locali durante il play.



## 📱 Fase 4: Porting Mobile & TV
- [ ] Inizializzare **Capacitor** per iOS/Android.
- [ ] Implementare la **Spatial Navigation** per il controllo tramite telecomando/frecce tastiera.
- [ ] Ottimizzare la UI per "Safe Areas" su Smart TV.