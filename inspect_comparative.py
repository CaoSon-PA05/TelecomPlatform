import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

script_path = r"d:\Gravity\Thanh\Mau\script.js"

with open(script_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print("Searching for compare or file matching methods in script.js...")

# Find all occurrences of "compare" or similar keywords
matches = re.finditer(r"(compareFiles|soSanh|compareContacts|compareIMEI|compareCustom)", content, re.IGNORECASE)
for match in matches:
    start_idx = match.start()
    # Print lines around it
    for j in range(max(0, start_idx - 100), min(len(content), start_idx + 300)):
        pass
    # Let's search by lines instead
    break

lines = content.split('\n')
for idx, line in enumerate(lines):
    if any(keyword in line.lower() for keyword in ['sosanh', 'compare', 'so sánh']):
        if len(line) < 150:
            print(f"Line {idx+1}: {line.strip()}")
