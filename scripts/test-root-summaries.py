"""Coverage, source fidelity and preview style checks for both dictionaries."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for book in ['tahqiq','maqayis']:
 data=json.loads((ROOT/f'public/data/{book}-summaries.json').read_text())['entries']
 count=0
 for p in (ROOT/f'public/data/{book}').glob('*.json'):
  source=json.loads(p.read_text());entries=source['entries'] if book=='tahqiq' else [source]
  assert len(data[p.stem])==len(entries),p
  for entry,preview in zip(entries,data[p.stem]):
   assert preview['word']==entry['word'],p
   assert preview['sourceSha256']==hashlib.sha256((entry['ar']+'\n'+entry['fa']).encode()).hexdigest(),p
   text=preview['summary']
   assert text or preview['needsReview'],p
   assert not re.search(r'…|\.{3}|^اصل این|^اصل واحد|^اصل الواحد|^این مدخل|^نویسنده|^در این مدخل|^این ماده|^این ریشه',text),p
   assert len(text)<=450,p
   assert text.count('(')==text.count(')'),p
   count+=1
 assert set(data)=={p.stem for p in (ROOT/f'public/data/{book}').glob('*.json')}
 print('PASS',book,count,'source-matched complete previews')
a=json.loads((ROOT/'public/data/tahqiq-summaries.json').read_text())['entries']
assert a['نسي'][0]['summary']=='غفلت شخص از چیزی که به خاطر داشته است.'
assert a['وجد'][0]['summary']=='ادراک و دریافتن چیزی در حالتی حادث.'
assert 'در برابر سعادت قرار می‌گیرد' in a['شقو'][0]['summary']

b=json.loads((ROOT/'public/data/maqayis-summaries.json').read_text())['entries']
assert b['شقو'][0]['summary']=='رنج و دشواری، در برابر آسانی و سعادت.'
