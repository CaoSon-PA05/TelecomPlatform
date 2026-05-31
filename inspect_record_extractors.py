import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

script_path = r"d:\Gravity\Thanh\Mau\script.js"

with open(script_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print("Searching for extractTemplateXRecord functions in script.js...")

for template_num in [1, 2, 3]:
    func_name = f"extractTemplate{template_num}Record"
    match = re.search(r"extractTemplate" + str(template_num) + r"Record\s*\([^)]*\)\s*\{", content)
    if match:
        start_idx = match.start()
        # Find closing brace of this function
        brace_count = 1
        curr_idx = match.end()
        while brace_count > 0 and curr_idx < len(content):
            if content[curr_idx] == '{':
                brace_count += 1
            elif content[curr_idx] == '}':
                brace_count -= 1
            curr_idx += 1
        print(f"\n==================== FUNCTION {func_name} ====================")
        print(content[start_idx:curr_idx])
        print("="*60)
    else:
        print(f"Could not find function: {func_name}")
