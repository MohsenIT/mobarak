"""Import the user-supplied Noor export without executing any archive contents.

Usage: python scripts/import-mizan.py /path/to/mizan.zip
Only paragraph markup is accepted. Exact source HTML hashes retain provenance;
consecutive identical entries share a passage without inventing verse boundaries.
"""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent


class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag != 'p' or attrs:
            raise ValueError(f'Unexpected source markup: {tag}')

    def handle_endtag(self, tag):
        if tag != 'p':
            raise ValueError(f'Unexpected source markup: {tag}')
        self.parts.append('\n\n')

    def handle_data(self, data):
        self.parts.append(data)


def main(archive):
    meta = json.loads((ROOT / 'public/data/meta.json').read_text())
    destination = ROOT / 'public/data/mizan'
    destination.mkdir(parents=True, exist_ok=True)
    counts = []
    total_bytes = 0
    unique_hashes = set()
    with zipfile.ZipFile(archive) as bundle:
        expected = {f'trans/{s["n"]}.json' for s in meta['surahs']}
        if set(bundle.namelist()) != expected or len(bundle.namelist()) != 114:
            raise ValueError('Expected exactly 114 surah files')
        for surah in meta['surahs']:
            rows = json.loads(bundle.read(f'trans/{surah["n"]}.json'))
            if set(rows) != {str(a) for a in range(1, surah['vc'] + 1)}:
                raise ValueError('Missing or unexpected ayahs')
            passages = []
            previous = None
            for a in range(1, surah['vc'] + 1):
                if set(rows[str(a)]) != {'mizan'}:
                    raise ValueError('Unexpected source fields')
                source = rows[str(a)]['mizan']
                if not isinstance(source, str) or not source.strip():
                    raise ValueError('Empty commentary')
                digest = hashlib.sha256(source.encode()).hexdigest()
                unique_hashes.add(digest)
                if previous == source:
                    passages[-1]['to'] = a
                else:
                    parser = Paragraphs()
                    parser.feed(source)
                    text = ''.join(parser.parts).strip()
                    if not text:
                        raise ValueError('Empty parsed commentary')
                    passages.append({'from': a, 'to': a, 'sourceSha256': digest, 'text': text})
                previous = source
            payload = json.dumps({'surah': surah['n'], 'verses': surah['vc'], 'passages': passages}, ensure_ascii=False, separators=(',', ':')).encode()
            (destination / f'{surah["n"]}.json').write_bytes(payload)
            total_bytes += len(payload)
            counts.append({'surah': surah['n'], 'verses': surah['vc'], 'passages': len(passages), 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
    catalogue = {'id': 'mizan', 'title': 'ترجمهٔ تفسیر المیزان', 'creator': 'سید محمدحسین طباطبایی', 'language': 'fa', 'source': 'https://quran.inoor.ir/', 'archiveSha256': hashlib.sha256(Path(archive).read_bytes()).hexdigest(), 'verses': sum(s['vc'] for s in meta['surahs']), 'uniqueSourceTexts': len(unique_hashes), 'bytes': total_bytes, 'surahs': counts}
    (destination / 'catalogue.json').write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n')
    print(f'Mizan: {catalogue["verses"]} ayahs, {sum(s["passages"] for s in counts)} source-linked ranges, {total_bytes} bytes')


if __name__ == '__main__':
    main(sys.argv[1])
