import json
import os
import sys

root_dir = "/Users/aneovale/Developer/github/KimiTyper"
sys.path.append(root_dir)

from scripts.gen_cet4_details import infer_etymology, MANUAL_DATA

def main():
    books_dir = os.path.join(root_dir, "public", "books")
    words_dir = os.path.join(root_dir, "public", "words")
    book_ids = ["yilin_elective_1", "yilin_elective_2", "yilin_elective_3"]
    
    for book_id in book_ids:
        book_file = os.path.join(books_dir, f"{book_id}_book.json")
        if not os.path.exists(book_file):
            print(f"File not found: {book_file}")
            continue
            
        with open(book_file, "r", encoding="utf-8") as f:
            book_data = json.load(f)
            
        details = []
        for ch in book_data.get("chapters", []):
            for w in ch.get("words", []):
                word_text = w.get("word", "")
                word_id = w.get("id")
                
                detail = {
                    "wordId": word_id,
                    "bookId": book_id,
                    "word": word_text,
                    "prefix": "", "root": "", "suffix": "", "etymology": "", "wordFormation": "", "cognates": []
                }
                
                word_lower = word_text.lower()
                infer = infer_etymology(word_lower)
                
                detail["prefix"] = infer.get("prefix", "")
                detail["suffix"] = infer.get("suffix", "")
                detail["root"] = infer.get("root", "")
                detail["etymology"] = infer.get("etymology", "")
                detail["wordFormation"] = infer.get("wordFormation", "")
                
                if word_lower in MANUAL_DATA:
                    for k,v in MANUAL_DATA[word_lower].items():
                        detail[k] = v
                    
                details.append(detail)
                
        out_data = {
            "_version": "1.1",
            "_generated": "2026-02-27",
            "words": details
        }
        
        out_file = os.path.join(words_dir, f"{book_id}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(out_data, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully generated full details for {book_id}, total words: {len(details)}")

if __name__ == "__main__":
    main()
