import json
import re
import sys
import os
from deep_translator import GoogleTranslator
from concurrent.futures import ThreadPoolExecutor

def is_english(text):
    if not text: return False
    # If the text has a significant portion of english alphabet vs chinese characters, 
    # but wait, the jsonl data is mostly English. Let's just check if it contains no Chinese characters.
    if re.search(r'[\u4e00-\u9fa5]', text):
        # We can also check if it starts with '源自' which is Chinese, but the English ones don't.
        # However, some might be English with a few Chinese characters? 
        # Actually, in gen_cet4_details.py, if the summary is from jsonl_data, it is likely purely English.
        if "Aalst is a Germanic toponym" in text:
            return True
        # Let's say if ratio of english words is high, or no Chinese characters.
        if len(re.findall(r'[\u4e00-\u9fa5]', text)) < 5:
            return True
        return False
    return True

def translate_text(text):
    if not text or not is_english(text):
        return text
    try:
        translator = GoogleTranslator(source='en', target='zh-CN')
        return translator.translate(text)
    except Exception as e:
        print(f"Failed to translate: {text[:30]}... Error: {e}")
        return text

def main():
    json_path = "public/words/cet4.json"
    if not os.path.exists(json_path):
        print("File not found.")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    words = data.get("words", [])
    
    # Let's count how many need translation
    to_translate = []
    for w in words:
        etym = w.get("etymology", "")
        if etym and is_english(etym):
            to_translate.append(w)

    print(f"Total words: {len(words)}, need translation: {len(to_translate)}")

    # Translate in parallel to speed it up
    def process_word(w):
        w["etymology"] = translate_text(w["etymology"])
        return True

    with ThreadPoolExecutor(max_workers=10) as executor:
        list(executor.map(process_word, to_translate))

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # also update the version in src/data/books.ts so that cache is reloaded
    ts_path = "src/data/books.ts"
    if os.path.exists(ts_path):
        with open(ts_path, "r", encoding="utf-8") as f:
            ts_data = f.read()
        
        # bump version to trigger cache refresh
        import re
        match = re.search(r"version:\s*'([^']+)'", ts_data)
        if match:
            old_version = match.group(1)
            # simple bump
            if old_version == "1.1":
                new_version = "1.2"
            else:
                new_version = "1.3"
            ts_data = ts_data.replace(f"version: '{old_version}'", f"version: '{new_version}'")
            with open(ts_path, "w", encoding="utf-8") as f:
                f.write(ts_data)
        
    print("Done")

if __name__ == "__main__":
    main()
