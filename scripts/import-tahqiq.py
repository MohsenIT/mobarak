"""Extract the app's paired Arabic/Persian al-Tahqiq entries; regenerate root assets.
Usage: python3 scripts/import-tahqiq.py /path/to/base.apk
No app execution, translation generation, or changes to the source wording.
"""
import hashlib, json, re, struct, sys, unicodedata, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def string_pool(data, base):
    _, header, _, count, _, flags, start, _ = struct.unpack_from('<HHIIIIII', data, base)
    def length(pos, utf8):
        if utf8:
            n = data[pos]
            return (((n & 127) << 8) | data[pos + 1], pos + 2) if n & 128 else (n, pos + 1)
        n = struct.unpack_from('<H', data, pos)[0]
        return (((n & 32767) << 16) | struct.unpack_from('<H', data, pos + 2)[0], pos + 4) if n & 32768 else (n, pos + 2)
    out = []
    for index in range(count):
        pos = base + start + struct.unpack_from('<I', data, base + header + index * 4)[0]
        if flags & 256:
            _, pos = length(pos, True)
            n, pos = length(pos, True)
            out.append(data[pos:pos + n].decode('utf-8'))
        else:
            n, pos = length(pos, False)
            out.append(data[pos:pos + n * 2].decode('utf-16le'))
    return out

def arrays(data):
    pos = struct.unpack_from('<H', data, 2)[0]
    strings, out = [], {}
    while pos < len(data):
        kind, header, size = struct.unpack_from('<HHI', data, pos)
        if not size: raise ValueError('Invalid resource chunk')
        if kind == 1: strings = string_pool(data, pos)
        if kind == 0x200:
            types = string_pool(data, pos + struct.unpack_from('<I', data, pos + 268)[0])
            keys = string_pool(data, pos + struct.unpack_from('<I', data, pos + 276)[0])
            child = pos + header
            while child < pos + size:
                ck, ch, cs = struct.unpack_from('<HHI', data, child)
                if not cs: raise ValueError('Invalid package chunk')
                if ck == 0x201:
                    type_id, flags = struct.unpack_from('<BB', data, child + 8)
                    count, start = struct.unpack_from('<II', data, child + 12)
                    if flags: raise ValueError('Unsupported resource entry offset format')
                    if types[type_id - 1] == 'array':
                        for index in range(count):
                            offset = struct.unpack_from('<I', data, child + ch + index * 4)[0]
                            if offset == 0xffffffff: continue
                            entry = child + start + offset
                            eh, ef, key = struct.unpack_from('<HHI', data, entry)
                            if not ef & 1: continue
                            _, n = struct.unpack_from('<II', data, entry + 8)
                            values = []
                            for j in range(n):
                                _, _, _, typ, value = struct.unpack_from('<IHBBI', data, entry + eh + j * 12)
                                if typ != 3: raise ValueError('Expected literal string array')
                                values.append(strings[value])
                            out[keys[key]] = values
                child += cs
        pos += size
    return out

def normalize(word):
    word = unicodedata.normalize('NFKC', word)
    word = re.sub(r'(.)\u0651', r'\1\1', word)
    word = re.sub(r'[\u064b-\u065f\u0670\u200c\sـ]', '', word)
    return word.translate(str.maketrans({'ی':'ي','ى':'ي','ک':'ك','أ':'ا','إ':'ا','آ':'ا','ؤ':'ا','ئ':'ا','ء':'ا'}))

apk = Path(sys.argv[1])
with zipfile.ZipFile(apk) as archive:
    resource = archive.read('resources.arsc')
    content = arrays(resource)
words, texts = content['orgwords'], content['mani']
if len(texts) != 2 * len(words) or len(set(words)) != len(words): raise ValueError('Entry alignment mismatch')
entries = [{'word': word, 'ar': texts[2*i], 'fa': texts[2*i+1]} for i, word in enumerate(words)]
if any(not e['ar'].strip() or not e['fa'].strip() for e in entries): raise ValueError('Empty definition')
source = {
    'title': 'خلاصهٔ التحقیق فی کلمات القرآن الکریم', 'author': 'حسن مصطفوی',
    'translator': 'صادق عباسی و مجموعهٔ مدارس دانشجویی قرآن و عترت دانشگاه تهران',
    'attributionSource': 'assets/aboutapp.html در اپ التّحقیق (فارسی)',
    'apkSha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
    'resourceSha256': hashlib.sha256(resource).hexdigest(),
    'note': 'متن عربی و ترجمهٔ فارسیِ خلاصهٔ شرح واژگان از APK ارسالی؛ شمارهٔ جلد و صفحه در دادهٔ اپ موجود نیست.'
}
(ROOT / 'data/tahqiq/source.json').write_text(json.dumps({'source': source, 'entries': entries}, ensure_ascii=False, separators=(',', ':')) + '\n')
by_key = {}
for entry in entries: by_key.setdefault(normalize(entry['word']), []).append(entry)
roots = json.loads((ROOT / 'public/data/roots.json').read_text())
assets = ROOT / 'public/data/tahqiq'
assets.mkdir(exist_ok=True)
matched, ambiguous, missing = [], [], []
for root in roots:
    candidates = by_key.get(normalize(root), [])
    if not candidates: missing.append(root); continue
    matched.append(root)
    if len(candidates) > 1: ambiguous.append(root)
    (assets / f'{root}.json').write_text(json.dumps({'root': root, 'entries': candidates}, ensure_ascii=False, separators=(',', ':')) + '\n')
index = {'source': source, 'entryCount': len(entries), 'matchedRoots': matched, 'ambiguousRoots': ambiguous, 'missingRoots': missing}
(ROOT / 'public/data/tahqiq-index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(entries)} paired entries; {len(matched)}/{len(roots)} roots matched, {len(ambiguous)} retain multiple explicitly named candidates, {len(missing)} unmatched.')
