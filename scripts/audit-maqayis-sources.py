"""Conservative, reproducible audit against supplied original HTML (no API calls).
Missing originals never count as a passed audit. This does not certify translation.
Run: python3 scripts/audit-maqayis-sources.py [--html-dir DIRECTORY] [--self-test]
"""
import argparse
import hashlib
import json
import re
import unicodedata
import subprocess
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


def norm(text):
    text = unicodedata.normalize('NFKC', text)
    text = re.sub(r'(.)\u0651', r'\1\1', text)
    text = re.sub(r'[\u064b-\u065f\u0670\u200cـ]', '', text)
    return text.translate(str.maketrans('أإآىیک', 'اااييك'))


def letters(text):
    return re.sub(r'[^\u0621-\u064a]', '', norm(text))


def full_concordance(text):
    """Keep Arabic letters (including hamza) and quantities; remove only typography.
    Parenthesized numeric footnote calls are editorial, not lexical text.
    """
    text = unicodedata.normalize('NFKC', text)
    text = text.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩یک', '01234567890123456789يك'))
    # Preserve hamza phoneme while equating conventional final seat spellings.
    text = text.replace('ىء', 'ئ').replace('يء', 'ئ')
    text = re.sub(r'\(\s*[0-9]+\s*(?:\)|﴾)', '', text)
    text = re.sub(r'[\u064b-\u065f\u0670ـ]', '', text)
    # Whole conventional Prophetic blessings differ by publisher's family invocation.
    # Require complete phrase, retain common blessing; never drop isolated وآله.
    text = re.sub(r'(?<![ء-ي])صل[ىي]\s+الله\s+عليه\s+(?:و\s*آله\s+)?وسلم(?![ء-ي])', 'صلى الله عليه وسلم', text)
    return re.sub(r'[^\u0621-\u064a0-9]', '', text)


def editorial_concordance(text):
    """Bibliographic volume:page values are RTL-reordered across editions.
    Only numeric parenthesized citation groups in EDITORIAL notes are reordered.
    All values and multiplicity are preserved; author text never uses this helper.
    """
    text = unicodedata.normalize('NFKC', text).translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'))
    text = re.sub(r'\(\s*([0-9\s:/]+[:/][0-9\s:/]+)\s*\)',
                  lambda m: '[' + ':'.join(sorted(re.findall(r'[0-9]+', m[1]))) + ']', text)
    return full_concordance(text)


def remove_identical_editorial_lines(text, footnotes):
    """Only delete a dash-labelled entire line exactly composed of known footnotes.
    No prefix match: an appended author sentence prevents deletion.
    """
    known = [editorial_concordance(re.sub(r'^\s*[0-9٠-٩۰-۹]+\)\s*', '', f['text'])) for f in footnotes]
    known = [x for x in known if x]
    kept, removed = [], []
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if not re.match(r'^\s*—\s*\([0-9٠-٩۰-۹]+\)', line):
            kept.append(line)
            index += 1
            continue
        consumed = 0
        # Exact known editorial material may wrap over multiple physical lines.
        # No prefix deletion: the entire chosen span must segment into whole notes.
        for count in range(1, min(20, len(lines)-index)+1):
            span = '\n'.join(lines[index:index+count])
            value = editorial_concordance(span)
            reachable = {0}
            for i in range(len(value)+1):
                if i in reachable:
                    for item in known:
                        if value.startswith(item, i):
                            reachable.add(i + len(item))
            if value and len(value) in reachable:
                removed.append({'lineSha256': sha(span), 'lineCount': count, 'normalizedTextSha256': sha(value)})
                consumed = count
                break
        if consumed:
            index += consumed
        else:
            kept.append(line)
            index += 1
    return '\n'.join(kept), removed


class Blocks(HTMLParser):
    """Include author list items, unlike the old p-only importer."""
    def __init__(self):
        super().__init__()
        self.stack, self.records = [], []
        self.page = 0
        self.active = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'div' and attrs.get('class') == 'page':
            self.page += 1
        self.stack.append((tag, attrs))
        if self.active is None and self.page and tag in ('p', 'li', 'h2', 'h3'):
            self.active = {'kind': tag, 'page': self.page, 'parts': [],
                           'depth': len(self.stack), 'footnote': any(
                               'footnote' in a.get('class', '') for _, a in self.stack)}

    def handle_data(self, text):
        if self.active is not None:
            self.active['parts'].append(text)

    def handle_endtag(self, tag):
        if self.active is not None and tag == self.active['kind']:
            a = self.active
            if len(self.stack) == a['depth']:
                text = ''.join(a.pop('parts')).strip()
                a.pop('depth')
                if text:
                    a['text'] = text
                    self.records.append(a)
                self.active = None
        for i in range(len(self.stack)-1, -1, -1):
            if self.stack[i][0] == tag:
                self.stack = self.stack[:i]
                break


