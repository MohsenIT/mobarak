"""Attach the reviewed translations to exact DOCX entries and reproducible source references.
Usage: python3 scripts/prepare-tahqiq-supplement.py archive.zip extracted-entries.json
"""
import hashlib, json, re, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1]);book=json.loads(Path(sys.argv[2]).read_text())
fa=json.loads((ROOT/'data/tahqiq/supplement-fa.json').read_text())
mapping=json.loads((ROOT/'data/tahqiq/supplement-map.json').read_text())
plain=lambda text: re.sub(r'[\u064b-\u065f\u0670]', '',text)
with zipfile.ZipFile(archive) as z: hashes={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.endswith('.docx')}
entries={}
for root,heading in mapping.items():
    candidates=[e for e in book if e['word']==heading]
    if len(candidates)!=1:raise ValueError(f'Ambiguous source heading: {root} -> {heading}')
    e=candidates[0];ar=e['ar'];word=heading
    if root=='لوت':
        lines=ar.splitlines();start=next(i for i,line in enumerate(lines) if plain(line).startswith('و أما لات:'))
        ar='\n'.join(lines[start:]);word='لات'
    if root=='هات':
        lines=ar.splitlines();start=next(i for i,line in enumerate(lines) if 'يستعمل بالتاء' in plain(line))
        ar='\n'.join(lines[start:start+2]+[l for l in lines[start+2:] if 'أن كلمة ها' in plain(l) or 'فتدل على الإيتاء' in plain(l)]);word='هات'
    if root=='قنطر':
        lines=ar.splitlines();start=next(i for i,line in enumerate(lines) if 'و القنطار:' in plain(line))
        end=next(i for i,line in enumerate(lines[start+1:],start+1) if 'من أقطار' in plain(line))
        ar='\n'.join(lines[start:end]);word='قنطار'
    if root=='قسطس':
        lines=ar.splitlines();start=next(i for i,line in enumerate(lines) if plain(line).startswith('و أما القسطاس:'))
        ar='\n'.join(lines[start:]);word='قسطاس'
    word={'صفصف':'صفصف','زلزل':'زلزل','ذبذب':'ذبذب','ترق':'التراقي'}.get(root,word)
    entries[root]={'word':word,'ar':ar,'fa':fa[root], 'provenance':{
        'kind':'translated-summary','translator':'ترجمه و تلخیص فارسی از متن عربی با کمک هوش مصنوعی',
        'title':'التحقیق فی کلمات القرآن الکریم','author':'حسن مصطفوی',
        'volume':e['volume'],'page':e['page'],'pageEnd':e['pageEnd'],'heading':heading,
        'file':e['file'],'fileSha256':hashes[e['file']],
        'paragraphStart':e['paragraphStart'],'paragraphEnd':e['paragraphEnd']},'sourceArabic':e['ar']}
source={'title':'التحقیق فی کلمات القرآن الکریم','author':'حسن مصطفوی',
        'publisher':'دار الکتب العلمیة ـ مرکز نشر آثار علامه مصطفوی','edition':'سوم',
        'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':hashes,
        'translationNote':'ترجمهٔ خلاصهٔ اصل واحد و بحث کاربردهای مربوط به ۸۸ ریشه؛ متن عربی مأخذ و ارجاع مدخل محفوظ است. نمونه‌های قرآن از دادهٔ آیه‌بندی‌شدهٔ سایت نقل می‌شوند، نه از شماره‌های چاپی در متن کتاب.'}
(ROOT/'data/tahqiq/supplement-source.json').write_text(json.dumps({'source':source,'entries':entries},ensure_ascii=False,indent=2)+'\n')
print(f'Prepared {len(entries)} source-linked translations.')
