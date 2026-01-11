import json
import subprocess
import os
import threading
import sys
import shutil
from difflib import SequenceMatcher
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import re

# --- CONFIGURAZIONE ---
INPUT_FILE = "C:/Users/petro/Downloads/wikiflix/public/catalog/catalog.jsonl"
OUTPUT_FILE = "youtube_validation_list.jsonl"
TOTAL_RECORDS = 4634
MAX_WORKERS = 32  # NON ESAGERARE: Se metti 20, YouTube ti banna l'IP temporaneamente. 5-8 è safe.

# Lock fondamentale per evitare che i thread scrivano uno sopra l'altro
# Ma qui lo usiamo per APRIRE-SCRIVERE-CHIUDERE in sicurezza.
write_lock = threading.Lock()


# FULL_MOVIE_DICT = {
#     "en": {"short": "full movie", "long": "full movie"},
#     "es": {"short": "película completa", "long": "película completa"},
#     "it": {"short": "film completo", "long": "film completo"},
#     "fr": {"short": "film complet", "long": "film complet"},
#     "de": {"short": "ganzer film", "long": "ganzer film"},
#     "ru": {"short": "полный фильм", "long": "полный фильм"},
# }

FULL_MOVIE_DICT = {
    "en": {"short": "full movie", "long": "full movie in English"},
    "es": {"short": "película completa", "long": "película completa en Español"},
    "fr": {"short": "film complet", "long": "film complet en français"},
    "de": {"short": "ganzer film", "long": "ganzer film auf Deutsch"},
    "it": {"short": "film completo", "long": "film completo in Italiano"},
    "pt": {"short": "filme completo", "long": "filme completo em português"},
    "ru": {"short": "полный фильм", "long": "полный фильм на русском"},
    "zh": {"short": "完整电影", "long": "完整版电影中文"},
    "ja": {"short": "フルムービー", "long": "日本語フルムービー"},
    "ko": {"short": "전체 영화", "long": "한국어 전체 영화"},
    "ar": {"short": "فيلم كامل", "long": "فيلم كامل بالعربية"},
    "hi": {"short": "पूरी film", "long": "पूरी film हिंदी में"},
    "bn": {"short": "पूर्ण চলচ্চিত্র", "long": "বাংলা পূর্ণ চলচ্চিত্র"},
    "tr": {"short": "tam film", "long": "Türkçe tam film"},
    "nl": {"short": "volledige film", "long": "volledige film in het Nederlands"},
    "sv": {"short": "hela filmen", "long": "hela filmen på svenska"},
    "pl": {"short": "cały film", "long": "cały film po polsku"},
    "uk": {"short": "повний фільм", "long": "повний фільм українською"},
    "cs": {"short": "celý film", "long": "celý film česky"},
    "ro": {"short": "film complet", "long": "film complet în română"},
    "el": {"short": "ολόκληρη ταινία", "long": "ολόκληρη ταινία στα ελληνικά"},
    "he": {"short": "סרט מלא", "long": "סרט מלא בעברית"},
    "id": {"short": "film lengkap", "long": "film lengkap bahasa Indonesia"},
    "vi": {"short": "phim đầy đủ", "long": "phim thuyết minh tiếng Việt"},
    "th": {"short": "หนังเต็มเรื่อง", "long": "หนังเต็มเรื่อง พากย์ไทย"},
    "fa": {"short": "فیلم کامل", "long": "فیلم کامل فارسی"},
    "bg": {"short": "целият филм", "long": "целият филм na български"},
    "hr": {"short": "cijeli film", "long": "cijeli film na hrvatskom"},
    "da": {"short": "hele filmen", "long": "hele filmen på dansk"},
    "et": {"short": "täispikk film", "long": "täispikk film eesti keeles"},
    "fi": {"short": "koko elokuva", "long": "koko elokuva suomeksi"},
    "hu": {"short": "teljes film", "long": "teljes film magyarul"},
    "ga": {"short": "scannán iomlán", "long": "scannán iomlán i nGaeilge"},
    "lv": {"short": "pilna filma", "long": "pilna filma latviešu valodā"},
    "lt": {"short": "pilnas filmas", "long": "pilnas filmas lietuvių kalba"},
    "mt": {"short": "film sħiħ", "long": "film sħiħ bil-Malti"},
    "sk": {"short": "celý film", "long": "celý film slovensky"},
    "sl": {"short": "cel film", "long": "cel film v slovenščini"}
}

