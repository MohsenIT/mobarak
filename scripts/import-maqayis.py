"""Extract draft root entries from the uploaded six-volume Arabic edition.
The draft is not published automatically; translations require reviewed entry bounds.
"""
import json,re,unicodedata,difflib,hashlib
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def norm(s):
 s=unicodedata.normalize('NFKC',s);s=re.sub(r'(.)\u0651',r'\1\1',s);s=re.sub(r'[\u064b-\u065f\u0670\u200cـ]','',s);return s.translate(str.maketrans('أإآىیک','ااايي ك'.replace(' ','')))
def prose(s):return re.sub(r'[^\u0621-\u064a]','',norm(s))
class P(HTMLParser):
 def __init__(self):super().__init__();self.stack=[];self.page=0;self.page_id=None;self.buf=None;self.records=[];self.heading=None
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='div' and a.get('class')=='page':self.page+=1;self.page_id=a['id']
  self.stack.append((t,a))
  if t in ('p','h2','h3') and self.page:
   self.buf=[];self.kind=t;self.footnote=any('footnote' in x.get('class','') for _,x in self.stack)
 def handle_data(self,s):
  if self.buf is not None:self.buf.append(s)
 def handle_endtag(self,t):
  if t in ('p','h2','h3') and self.buf is not None:
   text=''.join(self.buf).strip()
   if text:self.records.append({'text':text,'page':self.page,'pageId':self.page_id,'kind':self.kind,'footnote':self.footnote})
   self.buf=None
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i][0]==t:self.stack=self.stack[:i];break
reference=[{'root':e['root'],'text':e['prefix']} for e in json.loads((ROOT/'data/maqayis/boundary-hints.json').read_text())['entries']]
hints={}
for e in reference:hints.setdefault(norm(e['root']),[]).append(e)
files=[]
import sys
if len(sys.argv)!=2:raise SystemExit('Usage: python3 scripts/import-maqayis.py <directory-of-six-html-volumes>')
for f in Path(sys.argv[1]).rglob('*.html'):
 if re.search('500509|500511|500515|500519|500523|500526',f.name):files.append(f)
if len(files)!=6:raise ValueError('Expected exactly six HTML volumes')
entries=[];sources=[]
for f in sorted(files):
 raw=f.read_bytes();html=raw.decode();volume=int(re.search(r'<title>.*?جلد (\d+)',html)[1]);p=P();p.feed(html)
 sources.append({'volume':volume,'file':f.name,'sha256':hashlib.sha256(raw).hexdigest(),'pageCount':p.page})
 current=None
 for r in p.records:
  text=r['text'];tokens=text.split(maxsplit=1);word=tokens[0];key=norm(word);body=tokens[1] if len(tokens)>1 else ''
  candidates=hints.get(key,[])
  score=max((difflib.SequenceMatcher(None,prose(body)[:55],prose(e['text'])[:55]).ratio() for e in candidates),default=0)
  start=r['kind']=='p' and not r['footnote'] and candidates and score>=.55
  boundary = r['kind']=='p' and not r['footnote'] and len(word)<=8 and re.match(r'(?:و)?(?:الهمزة|الباء|التاء|الثاء|الجيم|الحاء|الخاء|الدال|الذال|الراء|الزاء|السين|الشين|الصاد|الضاد|الطاء|الظاء|العين|الغين|الفاء|القاف|الكاف|اللام|الميم|النون|الهاء|الواو|الياء)\s+و', body)
  if boundary and not start:current=None
  if r['kind'] in ('h2','h3'):
   current=None
  if start:
   current={'word':word,'key':key,'volume':volume,'page':r['page'],'pageEnd':r['page'],'pageId':r['pageId'],'paragraphs':[],'footnotes':[],'matchScore':round(score,3)};entries.append(current)
  if current and r['kind']=='p':
   current['footnotes' if r['footnote'] else 'paragraphs'].append({'page':r['page'],'text':body if start else text});current['pageEnd']=r['page']
for e in entries:e['ar']='\n\n'.join(p['text'] for p in e['paragraphs'])
reviews_path=ROOT/'data/maqayis/source-reviews.json'
if reviews_path.exists():
 for review in json.loads(reviews_path.read_text())['entries']:
  identity=review['sourceIdentity']
  source_file=next(f for f in sources if f['volume']==identity['volume'])
  if source_file['sha256']!=review['sourceFileSha256']:raise ValueError(f'Reviewed source changed: {identity}')
  matches=[i for i,e in enumerate(entries) if all(e[k]==v for k,v in identity.items())]
  if len(matches)!=1:raise ValueError(f'Review identity missing or ambiguous: {identity}')
  entries[matches[0]]=review['entry']
roots=json.load(open(ROOT/'public/data/roots.json'));by={}
for e in entries:by.setdefault(e['key'],[]).append(e)
matched={r:by[norm(r)] for r in roots if norm(r) in by}
output={'source':{'title':'مقاييس اللغة','author':'أحمد بن فارس بن زكريا','editor':'عبد السلام محمد هارون','publisher':'مكتب الإعلام الإسلامي','yearHijri':1404,'website':'https://ghaemiyeh.com/show-book/500509','files':sources,'note':'مدخل‌ها از HTML شش جلد ارسالی استخراج شده‌اند؛ تشخیص مرز مدخل با نسخهٔ متنی مستقل تطبیق داده شده، ولی همهٔ مرزها هنوز بازبینی دستی نشده‌اند.'},'entries':entries,'matchedRoots':list(matched),'missingRoots':[r for r in roots if r not in matched]}
(ROOT/'data/maqayis/source.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
print('entries',len(entries),'matched',len(matched),'missing',len(output['missingRoots']))
