import pandas as pd
import re
import sys
from deep_translator import GoogleTranslator

try:
    df = pd.read_parquet('./data/data/train-00000-of-00008.parquet')
except Exception as e:
    sys.exit(1)

with open('src/data/books.ts', 'r', encoding='utf-8') as f:
    books_text = f.read()

existing_words = set(re.findall(r"word:\s*'([^']+)'", books_text))
max_id_match = re.findall(r"id:\s*(\d+)", books_text)
max_id = max([int(x) for x in max_id_match]) if max_id_match else 0

mask = df['word'].str.isalpha() & (df['word'].str.len() >= 4) & (df['word'].str.len() <= 8)
df_filtered = df[mask]

candidates = []
for idx, row in df_filtered.iterrows():
    w = str(row['word']).lower()
    if w in existing_words or len(w) < 4: continue
    
    val = row['all_examples']
    if val is None or len(val) == 0: continue
    
    candidates.append((w, val[0]))
    if len(candidates) >= 20: break

translator = GoogleTranslator(source='en', target='zh-CN')

print("    {")
print("      id: 'chapter-55',")
print("      name: 'Chapter 55',")
print("      description: '词汇 (附加)',")
print("      words: [")

for idx, (w, ex) in enumerate(candidates):
    max_id += 1
    # naive translate
    try:
        meaning = "n./v. " + w
        ex_translate = translator.translate(ex)
    except:
        ex_translate = ""
    print(f"        {{ id: {max_id}, word: '{w}', phonetic: '/{w}/', meaning: '{meaning}', example: '{ex.replace(chr(39), chr(39)+chr(39))}', exampleTranslation: '{ex_translate.replace(chr(39), chr(39)+chr(39))}' }},")

print("      ],")
print("    },")
