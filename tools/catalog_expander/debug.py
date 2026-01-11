import re
from difflib import SequenceMatcher

# --- LE TUE FUNZIONI ---
def clean_title_tokens(text):
    text = str(text).lower()
    text = re.sub(r'\b(18|19|20)\d{2}\b', '', text)
    junk_words = {"full", "movie", "film", "complete", "completo", "official", "clip", "scene"}
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return set(word for word in text.split() if word not in junk_words and len(word) > 1)

def extract_year_from_title(text):
    match = re.search(r'\b(18|19|20)\d{2}\b', str(text))
    return int(match.group(0)) if match else None

def sophisticated_similarity(original_title, target_year, yt_title, yt_duration, target_duration):
    print(f"\n--- DEBUG ---")
    print(f"Original: '{original_title}' | Year: {target_year} (Type: {type(target_year)})")
    print(f"YT Title: '{yt_title}'")
    
    # 1. CHECK DURATA
    if target_duration > 0 and yt_duration > 0:
        ratio = yt_duration / target_duration
        print(f"Duration Ratio: {ratio:.2f}")
        if ratio < 0.7 or ratio > 1.3:
            return 0.0

    # 2. CHECK ANNO
    yt_year = extract_year_from_title(yt_title)
    print(f"Extracted YT Year: {yt_year}")
    
    if yt_year and target_year:
        diff = abs(yt_year - int(target_year))
        print(f"Year Diff: {diff}")
        if diff > 1:
            print(">> Triggered Anti-Remake Penalty (0.1)")
            return 0.1
    else:
        print(">> Year Check SKIPPED (One year is missing)")

    # 3. MATCHING TESTUALE
    orig_tokens = clean_title_tokens(original_title)
    yt_tokens = clean_title_tokens(yt_title)
    common = orig_tokens.intersection(yt_tokens)
    
    print(f"Tokens Orig: {orig_tokens}")
    print(f"Tokens YT: {yt_tokens}")
    print(f"Common: {common}")
    
    token_score = len(common) / len(orig_tokens) if orig_tokens else 0
    clean_orig = " ".join(sorted(list(orig_tokens)))
    clean_yt = " ".join(sorted(list(yt_tokens)))
    seq_score = SequenceMatcher(None, clean_orig, clean_yt).ratio()
    
    final_score = round((token_score * 0.7) + (seq_score * 0.3), 2)
    print(f"Final Score: {final_score}")
    return final_score

# --- I DATI INCRIMINATI ---
orig = "La destrucción de Oaxaca"
year = 1931
yt_title = "Mary Shelley's Frankenstein (1994) - The Bride Burns Scene | Movieclips"
yt_dur = 204
target_dur = 204 # Assumiamo sia simile per bypassare il check durata

score = sophisticated_similarity(orig, year, yt_title, yt_dur, target_dur)
print(f"\nRisultato: {score}")