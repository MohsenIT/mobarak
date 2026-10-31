#!/usr/bin/env python3
"""Audit/rebuild verse page metadata from the existing ordered word-line layout.

Words are already in Quran order. A decrease of line number starts a new page.
Before writing, validate all 604 pages and all 114 independent surah starts.
Quran text, words, morphology and line numbers are never modified.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
meta_path = ROOT / 'public/data/meta.json'
meta = json.loads(meta_path.read_text())
pages = [[] for _ in range(604)]
page, previous_line = 1, 0
changes, documents = [], []
for number in range(1, 115):
    path = ROOT / f'public/data/surah/{number}.json'
    data = json.loads(path.read_text())
    for verse in data['v']:
        word_pages = []
        for word in verse['w']:
            line = word.get('l')
            if not isinstance(line, int) or not 1 <= line <= 15:
                raise ValueError(f'Invalid line: {number}:{verse["n"]}')
            if line < previous_line:
                page += 1
            previous_line = line
            word_pages.append(page)
        if not word_pages or len(set(word_pages)) != 1:
            raise ValueError(f'Unexpected verse spanning pages: {number}:{verse["n"]}')
        actual = word_pages[0]
        if verse['n'] == 1 and actual != meta['surahs'][number - 1]['pg']:
            raise ValueError(f'Surah start does not agree: {number}')
        if actual > 604:
            raise ValueError('Too many pages')
        if verse['p'] != actual:
            changes.append((number, verse['n'], verse['p'], actual))
            verse['p'] = actual
        segments = pages[actual - 1]
        if segments and segments[-1]['s'] == number:
            segments[-1]['t'] = verse['n']
        else:
            segments.append({'s': number, 'f': verse['n'], 't': verse['n']})
    documents.append((path, data))
if page != 604 or any(not segments for segments in pages):
    raise ValueError('Expected 604 nonempty pages')
print(f'Validated {page} pages and all 114 surah starts; {len(changes)} verse-page corrections.')
for number, verse, old, new in changes:
    print(f'{number}:{verse}: {old} -> {new}')
if args.write:
    for path, data in documents:
        if any(number == data['n'] for number, *_ in changes):
            path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    meta['pages'] = pages
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
else:
    print('Audit only; use --write to apply verified page metadata.')
