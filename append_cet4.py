import pandas as pd
import re
import sys

print("Loading parquet...")
try:
    df = pd.read_parquet('./data/data/train-00000-of-00008.parquet')
except Exception as e:
    print(e)
    sys.exit(1)

with open('src/data/books.ts', 'r', encoding='utf-8') as f:
    books_text = f.read()

existing_words = set(re.findall(r"word:\s*'([^']+)'", books_text))
print(f"Existing words: {len(existing_words)}")

mask = df['word'].str.isalpha() & (df['word'].str.len() >= 3) & (df['word'].str.len() <= 10)
df_filtered = df[mask]
print(f"Filtered to {len(df_filtered)} words")

candidates = []
for idx, row in df_filtered.iterrows():
    w = str(row['word']).lower()
    if w in existing_words: continue
    
    val = row['all_examples']
    # safely check array empty
    if val is None or len(val) == 0: continue
    
    candidates.append(w)
    if len(candidates) >= 20:
        break

print(f"Candidates: {candidates}")
