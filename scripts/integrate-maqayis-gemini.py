"""Integrate only source-audited, structurally complete Gemini candidates.
Existing translations are preserved. Known failed semantic reviews are withheld.
"""
import hashlib, importlib.util, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOB = Path('/workspace/.translation-jobs/quran-vajeh/gapgpt')

def read(path):
    return json.loads(path.read_text())

def integrate():
    spec = importlib.util.spec_from_file_location('bulk', ROOT/'scripts/gapgpt-dictionary-bulk.py')
    bulk = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bulk)
    audit = read(ROOT/'data/maqayis/source-audit.json')['entries']
    model_path = ROOT/'data/maqayis/model-source-audit.json'
    model_audit = read(model_path)['entries'] if model_path.exists() else {}
    exclusions = read(ROOT/'data/maqayis/source-audit-exclusions.json')['entries']
    reference_path = ROOT.parent/'.translation-jobs/mojam-source/data/maqayis.json'
    references = {}
    reference_file_hash = None
    if model_audit and reference_path.exists():
        reference_file_hash = hashlib.sha256(reference_path.read_bytes()).hexdigest()
        for reference in read(reference_path):
            references.setdefault(bulk.norm(reference['root']), []).append(reference)
    queue = read(JOB/'bulk/queue.json')
    path = ROOT/'data/maqayis/translations.json'
    translations = read(path)
    source = read(ROOT/'data/maqayis/source.json')
    grouped = {}
    for entry in source['entries']:
        grouped.setdefault(entry['key'], []).append(entry)
    added = []
    held = {}
    for entry in queue['entries']:
        root = entry['id']
        if entry['book'] != 'maqayis' or root in translations:
            continue
        folder = bulk.entry_folder(JOB, entry)
        state_path = folder/'state.json'
        state = read(state_path) if state_path.exists() else {}
        if state.get('state') not in ('accepted', 'source_review_required'):
            held[root] = state.get('state', 'pending')
            continue
        matches = grouped.get(entry.get('sourceKey', root), [])
        check = audit.get(root, {})
        machine = model_audit.get(root, {})
        reference_matches = references.get(bulk.norm(entry.get('sourceKey', root)), [])
        if (check.get('verdict') != 'verified' and root not in exclusions
                and len(matches) == 1 and len(reference_matches) == 1
                and machine.get('verdict') == 'pass'
                and machine.get('model') == 'gemini-4-argon'
                and machine.get('sourceComplete') is True
                and machine.get('authorTextAdded') is False
                and machine.get('sourceSha256') == entry['sourceSha256']
                and machine.get('sourceFootnotesSha256') == hashlib.sha256(json.dumps(matches[0].get('footnotes', []),ensure_ascii=False,sort_keys=True).encode()).hexdigest()
                and machine.get('independentFileSha256') == reference_file_hash
                and machine.get('referenceSha256') == hashlib.sha256(reference_matches[0]['text'].encode()).hexdigest()
                and all(d.get('category') in ('editorial', 'orthographic') for d in machine.get('differences', []))):
            check = {**machine, 'verdict':'verified', 'method':'gemini-4-argon-source-concordance'}
        if (len(matches) != 1 or check.get('verdict') != 'verified'
                or check.get('sourceSha256') != entry['sourceSha256']
                or hashlib.sha256(matches[0]['ar'].encode()).hexdigest() != entry['sourceSha256']):
            held[root] = 'source_audit_required'
            continue
        final = folder/'translation-final.json'
        candidate_path = final if final.exists() else folder/'translation.json'
        candidate = read(candidate_path)
        if candidate.get('sourceSha256') != entry['sourceSha256']:
            raise ValueError('Stale candidate: '+root)
        validated = bulk.validate(entry, candidate)
        review = None
        for name in ('review-remediation.json', 'review-final.json', 'review.json'):
            if (folder/name).exists():
                review = read(folder/name)
                break
        if bulk.needs_review(entry) and (not review or review.get('verdict') != 'pass' or review.get('issues')):
            held[root] = 'semantic_review_required'
            continue
        translations[root] = {
            'summary': validated['summary'], 'fa': validated['faFull'],
            'sourceSha256': entry['sourceSha256'],
            'translator': bulk.TRANSLATOR,
            'semanticReview': 'gemini-4-argon:pass' if review else 'not-selected-by-sampling-policy',
            'sourceAudit': check['method'],
        }
        if check['method'] == 'gemini-4-argon-source-concordance':
            translations[root]['sourceAuditModel'] = 'gemini-4-argon'
        for field in ('correctionModel', 'correctionMethod'):
            if candidate.get(field):
                translations[root][field] = candidate[field]
        state.update(state='accepted', sourceVerified=True, sourceAudit=check['method'])
        bulk.save(state_path, state)
        added.append(root)
    if added:
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(translations, ensure_ascii=False, indent=2)+'\n')
        temp.replace(path)
    report = {'added': added, 'held': held, 'totalTranslated': len(translations)}
    bulk.save(JOB/'bulk/integration.json', report)
    print(json.dumps({'addedCount':len(added),'totalTranslated':len(translations),'heldCount':len(held)},ensure_ascii=False))

if __name__ == '__main__':
    integrate()
