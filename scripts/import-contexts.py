"""Import the user's context PDF. Requires PyMuPDF (pip install pymupdf).

Column coordinates and the reviewed compound-cell corrections below apply
only to the checked PDF, whose digest is verified before extraction.
"""
import fitz,re,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'public/data/context-source.pdf'
expected=json.loads((ROOT/'public/data/contexts.json').read_text())['source']['sha256']
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:
 raise ValueError('Source PDF changed; review table extraction before importing')
doc=fitz.open(p); current=0; units={}; titles=[]
for pn,page in enumerate(doc):
 if pn==0:continue
 words=page.get_text('words');events=[];done=set();previous_title=None
 for w in words:
  if w[3]-w[1]<17 or not 60<w[1]<785:continue
  row=tuple(x for x in words if abs(x[3]-w[3])<1.1 and x[3]-x[1]>17)
  key=round(w[3],1)
  if key in done:continue
  done.add(key)
  text=' '.join(x[4] for x in sorted(row,key=lambda x:-x[0])); normalized=text.replace(' ','')
  if not normalized.startswith(('سورة','سوره')):continue
  if previous_title and text==previous_title[0] and abs(w[1]-previous_title[1])<4:continue
  previous_title=(text,w[1])
  size=1+sum(x[4]=='و' for x in row)
  events.append((w[1],'title',(text,size)))
 numeric_rows={}
 for w in words:
  if 315<(w[0]+w[2])/2<382 and 90<w[1]<785 and re.fullmatch(r'[0-9-]+',w[4]):
   y=round(w[3],1);numeric_rows.setdefault(y,[]).append(w)
 for y,row in numeric_rows.items():
  value=''.join(w[4] for w in sorted(row,key=lambda w:w[0]))
  if re.fullmatch(r'\d+(?:-\d+)?',value):
   vals=list(map(int,value.split('-')));events.append((min(w[1] for w in row),'range',(vals[0],vals[-1])))
 for y,kind,value in sorted(events):
  if kind=='title':
   title,size=value;current+=1;group=list(range(current,current+size));current=group[-1]
   titles.append((pn+1,group,title));
   for n in group:units[n]={'ranges':[],'sourcePage':pn+1,'sourceHeading':title,'group':group}
  elif current:
   units[current]['ranges'].append({'from':value[0],'to':value[1],'sourcePage':pn+1})
# Compound RTL cells were reviewed against the context column (not the
# daily-reading column). Each pair is a separate context, except Shura's
# aggregate row, whose internal three-way boundaries are not supplied.
fix={
 4:([(170,175),(176,176)],4),10:([(57,70),(71,74)],8),11:([(1,4),(5,24)],8),
 18:([(1,8),(9,21),(22,26)],10),22:([(1,2),(3,16)],11),25:([(1,3),(4,20)],12),
 26:([(1,9),(10,68)],13),40:([(21,22),(23,50)],16),42:([(29,53)],16),
 53:([(1,30)],18),54:([(1,8),(9,46),(47,55)],18)}
for n,(ranges,page) in fix.items():
 rs=units[n]['ranges'];rs=[r for r in rs if r['from']<=r['to']<=1000]
 if n==18:rs=[r for r in rs if r['from']!=26]
 if n==54:rs=[]
 if n==53:rs=[r for r in rs if r['from']!=30]
 rs.extend({'from':a,'to':b,'sourcePage':page} for a,b in ranges)
 rs.sort(key=lambda r:r['from']);units[n]['ranges']=rs
if current!=114 or set(units)!=set(range(1,115)):
 raise ValueError('Incomplete surah headings')
meta=json.loads((ROOT/'public/data/meta.json').read_text())
for n in range(1,115):
 item=units[n];rs=item['ranges'];last=0
 for i,r in enumerate(rs,1):
  if r['from']!=last+1 or not r['from']<=r['to']<=meta['surahs'][n-1]['vc']:
   raise ValueError(f'Invalid or overlapping context in surah {n}: {r}')
  last=r['to'];r['id']=i
  if n==42 and r['from']==29:
   r['sourceLabel']='پنجم و ششم و هفتم'
   r['note']='این ردیف منبع سیاق‌های پنجم تا هفتم را به‌صورت تجمیعی آورده است.'
   r['sourceSegments']=[[29,50],[51,53]]
 if rs and last!=meta['surahs'][n-1]['vc']:
  raise ValueError(f'Incomplete verse coverage in surah {n}')
 item['status']='specified' if rs else 'unspecified'
result={'source':{'title':'سیاق‌بندی اولیه سوره‌های قرآن','publisher':'مؤسسه گفتمان قرآن و ولایت','url':'/data/context-source.pdf','sha256':expected},'surahs':units}
(ROOT/'public/data/contexts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f"Validated {sum(len(x['ranges']) for x in units.values())} contexts in {sum(bool(x['ranges']) for x in units.values())} surahs; no ranges invented for the remaining surahs.")