langs = [k for k in FULL_MOVIE_DICT.keys()]

# Coda thread-safe per comunicare tra worker e scrittore


# --- FUNZIONI DI UTILITÀ (Invariate) ---

def clean_title_tokens(text):
    text = str(text).lower()
    text = re.sub(r'\b(18|19|20)\d{2}\b', '', text)
    junk_words = {
        "full", "movie", "film", "complete", "completo", "entiero", "ganzer", 
        "hd", "hq", "4k", "1080p", "official", "trailer", "clip", "eng", "ita", "sub"
    }
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return set(word for word in text.split() if word not in junk_words and len(word) > 1)

def extract_year_from_title(text):
    match = re.search(r'\b(18|19|20)\d{2}\b', str(text))
    return int(match.group(0)) if match else None

def sophisticated_similarity(original_title, target_year, yt_title, yt_duration, target_duration):
    if target_duration > 0 and yt_duration > 0:
        ratio = yt_duration / target_duration
        if ratio < 0.7 or ratio > 1.3:
            return 0.0

    yt_year_in_title = extract_year_from_title(yt_title)
    if yt_year_in_title and target_year:
        if abs(yt_year_in_title - int(target_year)) > 1:
            return 0.1

    orig_tokens = clean_title_tokens(original_title)
    yt_tokens = clean_title_tokens(yt_title)
    
    if not orig_tokens: return 0.0
    
    common = orig_tokens.intersection(yt_tokens)
    token_score = len(common) / len(orig_tokens)
    
    clean_orig = " ".join(sorted(list(orig_tokens)))
    clean_yt = " ".join(sorted(list(yt_tokens)))
    seq_score = SequenceMatcher(None, clean_orig, clean_yt).ratio()
    
    return round((token_score * 0.7) + (seq_score * 0.3), 2)

def get_search_title(movie, lang):
    labels = movie.get("titleLabels", {})
    return labels.get(lang, labels.get("en", movie.get("title", "")))

def search_youtube(title, year, target_duration, lang, modality):
    # Forziamo "full movie" per trovare più risultati anche per film russi/cinesi

    search_query = f"ytsearch3:{title} {year} {FULL_MOVIE_DICT[lang][modality]}"
    
    # Niente filtri, niente flat-playlist: scarichiamo i metadati completi
    cmd = [
        "yt-dlp", "--dump-json", 
        "--no-warnings",
        search_query
    ]
    
    results = []
    try:
        # Encoding utf-8 è vitale per non perdere i dati su Windows
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.DEVNULL, 
            text=True, 
            encoding="utf-8", 
            errors="replace"
        )
        stdout, _ = process.communicate(timeout=45) 
        
        for line in stdout.splitlines():
            if not line: continue
            try:
                v = json.loads(line)
                
                # --- FIX DATA DEFINITIVO ---
                # Prende "20181031" e lo trasforma in "2018-10-31"
                raw_date = str(v.get("upload_date", "")).strip()
                
                fmt_date = ""
                # Controllo rigoroso: deve essere di 8 caratteri e solo numeri
                if len(raw_date) == 8 and raw_date.isdigit():
                    fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
                
                results.append({
                    "yt_id": v.get("id"),
                    "yt_title": v.get("title"),
                    "channel_name": v.get("uploader"),
                    "channel_id": v.get("channel_id"),
                    "duration": v.get("duration"),
                    "upload_date": fmt_date
                })
            except Exception:
                continue
    except Exception: 
        pass
    return results

def save_entry_immediately(entry):
    with write_lock:
        f = open(OUTPUT_FILE, "a", encoding="utf-8")
        try:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            f.flush()            # Svuota buffer Python
            os.fsync(f.fileno()) # Svuota buffer Windows su Disco
        finally:
            f.close()

