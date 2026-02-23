import pandas as pd

file_path = './data/data/train-00000-of-00008.parquet'

try:
    df = pd.read_parquet(file_path)
    print("DataFrame Schema:")
    print(df.info())
    print("\nFirst 5 rows of the DataFrame:")
    print(df.head())
except Exception as e:
    print(f"Error reading parquet file: {e}")
