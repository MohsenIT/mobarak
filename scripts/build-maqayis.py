"""Publish only reviewed, translated Maqayis entries; never publish extraction drafts."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'data/maqayis/source.json').read_text())
translations=json.loads((ROOT/'data/maqayis/translations.json').read_text())
roots=json.loads((ROOT/'public/data/roots.json').read_text())
mappings=json.loads((ROOT/'data/maqayis/root-mappings.json').read_text())['entries'] if (ROOT/'data/maqayis/root-mappings.json').exists() else {}
reference=json.loads((ROOT/'data/maqayis/reference-source.json').read_text()) if (ROOT/'data/maqayis/reference-source.json').exists() else {'entries':{},'unresolvedRoots':{}}
out=ROOT/'public/data/maqayis';out.mkdir(exist_ok=True)
for root,translation in translations.items():
 if root not in roots:raise ValueError(f'Unknown Quran root: {root}')
 if translation.get('sourceKind')=='independent-reference':
  entry=reference['entries'].get(root)
  if not entry or translation.get('sourceSha256')!=hashlib.sha256(entry['ar'].encode()).hexdigest():raise ValueError(f'Stale independent reference: {root}')
  partial=entry.get('availability')=='reference-fragment-only' or any('defect' in flag for flag in entry.get('qualityFlags',[]))
  note='ترجمهٔ تمام متنِ موجود در نسخهٔ متنی مستقل، شامل متن مؤلف و حواشیِ درج‌شده در مرجع؛ حواشی ممکن است به صفحه یا مدخل مجاور مربوط باشند. جداسازی کامل متن مؤلف از حواشی یا کامل‌بودن اصل کتاب ادعا نمی‌شود. ترجمه با GPT-6 Luna تهیه شده و بازبینی مستقل انسانی نیست.'
  review_model=translation.get('semanticReview','').removesuffix(':pass')
  note+=f' بازبینی معنایی با {review_model} انجام شده است.' if translation.get('semanticReview','').endswith(':pass') else 'این مدخل در نمونهٔ بازبینی معنایی انتخاب نشده؛ پوشش تمام بندها کنترل شده است.'
  if translation.get('repairModels'):note+=' اصلاح ترجمه با '+ '، '.join(translation['repairModels'])+' انجام شده است.'
  if partial:note+=' مأخذ این مدخل دارای افتادگی، ابهام یا خرابی ثبت‌شده است؛ متن نامطمئن نباید به‌عنوان قرائت قطعی استفاده شود.'
  record={'root':root,'word':entry['heading'],'ar':entry['ar'],**translation,'provenance':{'sourceKind':'independent-reference','sourceUrl':entry['provenance']['url'],'translationKind':'partial-reference-entry' if partial else 'full-reference-entry-with-editorial','translationScope':'author-and-editorial','translationNote':note,'sourceSha256':entry['provenance']['fileSha256'],'arabicSha256':entry['sourceSha256'],'referenceRoot':entry['referenceRoot'],'referenceIndex':entry['referenceIndex'],'qualityFlags':entry.get('qualityFlags',[])}}
  if translation.get('repairModels'):record['provenance']['repairModels']=translation['repairModels']
  (out/f'{root}.json').write_text(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
  continue
 mapping=mappings.get(root)
 matches=[e for e in source['entries'] if e['key']==(mapping['sourceKey'] if mapping else root)]
 if len(matches)!=1:raise ValueError(f'Ambiguous/missing entry: {root}')
 entry=matches[0]
 if mapping and mapping['sourceSha256']!=hashlib.sha256(entry['ar'].encode()).hexdigest():raise ValueError(f'Stale root mapping: {root}')
 if translation.get('sourceSha256') and translation['sourceSha256']!=hashlib.sha256(entry['ar'].encode()).hexdigest():raise ValueError(f'Stale translation: {root}')
 record={'root':root,'word':entry['word'],'ar':entry['ar'],**translation,'provenance':{'volume':entry['volume'],'page':entry['page'],'pageEnd':entry['pageEnd'],'pageId':entry['pageId'],'translationKind':'full-author-entry','translationNote':'ترجمهٔ فارسی با کمک هوش مصنوعی از متن کاملِ مدخل نویسنده؛ خلاصه جداست. پاورقی‌های محقق در این ترجمه وارد نشده‌اند.','sourceSha256':next(f['sha256'] for f in source['source']['files'] if f['volume']==entry['volume']),'arabicSha256':hashlib.sha256(entry['ar'].encode()).hexdigest()}}
 if translation.get('translator')=='gemini-3.1-flash-lite':
  semantic='این مدخل با Gemini 4 Argon بازبینی شده است.' if translation.get('semanticReview')=='gemini-4-argon:pass' else 'این مدخل در نمونهٔ بازبینی معنایی انتخاب نشده است؛ کنترل پوشش بندها روی آن انجام شده است.'
  record['provenance']['translationNote']+=' ترجمه با Gemini 3.1 Flash Lite؛ '+semantic+' متن عربیِ مدخل با نسخهٔ متنی مستقل مقابله شده است. این فرایند بازبینی مستقل انسانی نیست.'
  if translation.get('correctionModel')=='gemini-4-argon':record['provenance']['translationNote']+=' اصلاح‌های مشخص این مدخل نیز با Gemini 4 Argon انجام شده‌اند.'
  if translation.get('sourceAuditModel')=='gemini-4-argon':record['provenance']['translationNote']+=' تأیید تطابق مأخذ این مدخل بر پایهٔ بررسی معنایی ماشینیِ Gemini 4 Argon است، نه تطبیق حرف‌به‌حرف یا بازبینی انسانی.'
 if isinstance(entry.get('extractionReview'),dict) and entry['extractionReview'].get('insertion'):
  record['provenance']['translationNote']+=' یک شاهد شعریِ افتاده از متنِ ارسالی، با نقل دقیق از نسخهٔ متنی مستقل بازیابی شده است؛ متن ارسالی و شواهد بازیابی نگهداری شده‌اند.'
 if translation.get('translator')=='gpt-6-luna':record['provenance']['translationNote']+=' ترجمه با GPT-6 Luna؛ '+(f"بازبینی معنایی با {translation['semanticReview'].removesuffix(':pass')} انجام شده است." if translation.get('semanticReview','').endswith(':pass') else 'پوشش همهٔ بندها کنترل شده؛ در نمونهٔ بازبینی معنایی انتخاب نشده است.')+' این فرایند بازبینی مستقل انسانی نیست.'
 if translation.get('repairModels'):record['provenance']['repairModels']=translation['repairModels']
 (out/f'{root}.json').write_text(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
index={'source':source['source'],'translatedRoots':list(translations),'translatedCount':len(translations),'totalQuranRoots':len(roots),'draftMatchedCount':len(source['matchedRoots']),'pendingRoots':[r for r in roots if r not in translations]}
index['unavailableRoots']={r:info['reason'] for r,info in reference.get('unresolvedRoots',{}).items() if r not in translations}
index['unavailableRoots'].update({r:'reference-fragment-only' for r,e in reference['entries'].items() if e.get('availability')=='reference-fragment-only' and r not in translations})
index['availableReferenceCount']=len({r for r,e in reference['entries'].items() if e.get('availability')!='reference-fragment-only'}|set(translations))
(ROOT/'public/data/maqayis-index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Published {len(translations)} translated entries; {len(index["pendingRoots"])} roots remain untranslated.')
