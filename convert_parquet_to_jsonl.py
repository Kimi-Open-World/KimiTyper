import pandas as pd
import json

input_file_path = './data/data/train-00000-of-00008.parquet'
output_file_path = './data/etymology_data_sample.jsonl'

try:
    df = pd.read_parquet(input_file_path)

    # Select relevant columns and handle potential NaN values
    # Replace NaN in etymology_summary with empty string for JSON output
    df_selected = df[['word', 'etymology_summary', 'etymology_cognates']].copy()
    df_selected['etymology_summary'] = df_selected['etymology_summary'].fillna('')

    # Convert DataFrame to a list of dictionaries, then to JSONL
    with open(output_file_path, 'w', encoding='utf-8') as f:
        for record in df_selected.to_dict(orient='records'):
            # Ensure etymology_cognates is a list, even if empty
            if not isinstance(record['etymology_cognates'], list):
                record['etymology_cognates'] = []
            json.dump(record, f, ensure_ascii=False)
            f.write('\n')

    print(f"Successfully converted '{input_file_path}' to '{output_file_path}'")
except Exception as e:
    print(f"Error during conversion: {e}")
