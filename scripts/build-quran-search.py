"""Build a lazy search corpus from canonical Quran words without changing the text."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
verses=[]
waw={}
morphology={}
for number in range(1,115):
    data=json.loads((ROOT/f'public/data/surah/{number}.json').read_text())
    verses.extend([number,v['n'],[w['t'] for w in v['w']]] for v in data['v'])
    for verse in data['v']:
        morphology[f"{number}:{verse['n']}"]=[[w.get('r'),w.get('lemma'),w.get('form')] for w in verse['w']]
        positions=[i+1 for i,w in enumerate(verse['w']) if w.get('wa')]
        if positions: waw[f"{number}:{verse['n']}"]=positions
assert len(verses)==6236
path=ROOT/'public/data/quran-search.json'
path.write_text(json.dumps({'version':2,'copyrightNotice':(ROOT/'public/data/morphology-source.txt').read_text(),'verses':verses,'waw':waw,'morphology':morphology},ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(verses)} verses; {path.stat().st_size} bytes')