def boundary(record, hints):
    if record['footnote'] or record['kind'] not in ('p', 'li'):
        return None
    parts = record['text'].split(maxsplit=1)
    if len(parts) != 2:
        return None
    key, body = norm(parts[0]), parts[1]
    # An exact substantial independent-edition prefix is required, not fuzzy similarity.
    for hint in hints.get(key, []):
        prefix = letters(hint['prefix'])
        if len(prefix) >= 35 and letters(body).startswith(prefix[:100]):
            return {'key': key, 'body': body, 'prefixLength': min(100, len(prefix))}
    return None


def inspect(entry, records, hints):
    reasons, evidence = [], {}
    starts = []
    for i, record in enumerate(records):
        parts = record['text'].split(maxsplit=1)
        if (not record['footnote'] and record['page'] == entry['page'] and
                len(parts) == 2 and parts[0] == entry['word'] and
                parts[1] == entry['paragraphs'][0]['text']):
            starts.append(i)
    if len(starts) != 1:
        return ['original_start_missing_or_ambiguous'], evidence
    start = starts[0]
    evidence['startRecord'] = start
    first_boundary = boundary(records[start], hints)
    if first_boundary is None or first_boundary['key'] != entry['key']:
        reasons.append('start_not_exact_independent_prefix')
    stop, next_boundary = None, None
    for i in range(start + 1, len(records)):
        rec = records[i]
        b = boundary(rec, hints)
        if b or rec['kind'] in ('h2', 'h3'):
            stop, next_boundary = i, b
            break
    if stop is None:
        return reasons + ['no_independently_identified_end'], evidence
    evidence.update(endExclusiveRecord=stop, nextText=records[stop]['text'],
                    nextPage=records[stop]['page'], nextRoot=next_boundary and next_boundary['key'])
    # A section title alone is not sufficient evidence of the next root boundary.
    if next_boundary is None:
        reasons.append('section_boundary_needs_manual_review')
    actual = [{'page': records[start]['page'], 'text': records[start]['text'].split(maxsplit=1)[1]}]
    actual += [{'page': r['page'], 'text': r['text']} for r in records[start+1:stop]
               if not r['footnote'] and r['kind'] in ('p', 'li')]
    evidence['originalParagraphRecords'] = [i for i in range(start, stop)
        if not records[i]['footnote'] and records[i]['kind'] in ('p', 'li')]
    if actual != entry['paragraphs']:
        reasons.append('author_paragraph_sequence_differs_including_lists')
    if '\n\n'.join(p['text'] for p in entry['paragraphs']) != entry['ar']:
        reasons.append('stored_ar_paragraph_mismatch')
    # Explicit placeholders or a verse promised but absent are not complete author text.
    ar = entry['ar']
    if re.search(r'(?:\[\s*\.\.\.\s*\]|…|\.{3,}|بياض|سقط من الأصل|نقص في الأصل)', ar):
        reasons.append('possible_lacuna_marker')
    for index, para in enumerate(actual):
        if re.search(r'(?:أنشد|وأنشد|قال الشاعر|قال)\s*[:：]\s*$', para['text']):
            if index + 1 == len(actual) or actual[index+1]['text'].startswith(('قال الخليل', 'قال ابن', 'ومن', 'وأما')):
                reasons.append('possible_missing_author_quotation')
    return sorted(set(reasons)), evidence


