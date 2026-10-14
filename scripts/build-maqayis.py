"""Publish only reviewed, translated Maqayis entries; never publish extraction drafts."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'data/maqayis/source.json').read_text())
translations=json.loads((ROOT/'data/maqayis/translations.json').read_text())
roots=json.loads((ROOT/'public/data/roots.json').read_text())
out=ROOT/'public/data/maqayis';out.mkdir(exist_ok=True)
for root,translation in translations.items():
 if root not in roots:raise ValueError(f'Unknown Quran root: {root}')
 matches=[e for e in source['entries'] if e['key']==root]
 if len(matches)!=1:raise ValueError(f'Ambiguous/missing entry: {root}')
 entry=matches[0]
 if translation.get('sourceSha256') and translation['sourceSha256']!=hashlib.sha256(entry['ar'].encode()).hexdigest():raise ValueError(f'Stale translation: {root}')
 record={'root':root,'word':entry['word'],'ar':entry['ar'],**translation,'provenance':{'volume':entry['volume'],'page':entry['page'],'pageEnd':entry['pageEnd'],'pageId':entry['pageId'],'translationKind':'full-author-entry','translationNote':'ترجمهٔ فارسی با کمک هوش مصنوعی از متن کاملِ مدخل نویسنده؛ خلاصه جداست. پاورقی‌های محقق در این ترجمه وارد نشده‌اند.','sourceSha256':next(f['sha256'] for f in source['source']['files'] if f['volume']==entry['volume']),'arabicSha256':hashlib.sha256(entry['ar'].encode()).hexdigest()}}
 (out/f'{root}.json').write_text(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
index={'source':source['source'],'translatedRoots':list(translations),'translatedCount':len(translations),'totalQuranRoots':len(roots),'draftMatchedCount':len(source['matchedRoots']),'pendingRoots':[r for r in roots if r not in translations]}
(ROOT/'public/data/maqayis-index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Published {len(translations)} translated entries; {len(index["pendingRoots"])} roots remain untranslated.')
