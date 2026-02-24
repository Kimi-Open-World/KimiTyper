import json
import re
from deep_translator import GoogleTranslator
from concurrent.futures import ThreadPoolExecutor

def needs_translation(text):
    if not text: return False
    # If the text has a significant portion of english alphabet, let's say more than 25 English characters, and we also see English words.
    # Actually wait. If it's a mix, let's just translate the English parts? No, let's just re-translate the whole text if it has too much English.
    # Wait, some text has "源自拉丁语 xxx (yyyy)" we don't want to re-translate that.
    # Let's check if there are 3 consecutive English words.
    words = re.findall(r'[A-Za-z]+', text)
    if len(words) >= 4:
        # e.g. "The sequence traces a common Germanic toponymic pattern" has 8 words.
        # Check if the length of english letters is mostly a sentence.
        # "Aalst is a Germanic toponym" -> >20 letters
        english_len = sum(len(w) for w in words)
        if english_len > 25:
            return True
    return False

def translate_whole_or_partial(text):
    try:
        translator = GoogleTranslator(source='en', target='zh-CN')
        # If it's a mix like "阿尔斯特 (Aalst) 是..." + English, we'd better just pass the whole thing to Google Translator and it will output mostly Chinese.
        # Or even better, pass the whole text to deepL or GoogleTranslator with auto source.
        return translator.translate(text)
    except Exception as e:
        print(f"Failed to translate: {text[:30]}... Error: {e}")
        return text

def main():
    json_path = "public/words/cet4.json"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    words = data.get("words", [])
    
    to_translate = []
    for w in words:
        if needs_translation(w.get("etymology", "")) or needs_translation(w.get("wordFormation", "")):
            to_translate.append(w)

    print(f"Total words: {len(words)}, need translation: {len(to_translate)}")

    def process_word(w):
        if needs_translation(w.get("etymology", "")):
            w["etymology"] = translate_whole_or_partial(w["etymology"])
        if needs_translation(w.get("wordFormation", "")):
            w["wordFormation"] = translate_whole_or_partial(w["wordFormation"])
        return True

    with ThreadPoolExecutor(max_workers=10) as executor:
        list(executor.map(process_word, to_translate))

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("Done")

if __name__ == "__main__":
    main()
