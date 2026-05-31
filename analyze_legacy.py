import os
import glob
import pandas as pd
import re
import sys

# Configure UTF-8 output to avoid CP1252 encode errors on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("Starting deep analysis of legacy project files with UTF-8 configuration...")

# Let's inspect the excel files and categorize them by their columns to find the different provider formats
excel_dir = r"d:\Gravity\Thanh\Mau\File data mau"
excel_files = glob.glob(os.path.join(excel_dir, "*.xlsx"))

print(f"\n--- ANALYZING {len(excel_files)} EXCEL SAMPLES ---")
templates_discovered = {}

for fpath in excel_files:
    fname = os.path.basename(fpath)
    try:
        xl = pd.ExcelFile(fpath)
        sheet_names = xl.sheet_names
        
        # Read the first sheet's first few rows
        # We need to find where the header actually starts. Some sheets have metadata at the top (e.g. rows 0-5)
        df_preview = pd.read_excel(fpath, sheet_name=sheet_names[0], nrows=10, header=None)
        
        # Find a row that looks like a header (has multiple columns and looks like column labels)
        header_row_idx = 0
        columns = []
        for idx, row in df_preview.iterrows():
            row_list = [str(x).strip() for x in row.values if pd.notna(x)]
            # If a row has words like "số", "chủ", "gọi", "thời gian", "imei", "lac", "cell", "ngày", "loại"
            keywords = ["số", "chủ", "gọi", "thời gian", "imei", "lac", "cell", "ngày", "loại", "hướng", "đối tác", "thuê bao", "thời lượng"]
            matches = sum(1 for word in row_list for kw in keywords if kw in word.lower())
            if matches >= 2:
                header_row_idx = idx
                columns = [str(x).strip() for x in row.values]
                break
        
        if not columns:
            # Fallback to row 0 if no clear header row found
            columns = [str(x).strip() for x in df_preview.iloc[0].values]
            header_row_idx = 0
            
        # Clean up column list
        columns = [c for c in columns if c != "nan" and c != "None" and c != ""]
        
        # We can normalize columns signature by sorting clean column strings
        col_signature = tuple(sorted(columns))
        if col_signature not in templates_discovered:
            templates_discovered[col_signature] = {
                "files": [],
                "columns": columns,
                "header_row": header_row_idx,
                "sheet_names": sheet_names
            }
        templates_discovered[col_signature]["files"].append(fname)
        
    except Exception as e:
        print(f"Error reading {fname}: {str(e)}")

print(f"\nDiscovered {len(templates_discovered)} distinct Excel template formats based on column signatures:")
for i, (sig, info) in enumerate(templates_discovered.items(), 1):
    print(f"\nFormat {i}:")
    print(f"  Representative files: {info['files'][:3]} (Total: {len(info['files'])} files)")
    print(f"  Sheets: {info['sheet_names']}")
    print(f"  Header Row Index: {info['header_row']}")
    print(f"  Columns: {info['columns']}")

# Let's search inside script.js for parser/mapping configurations using regex
script_path = r"d:\Gravity\Thanh\Mau\script.js"
if os.path.exists(script_path):
    print(f"\n--- ANALYZING LEGACY script.js ({os.path.getsize(script_path)} bytes) ---")
    with open(script_path, "r", encoding="utf-8", errors="ignore") as js_file:
        js_content = js_file.read()
        
    # Let's find patterns like: "detectTemplate" or search for column definitions in js
    # We can write a parser that extracts variable definitions or functions containing mapping details
    # Let's look for sections that define columns
    print("\nSearching for column configuration objects in script.js...")
    # Find all declarations like "const viettelHeaders" or similar
    header_decl_matches = re.finditer(r"(const|let|var)\s+(\w+headers|\w+columns|\w+mapping)\s*=\s*\{", js_content, re.IGNORECASE)
    for match in header_decl_matches:
        start_idx = match.start()
        # Find closing brace of this object
        brace_count = 1
        curr_idx = match.end()
        while brace_count > 0 and curr_idx < len(js_content):
            if js_content[curr_idx] == '{':
                brace_count += 1
            elif js_content[curr_idx] == '}':
                brace_count -= 1
            curr_idx += 1
        print(js_content[start_idx:curr_idx])
        print("=" * 60)

    # Let's search for function detectTemplate or similar
    detect_matches = re.finditer(r"function\s+detectTemplate[^{]*\{", js_content)
    for match in detect_matches:
        start_idx = match.start()
        brace_count = 1
        curr_idx = match.end()
        while brace_count > 0 and curr_idx < len(js_content):
            if js_content[curr_idx] == '{':
                brace_count += 1
            elif js_content[curr_idx] == '}':
                brace_count -= 1
            curr_idx += 1
        print("Function detectTemplate:")
        print(js_content[start_idx:curr_idx])
        print("=" * 60)
        
    # Let's write another block to find where the files are actually parsed
    xlsx_reads = re.findall(r"XLSX\.read\s*\(", js_content)
    print(f"Found {len(xlsx_reads)} occurrences of 'XLSX.read'")
else:
    print("script.js not found in Mau folder.")
