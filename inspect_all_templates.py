import os
import glob
import pandas as pd
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

excel_dir = r"d:\Gravity\Thanh\Mau\File data mau"
excel_files = glob.glob(os.path.join(excel_dir, "*.xlsx"))

print(f"Deep scanning {len(excel_files)} Excel files for precise data schemas...")

for fpath in sorted(excel_files):
    fname = os.path.basename(fpath)
    try:
        xl = pd.ExcelFile(fpath)
        sheet_name = xl.sheet_names[0]
        
        # Read the first 40 rows to inspect metadata and headers
        df = pd.read_excel(fpath, sheet_name=sheet_name, nrows=40, header=None)
        
        # Find subscriber info
        sub_name = "N/A"
        sub_phone = "N/A"
        header_row = -1
        headers = []
        
        for idx, row in df.iterrows():
            row_vals = [str(x).strip() for x in row.values]
            
            # Look for subscriber name
            for j, val in enumerate(row_vals):
                if "Họ Tên" in val or "Họ và tên" in val or "tên thuê bao" in val.lower():
                    if j + 1 < len(row_vals) and row_vals[j+1] != "nan":
                        sub_name = row_vals[j+1]
                    elif j + 2 < len(row_vals) and row_vals[j+2] != "nan":
                        sub_name = row_vals[j+2]
                        
                if "Số thuê bao" in val or "số điện thoại" in val.lower():
                    if j + 1 < len(row_vals) and row_vals[j+1] != "nan":
                        sub_phone = row_vals[j+1]
                    elif j + 2 < len(row_vals) and row_vals[j+2] != "nan":
                        sub_phone = row_vals[j+2]
            
            # Look for headers (row with 'số đi' or 'số chủ' or 'số gọi')
            keywords = ["số đi", "số chủ", "số gọi", "calling", "direction", "thuê bao", "lac", "cell", "ngày"]
            matches = sum(1 for v in row_vals if any(kw in v.lower() for kw in keywords))
            
            # Specifically look for common column titles
            if ("số đi" in row_vals or "số gọi" in row_vals or "calling" in [v.lower() for v in row_vals] or 
                "#" in row_vals or "stt" in [v.lower() for v in row_vals]):
                header_row = idx
                headers = [v for v in row_vals if v != "nan" and v != ""]
                break
                
        print(f"File: {fname}")
        print(f"  Owner Name: {sub_name} | Phone: {sub_phone}")
        print(f"  Header Row: {header_row}")
        print(f"  Parsed Columns: {headers[:12]}")
        print("-" * 50)
        
    except Exception as e:
        print(f"Error parsing {fname}: {str(e)}")
