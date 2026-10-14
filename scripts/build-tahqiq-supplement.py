"""Merge the reviewed DOCX supplement into lazily loaded root assets.
Run after import-tahqiq.py; repeatable without changing the original APK texts.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'data/tahqiq/supplement-source.json').read_text())
index_path=ROOT/'public/data/tahqiq-index.json'
index=json.loads(index_path.read_text())
roots=json.loads((ROOT/'public/data/roots.json').read_text())
meta=json.loads((ROOT/'public/data/meta.json').read_text())
index.setdefault('apkMatchedRoots',index['matchedRoots'])
entries=source['entries']
if len(entries)!=88 or set(entries)&set(index['apkMatchedRoots']):raise ValueError('Unexpected supplement coverage')
surahs={int(s):json.loads((ROOT/f'public/data/surah/{s}.json').read_text()) for root in entries for s in roots[root]}
for root,entry in entries.items():
    if not entry['ar'].strip() or not entry['fa'].strip():raise ValueError('Empty translated entry')
    public={k:v for k,v in entry.items() if k!='sourceArabic'}
    examples=[]
    for s in roots[root]:
        data=surahs[int(s)]
        for a,pos in data['ri'][root]:
            if any(e['s']==int(s) and e['a']==a for e in examples):continue
            word=data['v'][a-1]['w'][pos-1]
            assert word['r']==root
            examples.append({'s':int(s),'a':a,'pos':pos,'text':word['t'],'surahName':meta['surahs'][int(s)-1]['fa']})
            if len(examples)==2:break
        if len(examples)==2:break
    public['examples']=examples
    (ROOT/f'public/data/tahqiq/{root}.json').write_text(json.dumps({'root':root,'entries':[public]},ensure_ascii=False,separators=(',',':'))+'\n')
index['supplementRoots']=list(entries)
index['matchedRoots']=list(dict.fromkeys(index['apkMatchedRoots']+list(entries)))
index['missingRoots']=[r for r in roots if r not in index['matchedRoots']]
index['supplementSource']=source['source']
index_path.write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Added {len(entries)} translations; coverage {len(index["matchedRoots"])} / {len(roots)}; missing {len(index["missingRoots"])}.')
