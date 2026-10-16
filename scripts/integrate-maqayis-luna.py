"""Publish accepted Luna candidates without replacing existing valid entries."""
import hashlib,importlib.util,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('luna',ROOT/'scripts/finish-maqayis-luna.py');luna=importlib.util.module_from_spec(spec);spec.loader.exec_module(luna)

def integrate():
 path=ROOT/'data/maqayis/translations.json';translations=luna.bulk.read(path);roots=luna.bulk.read(ROOT/'public/data/roots.json');added=[];held={}
 for item in luna.bulk.read(luna.WORK/'ready.json',[]):
  e=item['entry'];root=e['id']
  existing=translations.get(root)
  if existing and not (e.get('referenceSource') and existing.get('translator')==luna.MODEL and existing.get('sourceSha256')==e['sourceSha256']):continue
  if e.get('availability')=='reference-fragment-only':held[root]='editorial_fragment_not_author_article';continue
  if root not in roots or not luna.source_valid(e):held[root]='source_changed';continue
  folder=luna.folder(e);state=luna.bulk.read(folder/'state.json',{})
  if state.get('state')!='accepted' or state.get('sourceSha256')!=e['sourceSha256']:held[root]='not_accepted';continue
  candidate=luna.bulk.read(Path(item['candidatePath']));review=luna.bulk.read(Path(item['reviewPath']))
  validated=luna.bulk.validate(e,candidate)
  if candidate.get('sourceSha256')!=e['sourceSha256']:raise ValueError('stale_candidate')
  editorial={p['id'] for p in e.get('units',[]) if p.get('kind')=='explicitly-labelled-editorial-line' and re.match(r'^\s*—\s*\([0-9٠-٩۰-۹]+\)',p['ar'])}
  formatted='\n\n'.join(('حاشیهٔ نسخهٔ متنی: '+p['fa'] if p['id'] in editorial and not p['fa'].lstrip().startswith('حاشیه') else p['fa']) for p in validated['paragraphs'])
  if existing:
   if existing['fa']==validated['faFull'] and existing['fa']!=formatted:
    existing['fa']=formatted;existing['editorialLabels']='explicit-source-line-labels'
   continue
  if candidate.get('sourceSha256')!=e['sourceSha256']:raise ValueError('stale_candidate')
  if review.get('verdict') not in ('pass','not_selected') or (review.get('verdict')=='pass' and review.get('issues')):held[root]='semantic_review';continue
  if luna.require_review(e,False) and review.get('verdict')!='pass':held[root]='required_semantic_review';continue
  reviewer=review.get('reviewerModel') or state.get('reviewerModel')
  if reviewer==luna.PREVIOUS_REVIEWER:held[root]='reviewer_recheck_required';continue
  t={'summary':validated['summary'],'fa':formatted,'sourceSha256':e['sourceSha256'],'translator':luna.MODEL,'semanticReview':str(reviewer)+':pass' if review['verdict']=='pass' else 'not-selected-by-sampling-policy','reviewScope':review.get('scope'),'sourceAudit':'exact-indexed-independent-reference-entry' if e.get('referenceSource') else 'strict-source-audit'}
  if e.get('referenceSource'):t.update(sourceKind='independent-reference',referenceIndex=e['sourceValidation']['referenceIndex'],translationScope='author-and-editorial')
  translations[root]=t;added.append(root)
 luna.bulk.save(path,translations)
 luna.bulk.save(luna.WORK/'integration.json',{'added':added,'held':held,'totalTranslated':len(translations),'atUtc':luna.bulk.now()})
 print(json.dumps({'added':len(added),'totalTranslated':len(translations),'held':len(held)}))

if __name__=='__main__':integrate()
