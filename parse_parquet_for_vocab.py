import pandas as pd

file_path = './data/data/train-00000-of-00008.parquet'
df = pd.read_parquet(file_path)

for idx in range(100, 102):
    row = df.iloc[idx]
    print(f"--- Word: {row['word']} ---")
    for col in df.columns:
        val = row[col]
        try:
            val_str = str(val)
            if len(val_str) > 100:
                val_str = val_str[:100] + "..."
            print(f"  {col}: {val_str}")
        except:
            print(f"  {col}: could not print")
