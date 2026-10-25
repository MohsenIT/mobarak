"""Import one ordered Tanzil source per language, preserving original text and empty ayahs.
Usage: python scripts/import-tanzil-languages.py <extracted @ghoran/translation@0.0.9 package> <downloaded tanzil.js>
Output includes per-file SHA256, source URL, distribution path and translated verse counts.
"""
import json,re,pathlib,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1];src=pathlib.Path(sys.argv[1])/'json'
s=pathlib.Path(sys.argv[2]).read_text();names=dict(re.findall(r'"([^"]+)":"([^"]+)"',re.search(r'var transList=(\{.*?\});',s).group(1)))
preferred={'ar':'muyassar','en':'sahih','de':'bubenheim','tr':'diyanet','ur':'jalandhry','ru':'kuliev','zh':'jian','id':'indonesian','es':'garcia','bn':'bengali','hi':'hindi','bs':'korkut','nl':'leemhuis','ml':'abdulhameed'}
meta=json.loads((root/'public/data/meta.json').read_text());catalog=[]
for langdir in sorted(src.iterdir()):
 lang=langdir.name
 if lang=='fa':continue
 files=sorted(langdir.glob('*.json'));suffix=preferred.get(lang,files[0].stem.removeprefix('tanzil-'));p=langdir/f'tanzil-{suffix}.json';rows=json.loads(p.read_text());assert len(rows)==6236,(lang,len(rows));assert all(isinstance(t,str) for t in rows),(lang,'invalid')
 tid=f'{lang}.{suffix}';url=f'https://tanzil.net/trans/{tid}';b=(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n').encode();(root/f'public/data/translations/{tid}.json').write_bytes(b)
 catalog.append({'id':tid,'language':lang,'name':names.get(tid,suffix),'kind':'tafsir' if lang=='ar' else 'translation','source':url,'verses':6236,'translatedVerses':sum(bool(t.strip()) for t in rows),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'distribution':f'@ghoran/translation@0.0.9/json/{lang}/tanzil-{suffix}.json'})
(root/'public/data/translations/catalogue.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print(len(catalog),'sources',sum(x['bytes'] for x in catalog),'bytes')
