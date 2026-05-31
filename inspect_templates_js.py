import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

script_path = r"d:\Gravity\Thanh\Mau\script.js"

with open(script_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print("Scanning for template templates in script.js...")

# Find keys like template1, template2, template3 or template names
template_definitions = re.findall(r"['\"]template\d+['\"]\s*:", content)
print("Template references found:", set(template_definitions))

# Search for template detection block in script.js (lines around 'suggestedTemplate')
lines = content.split('\n')
for idx, line in enumerate(lines):
    if 'suggestedTemplate' in line or 'template1' in line or 'template2' in line or 'template3' in line:
        if len(line) < 150 and any(keyword in line for keyword in ['=', 'if', 'return', 'case', 'switch']):
            print(f"Line {idx+1}: {line.strip()}")
