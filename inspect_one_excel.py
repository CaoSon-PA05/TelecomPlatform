import pandas as pd
import sys

# Configure UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

file_path = r"d:\Gravity\Thanh\Mau\File data mau\11_0986556206.xlsx"
print(f"Inspecting file: {file_path}")

xl = pd.ExcelFile(file_path)
print("Sheet names:", xl.sheet_names)

for sheet_name in xl.sheet_names:
    print(f"\n--- SHEET: {sheet_name} ---")
    df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=30, header=None)
    for idx, row in df.iterrows():
        row_vals = [str(x) for x in row.values]
        print(f"Row {idx:02d}: {row_vals[:12]}")
