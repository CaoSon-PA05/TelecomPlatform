import os
import sys
import glob

print("Python version:", sys.version)

# Check installed packages
try:
    import pandas as pd
    print("Pandas is installed.")
except ImportError:
    print("Pandas is NOT installed.")

try:
    import openpyxl
    print("OpenPyXL is installed.")
except ImportError:
    print("OpenPyXL is NOT installed.")

# Let's inspect the files in d:\Gravity\Thanh\Mau\File data mau
excel_files = glob.glob(r"d:\Gravity\Thanh\Mau\File data mau\*.xlsx")
print(f"Found {len(excel_files)} excel files in File data mau.")
for f in excel_files[:5]:
    print(" -", os.path.basename(f), f"{os.path.getsize(f)} bytes")