def self_test():
    hint = {'prefix': 'الباء والسين والميم أصل واحد وهو انفتاح مقدم الفم لسرور'}
    hints = {'بسم': [hint], 'قسط': [{'prefix': 'القاف والسين والطاء أصلان صحيحان متضادان والمعنى معروف'}]}
    body = hint['prefix']
    end = 'قسط ' + hints['قسط'][0]['prefix']
    parser = Blocks()
    parser.feed('<div class="page" id="a"><p>بسم '+body+'</p><li>شاهد شعري</li><p>'+end+'</p></div>')
    entry = {'page': 1, 'word': 'بسم', 'key': 'بسم', 'paragraphs': [{'page': 1, 'text': body}, {'page': 1, 'text': 'شاهد شعري'}], 'ar': body+'\n\nشاهد شعري'}
    assert inspect(entry, parser.records, hints)[0] == []
    truncated = dict(entry, paragraphs=entry['paragraphs'][:1], ar=body)
    assert 'author_paragraph_sequence_differs_including_lists' in inspect(truncated, parser.records, hints)[0]
    contaminated = dict(entry, paragraphs=entry['paragraphs']+[{'page': 1, 'text': end}], ar=entry['ar']+'\n\n'+end)
    assert 'author_paragraph_sequence_differs_including_lists' in inspect(contaminated, parser.records, hints)[0]
    assert 'no_independently_identified_end' in inspect(entry, parser.records[:-1], hints)[0]
    assert full_concordance('عشرون ٢٠ درهما') != full_concordance('عشرون ٣٠ درهما')
    assert full_concordance('سأل') != full_concordance('سال')
    assert full_concordance('كَتَبَ (١)') == full_concordance('كتب (2)')
    footnotes = [{'text': '1) هذا بيان المحقق.'}]
    clean, removed = remove_identical_editorial_lines('نص المؤلف\n— (١) هذا بيان المحقق.', footnotes)
    assert clean == 'نص المؤلف' and len(removed) == 1
    clean, removed = remove_identical_editorial_lines('نص المؤلف\n— (١) هذا بيان المحقق. كلام المؤلف المفقود', footnotes)
    assert not removed and 'المفقود' in clean
    assert full_concordance('شىء بريء') == full_concordance('شئ برئ')
    assert editorial_concordance('اللسان (2 : 415)') == editorial_concordance('اللسان (415: 2)')
    assert editorial_concordance('اللسان (2 : 415)') != editorial_concordance('اللسان (415: 3)')
    assert full_concordance('اللسان (2 : 415)') != full_concordance('اللسان (415: 2)')
    assert full_concordance('رسول الله صلى اللّه عليه وآله وسلم قال') == full_concordance('رسول الله صلى الله عليه وسلم قال')
    assert full_concordance('قال وآله') != full_concordance('قال')
    assert full_concordance('صلى الله عليه وآله فقط') != full_concordance('صلى الله عليه فقط')
    assert full_concordance('الآية (١﴾') == full_concordance('الآية (1)')
    clean, removed = remove_identical_editorial_lines('نص المؤلف\n— (١) هذا بيان\nالمحقق.', footnotes)
    assert clean == 'نص المؤلف' and removed[0]['lineCount'] == 2
    clean, removed = remove_identical_editorial_lines('نص المؤلف\n— (١) هذا بيان\nكلام آخر', footnotes)
    assert not removed
    print('19 adversarial boundary/quantity/hamza/footnote/honorific tests passed')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--html-dir', type=Path)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--independent-source', type=Path, default=ROOT.parent/'.translation-jobs/mojam-source/data/maqayis.json')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    source = json.loads((ROOT/'data/maqayis/source.json').read_text())
    hints = {}
    for item in json.loads((ROOT/'data/maqayis/boundary-hints.json').read_text())['entries']:
        hints.setdefault(norm(item['root']), []).append(item)
    roots = json.loads((ROOT/'public/data/roots.json').read_text())
    entries = {}
    for entry in source['entries']:
        entries.setdefault(entry['key'], []).append(entry)
    volumes, files = {}, {}
    for item in source['source']['files']:
        matches = list(args.html_dir.rglob(item['file'])) if args.html_dir and args.html_dir.exists() else []
        if len(matches) != 1:
            files[item['volume']] = {'status': 'original_html_missing', 'expectedSha256': item['sha256']}
            continue
        raw = matches[0].read_bytes()
        actual = hashlib.sha256(raw).hexdigest()
        files[item['volume']] = {'status': 'matched' if actual == item['sha256'] else 'sha256_mismatch', 'expectedSha256': item['sha256'], 'actualSha256': actual}
        if actual == item['sha256']:
            p = Blocks()
            p.feed(raw.decode())
            volumes[item['volume']] = p.records
    independent = {}
    independent_evidence = {}
    if args.independent_source.exists():
        independent_raw = args.independent_source.read_bytes()
        for entry in json.loads(independent_raw):
            independent.setdefault(norm(entry['root']), []).append(entry)
        try:
            commit = subprocess.check_output(['git', '-C', str(args.independent_source.parent.parent), 'rev-parse', 'HEAD'], text=True).strip()
        except subprocess.CalledProcessError:
            commit = None
        independent_evidence = {'fileSha256': hashlib.sha256(independent_raw).hexdigest(), 'repository': 'https://github.com/abuyahyo/mojam', 'commit': commit, 'path': 'data/maqayis.json'}
    exclusions = json.loads((ROOT/'data/maqayis/source-audit-exclusions.json').read_text())['entries']
    mapping_path = ROOT/'data/maqayis/root-mappings.json'
    mappings = json.loads(mapping_path.read_text()).get('entries', {}) if mapping_path.exists() else {}
    report = {}
    for root in roots:
        mapping = mappings.get(root)
        source_key = mapping['sourceKey'] if mapping else norm(root)
        candidates = entries.get(source_key, [])
        if mapping and (len(candidates) != 1 or sha(candidates[0]['ar']) != mapping['sourceSha256']):
            candidates = []
        item = {'verdict': 'needs_review', 'reasons': []}
        if len(candidates) != 1:
            item['reasons'] = ['source_entry_missing_or_ambiguous']
        else:
            entry = candidates[0]
            item.update(sourceSha256=sha(entry['ar']), volume=entry['volume'], sourceFileSha256=files[entry['volume']]['expectedSha256'])
            if entry['volume'] not in volumes:
                item['reasons'] = [files[entry['volume']]['status']]
            else:
                item['reasons'], item['evidence'] = inspect(entry, volumes[entry['volume']], hints)
                if not item['reasons']:
                    item['verdict'] = 'verified'
        # Alternate independent FULL entry comparison: no prefix/fuzzy matching, no
        # deletion of footnotes or other Arabic words. Only Arabic letters remain;
        # punctuation, whitespace, harakat, numeric reference markers are ignored.
        # This certifies concordance, explicitly NOT replay against original HTML.
        independent_matches = independent.get(source_key, [])
        if item['verdict'] != 'verified' and len(candidates) == 1 and len(independent_matches) == 1:
            entry, comparison = candidates[0], independent_matches[0]
            independent_body, removed = remove_identical_editorial_lines(comparison['text'], entry.get('footnotes', []))
            left, right = full_concordance(entry['ar']), full_concordance(independent_body)
            incomplete = bool(re.search(r'(?:\[\s*\.\.\.\s*\]|بياض|سقط من الأصل|نقص في الأصل)', entry['ar']))
            incomplete |= bool(re.search(r'(?:قال|أنشد|وأنشد)\s*[:：]\s*$', entry['ar']))
            if left == right and len(left) >= 25 and not incomplete:
                item.update(verdict='verified', reasons=[], method='complete-independent-author-entry-letter-concordance', evidence={
                    'independentSource': independent_evidence,
                    'independentRoot': comparison['root'],
                    'independentTextSha256': sha(comparison['text']),
                    'normalizedFullTextSha256': sha(left),
                    'normalizedLetterCount': len(left),
                    'normalization': 'NFKC; harakat/tatweel removed; Persian ya/kaf normalized; final ya+hamza spelling equated to seated hamza (hamza retained); entire conventional Prophetic blessing with/without family invocation equated (not isolated words); decimal digits normalized AND retained except parenthesized numeric footnote calls (including malformed closing Quran quote ﴾); every Arabic base letter including hamza retained; no Arabic-word deletions',
                    'originalHtmlReplayed': False, 'rootMapping': mapping, 'exactEditorialFootnoteLinesRemoved': removed, 'editorialCitationNormalization': 'Only within removed known editorial notes: parenthesized numeric volume/page citation values compared as sorted multisets, preserving every number and multiplicity; author text digits never reordered'})
        if len(candidates) == 1:
            entry = candidates[0]
            exclusion = exclusions.get(root)
            if exclusion and exclusion['sourceSha256'] == sha(entry['ar']):
                item.update(verdict='needs_review', reasons=['explicit_observed_source_defect'], sourceDefect=exclusion)
            if '\ufffd' in entry['ar'] or re.search(r'[?؟]{3,}', entry['ar']):
                item.update(verdict='needs_review', reasons=sorted(set(item['reasons'] + ['explicit_corrupt_character_marker'])))
        item.setdefault('method', 'original-html-complete-block-boundary-audit')
        report[root] = item
    output = {'schemaVersion': 1, 'method': 'Per-entry methods: original HTML file SHA plus exact complete p/li block sequence and independent boundary prefixes when files available; otherwise complete independent-entry concordance, removing only entire explicitly labelled editorial lines identical to recorded source footnotes. No translation-quality claim.', 'sourceFiles': files, 'counts': dict(Counter(r['verdict'] for r in report.values())), 'entries': report}
    (ROOT/'data/maqayis/source-audit.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(output['counts']))


if __name__ == '__main__':
    main()
