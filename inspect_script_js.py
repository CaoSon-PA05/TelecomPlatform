import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

script_path = r"d:\Gravity\Thanh\Mau\script.js"

with open(script_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print("Analyzing functions in legacy script.js...")

# Find all function definitions in the file
funcs = re.findall(r"function\s+(\w+)\s*\(", content)
print(f"Total functions found: {len(funcs)}")
print("First 40 function names:", funcs[:40])

# Let's search for references to VIETTEL, VINA, MOBI to see how it handles templates
print("\nScanning for VIETTEL, VINA, MOBI templates or column checks...")
lines = content.split('\n')
for idx, line in enumerate(lines):
    if any(provider in line.upper() for provider in ["VIETTEL", "VINAPHONE", "MOBIFONE"]):
        # Print lines that aren't huge (avoid printing minified code)
        if len(line) < 200:
            print(f"Line {idx+1}: {line.strip()}")
