"""Reproducible, lossless Quran-root view of the independent Maqayis reference.
NO source emendation, editorial deletion, translation, network or API calls.
Raw reference entries include editorial material and may contain transcription errors.
"""
import argparse,hashlib,json,re,subprocess,unicodedata
from collections import Counter,defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DEFAULT=ROOT.parent/'.translation-jobs/mojam-source/data/maqayis.json'
NAMES={'الهمزة':'ا','الألف':'ا','الالف':'ا','الباء':'ب','التاء':'ت','الثاء':'ث','الجيم':'ج','الحاء':'ح','الخاء':'خ','الدال':'د','الذال':'ذ','الراء':'ر','الزاي':'ز','الزاء':'ز','السين':'س','الشين':'ش','الصاد':'ص','الضاد':'ض','الطاء':'ط','الظاء':'ظ','العين':'ع','الغين':'غ','الفاء':'ف','القاف':'ق','الكاف':'ك','اللام':'ل','الميم':'م','النون':'ن','الهاء':'ه','الواو':'و','الياء':'ي'}

def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def plain(s):return re.sub(r'[\u064b-\u065f\u0670ـ]','',unicodedata.normalize('NFKC',s)).translate(str.maketrans('یک','يك'))
def norm(s):return plain(s).translate(str.maketrans('أإآؤئءى','ااااااي')).replace(' ','')


def heading(entry):
 text=plain(entry['text'][:250]).replace('*',' ');pattern='(?:'+ '|'.join(sorted(NAMES,key=len,reverse=True))+')'
 # Find a contiguous, explicit list of author radical names near the start.
 match=re.search(r'('+pattern+r')(?:\s*و\s*'+pattern+r'){1,3}',text)
 if not match or match.start()>65:return None
 names=re.findall(pattern,match[0]);letters=''.join(NAMES[x] for x in names)
 tail=text[match.end():match.end()+35]
 weak=bool(re.match(r'\s*و?\s*الحرف\s+المعتل',tail))
 return {'quote':match[0]+(re.match(r'\s*و?\s*الحرف\s+المعتل',tail)[0] if weak else ''),'letters':letters,'weakThird':weak,'offsetInPlainPrefix':match.start()}


def proves(root,e):
 h=heading(e)
 if not h:return False
 key=norm(root)
 return h['letters']==key or (len(key)==3 and key[1]==key[2] and h['letters']==key[:2] and not h['weakThird']) or (len(key)==3 and key[-1] in 'اوي' and h['letters']==key[:2] and h['weakThird'])


def spans(text):
 output=[];offset=0
 for line in text.splitlines(keepends=True):
  kind='explicitly-labelled-editorial-line' if re.match(r'^\s*—\s*\([0-9٠-٩۰-۹]+\)',line) else 'unpartitioned-reference-line'
  output.append({'start':offset,'end':offset+len(line),'kind':kind});offset+=len(line)
 assert ''.join(text[x['start']:x['end']] for x in output)==text
 return output


