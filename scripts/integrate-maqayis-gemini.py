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
        matches = grouped.get(root, [])
        check = audit.get(root, {})
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
