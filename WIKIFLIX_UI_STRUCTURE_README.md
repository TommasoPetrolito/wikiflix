# Wikiflix WebApp - Content & Category Reference

Questo documento descrive la gerarchia delle categorie e i contenuti da mostrare nella WebApp Wikiflix, basandosi sulla struttura del portale originale. Utilizza queste informazioni per generare i componenti della galleria (Rows) e mappare le query di Wikidata.

## 1. Hero Section (Featured Content)

- **Film in primo piano:** *Banana da Terra* (1939).
- **Dettagli visualizzati:** Titolo, cast principale (Oscarito, Paulo Netto, Linda Baptista), e pulsante di riproduzione.

---

## 2. Categorie Principali (Rows Generiche)

### Recently Edited (Aggiornati di recente)

- *Banana da Terra*.
- *Trouble at Melody Mess*.
- *Doomsday for Pests*.

### Highly Ranked (Per numero di articoli Wikipedia)

- *Rudolph the Red-Nosed Reindeer*.
- *Battleship Potemkin*.
- *It's a Wonderful Life*.
- *Metropolis*.

### Most Viewed Movies (Più visti)

- *A Trip to the Moon*.
- *Battleship Potemkin*.
- *Nosferatu*.

### Female Directors (Registe donne)

- *Citizenfour* (Laura Poitras).
- *Mabel's Strange Predicament*.
- *The Adventures of Prince Achmed* (Lotte Reiniger).

---

## 3. Categorie Geografiche (Country Rows)

- **Spanish (Spagna):** *The Stranger*, *Salt of the Earth*, *The Hitch-Hiker*.
- **United Kingdom (UK):** *Roundhay Garden Scene*, *Jungle Book*, *The Lodger*.
- **Australia:** *The Story of the Kelly Gang*, *Shine*, *Lightning Jack*.
- **Canada:** *Back to God's Country*, *Nell Shipman* films, *The Pyx*.
- **Brazil (Brasile):** *Limite*, *Banana da Terra*, *Lábios Sem Beijos*.
- **Germany (Germania):** *Nosferatu*, *Metropolis*, *The Cabinet of Dr. Caligari*, *M*.

---

## 4. Categorie per Genere e Tematica

### Animated Cartoon (Animazione classica)

- *The Skeleton Dance*.
- *Steamboat Willie*.
- *Springtime*.
- *Gertie the Dinosaur*.

### Thriller / Horror

- *Night of the Living Dead*.
- *Carnival of Souls*.
- *The Terror*.
- *House on Haunted Hill*.

### Science Fiction (Fantascienza)

- *Metropolis*.
- *A Trip to the Moon*.
- *Plan 9 from Outer Space*.

### LGBT-Related Film

- *Morocco*.
- *Glen or Glenda*.
- *Different from the Others*.

### Children's Film (Bambini)

- *Peter Pan*.
- *Thomas and the Magic Railroad*.
- *Duck and Cover*.

### Romantic Comedy

- *It's a Wonderful Life*.
- *The Gold Rush*.
- *Charade*.
- *His Girl Friday*.

---

## 5. Note Tecniche per lo Sviluppo

- Formato card: Immagine poster 2:3 o miniatura video con titolo overlay.
- Metadati richiesti: Titolo originale, anno di uscita, lingua, e link al file video su Wikimedia Commons.
- Sorgente dati: query MediaWiki statement-based (P31=Q11424 + P10, poster P18, sottotitoli P1173) con adattatore client-side per il mapping nelle righe tematiche.
- Navigazione: Implementare uno scorrimento orizzontale per ogni categoria (Row) e una pagina di dettaglio per ogni film.
