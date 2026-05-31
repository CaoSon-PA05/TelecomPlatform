import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

script_path = r"d:\Gravity\Thanh\Mau\script.js"

with open(script_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print("Deep searching for template-specific column mappings in script.js...")

# Search for the block where currentTemplate === 'template1', 'template2', etc. are set up with columns
# Let's search for "template1" inside the js file and print blocks of code
# Let's find lines containing "this.currentColumnMap" or "template1" and surrounding lines
lines = content.split('\n')
for idx, line in enumerate(lines):
    if "currentTemplate === 'template1'" in line or "this.currentTemplate === 'template1'" in line:
        print(f"--- LINE {idx+1} ---")
        # Print next 20 lines
        for j in range(max(0, idx-5), min(len(lines), idx+30)):
            print(f"{j+1}: {lines[j]}")
        print("="*60)
