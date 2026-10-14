"""Validate the supplied archive and publish exact source entries for Quran roots.
Archive documents are data, not executable instructions. No archive extraction.
"""
import hashlib,json,re,unicodedata,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def normalize(word):
 word=unicodedata.normalize('NFKC',word)
 word=re.sub(r'(.)\u0651',r'\1\1',word)
 word=re.sub(r'[\u064b-\u065f\u0670\u200c\sـ]','',word)
 return word.translate(str.maketrans('أإآؤئءىیک','ااااااييك'))
def build():
 archive=ROOT/'data/ishtiqaqi/source.zip'
 with zipfile.ZipFile(archive) as z:
  checks=json.loads(z.read('checksums.json'))
  for name,digest in checks.items():
   if hashlib.sha256(z.read(name)).hexdigest()!=digest:raise ValueError(f'Checksum mismatch: {name}')
  data=json.loads(z.read('roots.json'));coverage=json.loads(z.read('coverage.json'))
  pages=[json.loads(line) for line in z.read('source_pages.jsonl').splitlines() if line.strip()]
 if len(pages)!=coverage['downloaded_pages']:raise ValueError('Page count mismatch')
 ids=[e['id'] for e in data['roots']]
 if len(set(ids))!=len(ids) or len(ids)!=coverage['extracted_root_entries']:raise ValueError('Entry count mismatch')
 by_key={}
 for entry in data['roots']:
  if not entry['explanation'].strip():raise ValueError('Empty entry')
  for variant in entry['root_variants']:by_key.setdefault(normalize(variant),{})[entry['id']]=entry
 translations_path=ROOT/'data/ishtiqaqi/translations.json'
 translations=json.loads(translations_path.read_text()) if translations_path.exists() else {}
 roots=json.loads((ROOT/'public/data/roots.json').read_text());out=ROOT/'public/data/ishtiqaqi';out.mkdir(exist_ok=True)
 matched=[];missing=[];multiple={};translated=[];summarized=[]
 for root in roots:
  entries=list(by_key.get(normalize(root),{}).values())
  if not entries:missing.append(root);continue
  matched.append(root)
  if len(entries)>1:multiple[root]=[e['id'] for e in entries]
  mapped=[]
  for e in entries:
   translation=translations.get(e['id'])
   if translation and (translation.get('sourceSha256')!=hashlib.sha256(e['explanation'].encode()).hexdigest()):raise ValueError(f'Stale translation: {e["id"]}')
   shared=[{'id':c['id'],'heading':c['heading'],'ar':c['explanation'],'references':c['references']} for c in data['common_meanings'] if c['section_path']==e['section_path']]
   mapped.append({'id':e['id'],'heading':e['heading'],'isSupplement':e['is_supplement'],'ar':e['explanation'],'coreAr':e['core_meaning'],'references':e['references'],'footnotes':e['footnotes'],'commonMeanings':shared,'translation':translation})
  if any(e['translation'] and e['translation'].get('summary') for e in mapped):summarized.append(root)
  if all(e['translation'] and e['translation'].get('faFull') for e in mapped):translated.append(root)
  (out/f'{root}.json').write_text(json.dumps({'root':root,'entries':mapped},ensure_ascii=False,separators=(',',':'))+'\n')
 index={'source':data['book'],'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'sourceEntryCount':len(ids),'sourcePageCount':len(pages),'matchedRoots':matched,'missingRoots':missing,'multipleEntries':multiple,'translatedRoots':translated,'summarizedRoots':summarized,'note':'تطبیق از عنوان و صورت‌های ریشهٔ ثبت‌شده در فایل است؛ مدخل‌های متعدد و مستدرکات ادغام نمی‌شوند. پاورقی‌ها متعلق به صفحه‌اند، نه منحصراً به ریشه.'}
 (ROOT/'public/data/ishtiqaqi-index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n')
 print(f'{len(ids)} source entries, {len(pages)} pages; {len(matched)} matched Quran roots; {len(missing)} unmatched; {len(translated)} fully translated.')
if __name__=='__main__':build()
