
import re

def count_tags(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all div openings and closings
    open_divs = len(re.findall(r'<div\b', content))
    close_divs = len(re.findall(r'</div>', content))

    print(f"Opening <div> tags: {open_divs}")
    print(f"Closing </div> tags: {close_divs}")
    print(f"Difference: {open_divs - close_divs}")

count_tags('src/App.tsx')
