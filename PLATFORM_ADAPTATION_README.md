### 4. `PLATFORM_ADAPTATION.md`

```markdown
# PLATFORM_ADAPTATION.md

## 1. Capacitor (Mobile)
* **Build:** Eseguire `npm run build` prima di ogni `npx cap copy`.
* **Splash Screen:** Configurare icone e splash screen per Android/iOS.

## 2. Smart TV UI
* **Navigazione:** Usare `react-tv-space-navigation` per gestire il focus delle card.
* **Keyboard Events:** Mappare `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` e `Enter`.
* **Focus State:** Ogni card deve avere uno stato visivo di "Highlight" (es: scale(1.1) e bordo colorato).



## 3. Performance su TV
* Disattivare le animazioni pesanti (blur, ombre dinamiche) se il dispositivo è lento.
* Usare immagini compresse per le anteprime delle Row.