"""Import a complete, ordered 6236-verse translation without altering its text.
Usage: python3 scripts/import-translation.py <json-array-file> <translation-id>
"""
import json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);key=sys.argv[2]
if key not in ['s','k','h']:raise ValueError('Unknown translation id')
rows=json.loads(source.read_text())
meta=json.loads((root/'public/data/meta.json').read_text())
if not isinstance(rows,list) or len(rows)!=sum(s['vc'] for s in meta['surahs']):raise ValueError('Translation must contain all 6236 verses in surah/ayah order')
if any(not isinstance(t,str) for t in rows):raise ValueError('Invalid verse translation')
prepared=[];offset=0
for s in meta['surahs']:
 path=root/f"public/data/trans/{s['n']}.json";data=json.loads(path.read_text())
 if set(data)!=set(str(a) for a in range(1,s['vc']+1)):raise ValueError('Verse index mismatch')
 for a in range(1,s['vc']+1):
  text=rows[offset]
  if not text.strip() and not (key=='s' and s['n']==80 and a==39):raise ValueError(f"Missing translation at {s['n']}:{a}")
  data[str(a)][key]=text;offset+=1
 prepared.append((path,data))
for path,data in prepared:path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Imported {offset} translations across 114 surahs as {key}.')
