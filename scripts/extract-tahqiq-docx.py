"""Extract paragraphs and author sections from the supplied 14-volume DOCX archive.
Usage: python3 scripts/extract-tahqiq-docx.py archive.zip output.json
"""
import zipfile,io,json,re,xml.etree.ElementTree as ET,unicodedata
from pathlib import Path
import sys
ZIP=sys.argv[1]
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'};W='{'+NS['w']+'}'
def clean(t):return t.replace('\u200f','').replace('\u200e','').strip()
def norm(t):
 t=re.sub(r'(.)\u0651',r'\1\1',unicodedata.normalize('NFKC',clean(t)));t=re.sub(r'[\u064b-\u065f\u0670\sـ:،\[\]«».-]','',t)
 return t.translate(str.maketrans({'ی':'ي','ى':'ي','ک':'ك','أ':'ا','إ':'ا','آ':'ا','ؤ':'ا','ئ':'ا','ء':'ا'}))
entries=[]
with zipfile.ZipFile(ZIP) as z:
 for filename in z.namelist():
  if not filename.endswith('.docx'):continue
  with zipfile.ZipFile(io.BytesIO(z.read(filename))) as d:
   els=ET.fromstring(d.read('word/document.xml')).findall('.//w:body/w:p',NS);rows=[];volume=None;page=None
   for i,el in enumerate(els):
    text=clean(''.join(t.text or '' for t in el.findall('.//w:t',NS)))
    match=re.search(r'ج\s*(\d+).*ص\s*[:؛]?\s*(\d+)',text)
    if match and text.startswith('التحقيق'):volume,page=map(int,match.groups())
    colored=[]
    for run in el.findall('w:r',NS):
     txt=''.join(t.text or '' for t in run.findall('w:t',NS)).strip()
     if not txt:continue
     color=run.find('w:rPr/w:color',NS);colored.append(color.get(W+'val') if color is not None else None)
    blue=bool(colored) and all(c in ['465BFF','7800FA'] for c in colored)
    head=blue and len(norm(text))<=12 and len(text.split()) <= 3 and norm(text)!='والتحقيق' and len(norm(text))>1
    rows.append({'i':i,'text':text,'head':head,'volume':volume,'page':page,'meta':bool(match and text.startswith('التحقيق'))})
   heads=[i for i,r in enumerate(rows) if r['head']]
   for j,start in enumerate(heads):
    end=heads[j+1] if j+1<len(heads) else len(rows);body=rows[start+1:end]
    author=[i for i,r in enumerate(body) if re.sub(r'[ً-ٰٟ\s]', '',r['text']).strip(':')=='والتحقيق']
    section=body[author[0]+1:] if author else body
    content=[r['text'] for r in section if r['text'] and not r['meta']]
    entries.append({'word':rows[start]['text'].strip(':'),'volume':rows[start]['volume'],'page':rows[start]['page'],'pageEnd':body[-1]['page'] if body else rows[start]['page'],'file':filename,'paragraphStart':rows[start]['i'],'paragraphEnd':rows[end]['i'] if end<len(rows) else len(rows),'ar':'\n'.join(content),'authorSection':bool(author)})
Path(sys.argv[2]).write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
print(f'Extracted {len(entries)} entries with volume/page and paragraph references.')