# --- LOGICA DEL SINGOLO WORKER ---
def process_single_movie(line):
    """Questa funzione viene eseguita in parallelo da un thread"""
    try:
        movie = json.loads(line)
        # print(f"[LOG] Processing movie: {movie.get('title', '')} ({movie.get('year', '')})")

        qid = movie.get("id")
        original_title = movie.get("title", "")
        year = movie.get("year", "")
        # target_dur = movie.get("durationSeconds", 0)
        raw_year = movie.get("year")
        try:
            year = int(raw_year) if raw_year else None
        except ValueError:
            year = None

        try:
            target_dur = float(movie.get("durationSeconds", 0) or 0)
        except ValueError:
            target_dur = 0
        lang_code = movie.get("language", "en")

        candidates = []
        titles_searched = set()
        scores = set()
        for lg in langs:
            title_search = get_search_title(movie, lg)
            titles_searched.add(title_search)
            for modality in ["short", "long"]:
                # print(f"[LOG] Searching YouTube for: '{title_search}' ({year}) [{lg}/{modality}] dur={target_dur}")
                results = search_youtube(title_search, year, target_dur, lg, modality)
                #print(f"[LOG] Found {len(results)} results for '{title_search}' [{lg}/{modality}]")
                for i, result in enumerate(results):
                    results[i]["score"] = sophisticated_similarity(f"{title_search}", year, result["yt_title"], result["duration"], target_dur) 
                candidates.extend(results)

        # Deduplica
        seen = set()
        unique = []
        for c in candidates:
            if c["yt_id"] not in seen:
                unique.append(c)
                seen.add(c["yt_id"])

        unique.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        for c in unique:

            # --- NUOVO FILTRO DURATA (+/- 30%) ---
            yt_dur = c.get("duration", 0)
            
            # Applichiamo il filtro SOLO se abbiamo un target valido da Wikidata
            if target_dur > 0 and yt_dur > 0:
                ratio = yt_dur / target_dur
                
                # Se il video è più corto del 70% (0.7) o più lungo del 130% (1.3)
                # Esempio: Film da 100min -> accetta solo video tra 70min e 130min
                if ratio < 0.7 or ratio > 1.3:
                    continue  # Salta questo candidato e passa al prossimo
            
            entry = {
                "qid": qid,
                "original_title": original_title,
                "target_year": year,
                "found_title": c["yt_title"],
                "found_id": c["yt_id"],
                "found_duration": c["duration"],
                "found_channel_id": c["channel_id"],
                "found_channel_name": c["channel_name"],
                "found_upload_date": c["upload_date"],
                "preview_url": f"https://www.youtube.com/watch?v={c['yt_id']}",
                "point_in_time": datetime.now().strftime("%Y-%m-%d"),
                "score": c["score"]
            }
            if c["score"] > 0.65:
                # print(f"[LOG] Entry ready to save: {entry} with score: {score}")
                save_entry_immediately(entry)

        if unique:
            return original_title, unique[0]["yt_title"], f"https://www.youtube.com/watch?v={unique[0]['yt_id']}"
        else:
            # print(f"[LOG] No YouTube results for: {original_title}")
            return None

    except Exception as e:
        print(f"[ERROR] Exception in process_single_movie: {e}")
        return None

# --- MAIN LOOP ---

# --- MAIN ---
def main():
    # Check yt-dlp
    if not shutil.which("yt-dlp"):
        print("❌ ERRORE: yt-dlp non trovato nel PATH.")
        return

    print(f"📂 Carico {INPUT_FILE}...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        lines = [line for line in f if line.strip()]

    print(f"🚀 Avvio scansione su {len(lines)} film con {MAX_WORKERS} thread.")
    print(f"💾 I risultati verranno scritti in: {OUTPUT_FILE} (controllalo pure durante l'esecuzione!)")

    found_count = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_single_movie, line): line for line in lines}

        # Barra di progresso
        pbar = tqdm(as_completed(futures), total=len(lines), unit="film")

        for future in pbar:
            res = future.result()
            # print(f"[LOG] Future result: {res}")
            if res:
                found_count += 1
                # Aggiorniamo la descrizione della barra con il conteggio reale
                pbar.set_postfix({"Trovati": found_count})
                pbar.write(f"✅ {res[0]} -> {res[1]} ({res[2]})")

    print("\n🏁 Scansione terminata.")

if __name__ == "__main__":
    main()