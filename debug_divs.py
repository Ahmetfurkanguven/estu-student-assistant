
import re

def find_imbalance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    imbalance = 0
    for i, line in enumerate(lines, 1):
        openings = len(re.findall(r'<div\b', line))
        closings = len(re.findall(r'</div>', line))
        imbalance += openings - closings
        if openings != 0 or closings != 0:
            print(f"L{i:4}: diff={openings-closings:+}, total={imbalance:2} | {line.strip()[:60]}")

find_imbalance('src/App.tsx')
