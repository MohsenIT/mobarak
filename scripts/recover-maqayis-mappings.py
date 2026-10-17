"""Recover only unique doubled Quran-root headings with whole-entry concordance.
No source text or translation changes; no fuzzy similarity and no API requests.
"""
import hashlib
import importlib.util
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('maqayis_audit', ROOT/'scripts/audit-maqayis-sources.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
NAMES = dict(zip('ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
    ['الالف','الباء','التاء','الثاء','الجيم','الحاء','الخاء','الدال','الذال','الراء','الزاء','السين','الشين','الصاد','الضاد','الطاء','الظاء','العين','الغين','الفاء','القاف','الكاف','اللام','الميم','النون','الهاء','الواو','الياء']))


def main():
    roots = json.loads((ROOT/'public/data/roots.json').read_text())
    translations = json.loads((ROOT/'data/maqayis/translations.json').read_text())
    source = json.loads((ROOT/'data/maqayis/source.json').read_text())
    independent_path = ROOT.parent/'.translation-jobs/mojam-source/data/maqayis.json'
    raw = independent_path.read_bytes()
    own, independent = defaultdict(list), defaultdict(list)
    for entry in source['entries']:
        own[audit.norm(entry['key'])].append(entry)
    for entry in json.loads(raw):
        independent[audit.norm(entry['root'])].append(entry)
    mapping_path = ROOT/'data/maqayis/root-mappings.json'
    previous = json.loads(mapping_path.read_text()).get('entries', {}) if mapping_path.exists() else {}
    mappings, counts = {}, Counter()
    exclusions = json.loads((ROOT/'data/maqayis/source-audit-exclusions.json').read_text())['entries']
    for root in roots:
        if (root in translations and root not in previous) or len(root) != 3 or root[-1] != root[-2]:
            continue
        counts['doubledUntranslated'] += 1
        key = audit.norm(root[:2])
        if len(own[key]) != 1 or len(independent[key]) != 1:
            counts['notUnique'] += 1
            continue
        entry, comparison = own[key][0], independent[key][0]
        clean, removed = audit.remove_identical_editorial_lines(comparison['text'], entry.get('footnotes', []))
        left, right = audit.full_concordance(entry['ar']), audit.full_concordance(clean)
        if left != right or len(left) < 25:
            counts['fullEntryMismatch'] += 1
            continue
        first = entry['ar'].splitlines()[0]
        expected = NAMES.get(key[0], '') + ' و' + NAMES.get(key[1], '')
        if not expected.strip() or not audit.norm(first).startswith(expected):
            counts['authorLetterHeadingNotExact'] += 1
            continue
        # A weak third radical is an explicit counterexample to biliteral doubling.
        if 'الحرف المعتل' in audit.norm(first) or root in exclusions or key in exclusions or re.search(r'(?:\[\s*\.\.\.\s*\]|بياض|سقط من الأصل|نقص في الأصل|\ufffd|[?؟]{3,})', entry['ar']):
            counts['explicitDefectOrWeakRadical'] += 1
            continue
        if re.search(r'(?:قال|أنشد|وأنشد)\s*[:：]\s*$', entry['ar']):
            counts['unfinishedQuotation'] += 1
            continue
        mappings[root] = {
            'sourceKey': entry['key'], 'sourceSha256': audit.sha(entry['ar']),
            'sourceWord': entry['word'], 'kind': 'doubled-root-biliteral-heading',
            'evidence': {'authorLetterHeading': first, 'expectedAuthorLetters': expected,
                'independentRoot': comparison['root'], 'independentTextSha256': audit.sha(comparison['text']),
                'independentFileSha256': hashlib.sha256(raw).hexdigest(),
                'independentRepository': 'https://github.com/abuyahyo/mojam',
                'independentPath': 'data/maqayis.json',
                'normalizedFullTextSha256': audit.sha(left), 'normalizedLetterCount': len(left),
                'method': 'complete-independent-author-entry-letter-concordance',
                'exactEditorialFootnoteLinesRemoved': removed, 'originalHtmlReplayed': False}}
    output = {'schemaVersion': 1, 'scope': 'Only untranslated Quran roots with repeated final radical; unique biliteral book heading; first two author letter names explicitly match; complete independent text concordance retaining hamza and numbers. Not a translation-quality claim.', 'entries': mappings}
    mapping_path.write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    counts['strongMappings'] = len(mappings)
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == '__main__':
    main()
