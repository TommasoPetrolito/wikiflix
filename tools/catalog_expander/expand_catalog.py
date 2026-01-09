import json
import subprocess
from difflib import SequenceMatcher
from tqdm import tqdm  # Importante: installa con 'pip install tqdm'

# CONFIGURAZIONE
INPUT_FILE = "C:\Users\petro\Downloads\wikiflix\public\catalog\catalog.jsonl"
OUTPUT_FILE = "youtube_validation_list.jsonl"
TOTAL_RECORDS = 4634  # Il numero totale di righe nel tuo file

FULL_MOVIE_DICT = {
    "en": "full movie",
    "es": "película completa",
    "fr": "film complet",
    "de": "ganzer film",
    "it": "film completo",
    "pt": "filme completo",
    "ru": "полный фильм",
    "zh": "完整电影",
    "ja": "フルムービー",
    "ko": "전체 영화",
    "ar": "فيلم كامل",
    "hi": "पूरी फिल्म",
    "bn": "পূর্ণ চলচ্চিত্র",
    "tr": "tam film",
    "nl": "volledige film",
    "sv": "hela filmen",
    "pl": "cały film",
    "uk": "повний фільм",
    "cs": "celý film",
    "ro": "film complet",
    "el": "ολόκληρη ταινία",
    "he": "סרט מלא",
    "id": "film lengkap",
    "vi": "phim đầy đủ",
    "th": "หนังเต็มเรื่อง",
    "fa": "فیلم کامل",
    "bg": "целият филм",
    "hr": "cijeli film",
    "da": "hele filmen",
    "et": "täispikk film",
    "fi": "koko elokuva",
    "hu": "teljes film",
    "ga": "scannán iomlán",
    "lv": "pilna filma",
    "lt": "pilnas filmas",
    "mt": "film sħiħ",
    "sk": "celý film",
    "sl": "cel film"
}

langs = ["it"]

def get_search_title(movie, lang):
    """Sceglie il miglior titolo per la ricerca YouTube"""
    labels = movie.get("titleLabels", {})
    return labels.get(lang, movie.get("title", ""))

def search_youtube(title, year, target_duration):
    """Cerca su YouTube tramite yt-dlp"""
    search_query = f"ytsearch3:{title} {year} full movie"
    
    cmd = [
        "yt-dlp",
        "--dump-json",
        "--flat-playlist",
        # Tolleranza sulla durata: +/- 20%
        "--match-filter", f"duration > {target_duration * 0.8} & duration < {target_duration * 1.2}",
        search_query
    ]
    
    results = []
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        for line in process.stdout:
            v = json.loads(line)
            results.append({
                "yt_id": v.get("id"),
                "yt_title": v.get("title"),
                "channel": v.get("uploader"),
                "duration": v.get("duration")
            })
    except:
        pass
    return results

def similarity(a, b):
    return round(SequenceMatcher(None, str(a).lower(), str(b).lower()).ratio(), 2)

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f_in, \
         open(OUTPUT_FILE, "w", encoding="utf-8") as f_out:
        
        # Inizializziamo tqdm avvolgendo l'iteratore del file
        progress_bar = tqdm(f_in, total=TOTAL_RECORDS, desc="🚀 Analisi Wikiflix", unit="film")
        
        for line in progress_bar:
            
            movie = json.loads(line)
            for lang in langs:
                # Saltiamo se ha già un link YouTube negli altVideos
                # if any(v.get("kind") == "youtube" for v in movie.get("altVideos", [])):
                #     continue

                search_title = get_search_title(movie, lang)
                year = movie.get("year", "")
                target_dur = movie.get("durationSeconds", 0)
                
                # Usiamo progress_bar.set_postfix per mostrare il titolo corrente sulla barra
                progress_bar.set_postfix({"film": search_title[:20]})
                
                candidates = search_youtube(search_title, year, target_dur)
                
                for c in candidates:
                    score = similarity(search_title, c["yt_title"])
                    
                    validation_entry = {
                        "qid": movie["id"],
                        "original_title": movie["title"],
                        "target_year": year,
                        "target_duration": target_dur,
                        "found_id": c["yt_id"],
                        "found_title": c["yt_title"],
                        "found_channel": c["channel"],
                        "found_duration": c["duration"],
                        "match_score": score,
                        "preview_url": f"https://www.youtube.com/watch?v={c['yt_id']}"
                    }
                    
                    f_out.write(json.dumps(validation_entry, ensure_ascii=False) + "\n")
                    
                    # tqdm.write stampa messaggi sopra la barra senza romperla
                    if score > 0.8:
                        tqdm.write(f"   🌟 Ottimo Match: {c['yt_title']} (Score: {score})")

if __name__ == "__main__":
    main()