"""Bounded final pass on unpublished Maqayis candidates using the authorized ledger.
Reuse source-matched paid artifacts; require a full Flash audit after every repair.
No source text or translation is generated locally.
"""
import argparse,concurrent.futures,fcntl,importlib.util,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('workflow',ROOT/'scripts/run-maqayis-completion.py');workflow=importlib.util.module_from_spec(spec);spec.loader.exec_module(workflow)
luna=workflow.luna;bulk=luna.bulk
os.environ['QURAN_TRANSLATION_BUDGET_USD']=workflow.ENV['QURAN_TRANSLATION_BUDGET_USD']

def finalize(e,key,ledger):
    own=luna.folder(e)
    if not luna.source_valid(e):return
    if (own/'finalize-v1-result.json').exists():return
    if bulk.read(ROOT/'data/maqayis/translations.json',{}).get(e['id']):return
    try:
        paths=[p for p in own.glob('*.json') if p.name not in ('source.json','state.json')]
        candidate=None
        for p in sorted(paths,key=lambda p:p.stat().st_mtime_ns,reverse=True):
            data=bulk.read(p,{})
            if not isinstance(data,dict) or data.get('sourceSha256')!=e['sourceSha256']:continue
            try:bulk.validate(e,data)
            except (ValueError,KeyError,TypeError):continue
            candidate=data;break
        cached=bulk.read(own/'finalize-v1-input.json')
        if cached:candidate=cached
        if candidate is None:candidate=luna.translate(e,key,ledger,'finalize-v1-translate')
        bulk.save(own/'finalize-v1-input.json',candidate)
        for turn in range(4):
            saved=bulk.read(own/f'finalize-v1-candidate-{turn}.json')
            if saved:candidate=saved
            else:bulk.save(own/f'finalize-v1-candidate-{turn}.json',candidate)
            review=luna.audit(e,candidate,key,ledger,f'finalize-v1-audit-{turn}',reviewer=luna.REVIEWER)
            if review['verdict']=='pass':
                if not luna.source_valid(e):raise ValueError('source_changed')
                bulk.save(own/'candidate.json',candidate);bulk.save(own/'review.json',review)
                bulk.save(own/'state.json',{'state':'accepted','sourceSha256':e['sourceSha256'],'translatorModel':luna.MODEL,'reviewerModel':luna.REVIEWER,'reviewPolicy':'full-entry-final-flash-audit','updatedAtUtc':bulk.now()})
                bulk.save(own/'finalize-v1-result.json',{'state':'accepted','round':turn,'atUtc':bulk.now()});return
            if turn<3:
                candidate,_=luna.repair_issues(e,candidate,review,key,ledger,f'finalize-v1-repair-{turn}')
        bulk.save(own/'finalize-v1-result.json',{'state':'held_after_three_repairs','atUtc':bulk.now()})
    except Exception as error:
        bulk.save(own/'finalize-v1-error.json',{'errorType':type(error).__name__,'atUtc':bulk.now()})

def run(publish):
    with (luna.WORK/'workflow.lock').open('a') as workflow_lock:
        fcntl.flock(workflow_lock,fcntl.LOCK_EX)
        with (luna.JOB/'bulk/run.lock').open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            budget=bulk.read(luna.JOB/'budget.json',{})
            if budget.get('halted'):raise RuntimeError('Billing halt; no paid requests')
            if not budget.get('additionalBudgetAuthorization'):raise RuntimeError('Additional authorization missing')
            key=os.environ.get('QURAN_TRANSLATION_API_KEY')
            if not key:raise RuntimeError('Credential unavailable')
            entries=luna.load_queue();ledger=luna.Ledger(luna.JOB)
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                iterator=iter(entries);active={}
                while not bulk.STOP.is_set():
                    while len(active)<4:
                        try:e=next(iterator)
                        except StopIteration:break
                        active[pool.submit(finalize,e,key,ledger)]=e
                    if not active:break
                    done,_=concurrent.futures.wait(active,timeout=5,return_when=concurrent.futures.FIRST_COMPLETED)
                    for f in done:f.result();active.pop(f)
                    luna.snapshot(entries,'finalizing-held-candidates',len(active))
                for f in active:f.result()
            luna.snapshot(entries,'finalization-stopped' if bulk.STOP.is_set() else 'finalization-complete')
        workflow.integrate_and_publish(publish,True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--publish',action='store_true');args=parser.parse_args();run(args.publish)
