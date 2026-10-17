"""Finish remaining entries using paid cached translations and bounded Flash repairs.

All requests share the historical ledger; uncertain requests are never retried.
Restarting reuses each known billed response. No canonical entry bypasses review.
"""
import concurrent.futures
import fcntl
import importlib.util
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('workflow', ROOT / 'scripts/run-maqayis-completion.py')
workflow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workflow)
luna = workflow.luna
bulk = luna.bulk
os.environ['QURAN_TRANSLATION_BUDGET_USD'] = workflow.ENV['QURAN_TRANSLATION_BUDGET_USD']
STAGE = 'completion-v3'


def finish(entry, key, ledger):
    own = luna.folder(entry)
    if not luna.source_valid(entry):
        raise ValueError('source_changed')
    if (own / (STAGE + '-result.json')).exists():
        return
    try:
        # Reuse the latest fully audited candidate and its outstanding issues.
        candidate = bulk.read(own / 'resume-config-v2-candidate-3.json')
        review = bulk.read(own / 'resume-config-v2-audit-3.json') if candidate else None
        if candidate:
            bulk.validate(entry, candidate)
            if candidate.get('sourceSha256') != entry['sourceSha256']:
                raise ValueError('stale_candidate')
        else:
            # This exact paid stage is cached for the 22 conjunction failures.
            candidate = luna.translate(entry, key, ledger, 'resume-config-v2-translate')
        for turn in range(4):
            if bulk.STOP.is_set():
                return
            if review and review['verdict'] == 'needs_revision':
                candidate, _ = luna.repair_issues(
                    entry, candidate, review, key, ledger,
                    f'{STAGE}-repair-{turn}', translation_model=luna.REVIEWER)
            bulk.save(own / f'{STAGE}-candidate-{turn}.json', candidate)
            review = luna.audit(entry, candidate, key, ledger,
                                f'{STAGE}-audit-{turn}', reviewer=luna.REVIEWER)
            if review['verdict'] == 'pass':
                if not luna.source_valid(entry):
                    raise ValueError('source_changed')
                bulk.save(own / 'candidate.json', candidate)
                bulk.save(own / 'review.json', review)
                bulk.save(own / 'state.json', {
                    'state': 'accepted', 'sourceSha256': entry['sourceSha256'],
                    'translatorModel': luna.MODEL, 'reviewerModel': luna.REVIEWER,
                    'reviewPolicy': 'full-entry-final-flash-audit', 'updatedAtUtc': bulk.now()})
                bulk.save(own / (STAGE + '-result.json'), {'state': 'accepted', 'atUtc': bulk.now()})
                print(entry['id'], 'accepted', flush=True)
                return
        bulk.save(own / (STAGE + '-result.json'), {'state': 'needs_source_or_semantic_review', 'atUtc': bulk.now()})
        print(entry['id'], 'held', flush=True)
    except Exception as error:
        bulk.save(own / (STAGE + '-error.json'), {
            'errorType': type(error).__name__, 'reason': str(error)[:200], 'atUtc': bulk.now()})
        print(entry['id'], type(error).__name__, flush=True)


def run():
    with (luna.WORK / 'workflow.lock').open('a') as workflow_lock:
        fcntl.flock(workflow_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with (luna.JOB / 'bulk/run.lock').open('a') as worker_lock:
            fcntl.flock(worker_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            budget = bulk.read(luna.JOB / 'budget.json')
            if budget.get('halted'):
                raise RuntimeError('Billing halt; no paid requests')
            key = os.environ.get('QURAN_TRANSLATION_API_KEY')
            if not key:
                raise RuntimeError('Credential unavailable')
            entries = luna.load_queue()
            ledger = luna.Ledger(luna.JOB)
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                pending = iter(entries)
                active = {}
                while not bulk.STOP.is_set():
                    while len(active) < 2:
                        entry = next(pending, None)
                        if entry is None:
                            break
                        active[pool.submit(finish, entry, key, ledger)] = entry
                    if not active:
                        break
                    done, _ = concurrent.futures.wait(active, timeout=5, return_when=concurrent.futures.FIRST_COMPLETED)
                    for future in done:
                        future.result()
                        active.pop(future)
                    luna.snapshot(entries, 'completing-final-entries', len(active))
                for future in active:
                    future.result()
            luna.snapshot(entries, 'completion-stopped' if bulk.STOP.is_set() else 'completion-pass-finished')
        workflow.integrate_and_publish(False, True)


if __name__ == '__main__':
    run()
