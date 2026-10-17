"""Build a lazy search corpus from canonical Quran words without changing the text."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
verses=[]
waw={}
for number in range(1,115):
    data=json.loads((ROOT/f'public/data/surah/{number}.json').read_text())
    verses.extend([number,v['n'],[w['t'] for w in v['w']]] for v in data['v'])
    for verse in data['v']:
        positions=[i+1 for i,w in enumerate(verse['w']) if w.get('wa')]
        if positions: waw[f"{number}:{verse['n']}"]=positions
assert len(verses)==6236
path=ROOT/'public/data/quran-search.json'
path.write_text(json.dumps({'version':1,'copyrightNotice':(ROOT/'public/data/morphology-source.txt').read_text(),'verses':verses,'waw':waw},ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(verses)} verses; {path.stat().st_size} bytes')