def recover(path):
 raw=path.read_bytes();data=json.loads(raw);roots=json.loads((ROOT/'public/data/roots.json').read_text());by=defaultdict(list)
 for i,e in enumerate(data):by[norm(e['root'])].append((i,e))
 try:commit=subprocess.check_output(['git','-C',str(path.parent.parent),'rev-parse','HEAD'],text=True).strip()
 except subprocess.CalledProcessError:commit=None
 provenance={'repository':'https://github.com/abuyahyo/mojam','commit':commit,'path':'data/maqayis.json','fileSha256':hashlib.sha256(raw).hexdigest(),'title':'مقاييس اللغة','author':'أحمد بن فارس بن زكريا','sourceCollectionClaim':'shamela','printedVolumeOrPage':'not asserted; source JSON page retained only as opaque reference metadata'}
 entries={};unresolved={}
 previous_path=ROOT/'data/maqayis/reference-source.json'
 previous=json.loads(previous_path.read_text()) if previous_path.exists() else {}
 if previous.get('provenance',{}).get('fileSha256')!=provenance['fileSha256']:previous={}
 radical_index=defaultdict(list)
 for i,e in enumerate(data):
  h=heading(e)
  if h and len(h['letters'])>=3:radical_index[h['letters']].append((i,e))
 for root in roots:
  key=norm(root);direct=by.get(key,[]);selected=None;kind=None;others=[]
  if len(direct)==1:selected=direct[0];kind='unique-direct-normalized-heading'
  elif len(direct)>1:
   strong=[x for x in direct if proves(root,x[1])]
   if len(strong)==1:selected=strong[0];kind='duplicate-heading-resolved-by-explicit-author-radicals';others=[x for x in direct if x!=selected]
   elif len(strong)>1:
    primary=[x for x in strong if heading(x[1])['offsetInPlainPrefix']==0]
    if len(primary)==1:selected=primary[0];kind='primary-author-heading-before-parenthesized-editorial-duplicate';others=[x for x in direct if x!=selected]
  if selected is None and len(key)==3 and key[1]==key[2]:
   candidates=[x for x in by.get(key[:2],[]) if proves(root,x[1])]
   if len(candidates)==1:selected=candidates[0];kind='doubled-root-explicit-biliteral-author-heading'
  if selected is None and len(key)==3 and key[-1] in 'اوي':
   candidates=[(i,e) for i,e in enumerate(data) if norm(e['root'])[:2]==key[:2] and heading(e) and heading(e)['weakThird'] and proves(root,e)]
   if len(candidates)==1:selected=candidates[0];kind='weak-third-group-explicit-author-radicals'
  if selected is None:
   candidates=radical_index.get(key,[])
   if len(candidates)==1:selected=candidates[0];kind='exact-author-radicals-recover-misindexed-reference-heading'
  if selected is not None and not heading(selected[1]):
   genuine=[]
   for i,e in enumerate(data):
    if proves(root,e):genuine.append((i,e))
   primary=[x for x in genuine if heading(x[1])['offsetInPlainPrefix']==0]
   if len(primary)==1:selected=primary[0];kind='explicit-author-radicals-replace-editorial-only-fragment'
   elif len(genuine)==1:selected=genuine[0];kind='explicit-author-radicals-replace-editorial-only-fragment'
  prior=previous.get('entries',{}).get(root)
  if prior:
   i=prior['referenceIndex'];e=data[i]
   if prior.get('availability')!='reference-fragment-only' and sha(e['text'])==prior['sourceSha256'] and (norm(e['root'])==key or proves(root,e)):
    selected=(i,e);kind=prior['mappingKind'];others=[x for x in direct if x!=selected]
  if selected is None:
   unresolved[root]={'reason':'ambiguous-independent-entry' if direct else 'no-independent-entry','candidateHeadings':[x[1]['root'] for x in direct],'candidateReferenceIndices':[x[0] for x in direct]};continue
  index,e=selected;ar=e['text'];radicals=heading(e)
  fragment=bool(re.match(r'^\s*\([^)]{1,8}\)\s*[.:،]?',ar)) and not radicals
  flags=[]
  if fragment:flags.append('reference-fragment-without-explicit-author-radical-heading')
  defect_text=plain(ar).translate(str.maketrans('أإآى','اااي'))
  if re.search(r'(?:\ufffd|[?؟]{3,}|(?:في|من)\s+الاصل[^.\n]{0,100}بياض|بياض[^.\n]{0,40}الاصل|سقط من الاصل|نقص في الاصل)',defect_text):flags.append('explicit-source-defect-marker-retained')
  if 'وذلك على أضرب' in ar or 'وسنفسر ذلك' in ar:flags.append('possible-general-section-continuation-retained')
  if norm(root)=='فلح':flags.append('known-shared-transcription-defect-in-poet-name-retained')
  record={'root':root,'heading':e['root'],'referenceRoot':e['root'],'mappingKind':kind,'evidence':{'authorRadicalEvidence':radicals,'exactNormalizedRootMatch':norm(root)==norm(e['root']),'noFuzzyMatching':True},'sourceKey':norm(e['root']),'sourceWord':e['root'],'referenceIndex':index,'ar':ar,'fullReferenceAr':ar,'sourceSha256':sha(ar),'referenceSha256':sha(ar),'scope':'author-and-editorial','scopeDescriptionFa':'تمام متن مدخلِ نسخهٔ متنی مستقل، شامل متن مؤلف و حاشیه‌ها یا ادامه‌های احتمالی؛ جداسازی کامل مؤلف از ویراستار ادعا نمی‌شود.','partitionConfidence':'labels-only-not-complete-author-editor-partition','lineSpans':spans(ar),'matching':{'kind':kind,'authorRadicalEvidence':radicals},'qualityFlags':flags,'issues':flags,'availability':'reference-fragment-only' if fragment else 'complete-reference-entry-available','provenance':dict(provenance,entrySha256=sha(ar),url='https://github.com/abuyahyo/mojam/blob/'+str(commit)+'/data/maqayis.json',originalReferenceMetadata={k:e[k] for k in ('source','page','chapter') if k in e}),'ambiguousAlternates':[{'referenceIndex':i,'root':x['root'],'ar':x['text'],'referenceSha256':sha(x['text']),'selection':'not selected; preserved verbatim alternate/fragment'} for i,x in others]}
  entries[root]=record
 output={'schemaVersion':1,'policy':'Lossless independent-reference recovery ONLY. Every raw character retained. Explicit editor labels are annotations, never deletion. No invented readings; no claim of original six-volume HTML replay or scholarly verification. No translation-quality claim.','provenance':provenance,'counts':{'quranRoots':len(roots),'mappedRoots':len(entries),'completeReferenceEntries':sum(e['availability']=='complete-reference-entry-available' for e in entries.values()),'referenceFragments':sum(e['availability']=='reference-fragment-only' for e in entries.values()),'unresolvedRoots':len(unresolved),'uniqueSelectedReferenceArticles':len({e['referenceIndex'] for e in entries.values()}),'matchingKinds':dict(Counter(e['matching']['kind'] for e in entries.values()))},'entries':entries,'unresolvedRoots':unresolved}
 (ROOT/'data/maqayis/reference-source.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps(output['counts'],ensure_ascii=False))


def self_test():
 assert heading({'text':'العين والدال أصل واحد'})['letters']=='عد'
 assert proves('عدد',{'text':'العين والدال أصل واحد'})
 assert not proves('عدل',{'text':'العين والدال أصل واحد'})
 assert proves('دعو',{'text':'الدال والعين والحرف المعتل أصل واحد'})
 assert not proves('دعو',{'text':'الدال والعين والهمزة أصل واحد'})
 assert norm('شيء')=='شيا' and norm('سوء')=='سوا'
 assert proves('ترك',{'text':'التاء * والراء والكاف أصل واحد'})
 text='قال المؤلف\n— (١) حاشية\nتابع مجهول\n'
 a=spans(text);assert ''.join(text[x['start']:x['end']] for x in a)==text
 assert a[1]['kind']=='explicitly-labelled-editorial-line' and a[2]['kind']=='unpartitioned-reference-line'
 print('7 lossless recovery/explicit-radical tests passed')

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,default=DEFAULT);p.add_argument('--self-test',action='store_true');a=p.parse_args()
 if a.self_test:self_test()
 else:recover(a.reference)
