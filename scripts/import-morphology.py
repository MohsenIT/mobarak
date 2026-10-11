"""Import word-level forms from the unmodified Quranic Arabic Corpus 0.4.

Run from the repository root: python3 scripts/import-morphology.py
Source and copyright notices: public/data/morphology-source.txt
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'data/quranic-corpus-morphology-0.4.txt'
forms = {}
form_roots = {}
BUCKWALTER = dict(zip("'|>&<}AbptvjHxd*rzs$SDTZEgfqklmnhwYy", 'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهويي'))
word_counts = {}
for line in source.read_text().splitlines():
    if not line.startswith('('):
        continue
    location, text, tag, features = line.split('\t')
    s, a, w, segment = map(int, re.findall(r'\d+', location))
    word_counts[s, a] = max(word_counts.get((s, a), 0), w)
    match = re.search(r'(?:^|\|)\(([IVX]+)\)(?:\||$)', features)
    # Unmarked verbs are form I; do not infer forms for unmarked nouns.
    form = match[1] if match else ('I' if tag == 'V' else None)
    if form:
        key = s, a, w
        if key in forms and forms[key] != form:
            raise ValueError(f'Conflicting forms at {key}')
        forms[key] = form
        root = re.search(r'ROOT:([^|]+)', features)
        if root:
            form_roots[key] = ''.join(BUCKWALTER.get(c, c) for c in root[1])

# Validate every location before writing any dataset.
datasets = []
used = set()
for s in range(1, 115):
    path = ROOT / f'public/data/surah/{s}.json'
    data = json.loads(path.read_text())
    for verse in data['v']:
        a = verse['n']
        if len(verse['w']) != word_counts[s, a]:
            raise ValueError(f'Word alignment mismatch at {s}:{a}')
        for w, word in enumerate(verse['w'], 1):
            key = s, a, w
            if key in forms:
                if key in form_roots and word.get('r') != form_roots[key]:
                    raise ValueError(f'Root alignment mismatch at {key}')
                word['form'] = forms[key]
                used.add(key)
            else:
                word.pop('form', None)
    datasets.append((path, data))
if used != forms.keys():
    raise ValueError('Unmatched morphology locations')
for path, data in datasets:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Imported {len(used)} word-level forms across 114 surahs.')
