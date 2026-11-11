"""Controlled official webhook -> polling handover, retaining pending updates.
Preflight confirms the old route, then removes webhook BEFORE deployment.
Any failure restores the prior Worker version and official webhook.
No test posts, synthetic updates or paid requests are sent.
"""
from pathlib import Path
import json,sys,subprocess,urllib.request
from bale_probe import API
root=Path(__file__).resolve().parents[1];secret=root/'.secrets'
base=(secret/'worker-url').read_text().strip();expected=base+'/webhooks/bale/'+(secret/'bale-webhook-secret').read_text().strip()
previous_version='dee8478d-39a4-4f14-be61-f120ac657d15'
def health():
 req=urllib.request.Request(base+'/health',headers={'User-Agent':'mobarak-issues-bridge-health/1.0'})
 with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
a=API();info=a.call('getWebhookInfo');before=health()
if info.get('url')!=expected or before.get('bale_transport')!='webhook':sys.exit('Preflight mismatch; no change made')
p=root/'wrangler.jsonc';config=json.loads(p.read_text())
if config.get('vars',{}).get('BALE_TRANSPORT')!='polling':sys.exit('Configuration mismatch; no change made')
snapshot=root/'.phase-zero/transport-switch.json';snapshot.parent.mkdir(exist_ok=True)
snapshot.write_text(json.dumps({'previous_webhook':expected,'previous_worker_version':previous_version,'phase':'preflight'}));snapshot.chmod(0o600)
removed=False
try:
 a.call('deleteWebhook') # Default preserves pending updates; never drop_pending_updates.
 removed=True;print('Official webhook removed; pending updates retained',flush=True)
 result=subprocess.run([sys.executable,str(root/'scripts/wrangler.py'),'deploy'],cwd=root)
 if result.returncode:raise RuntimeError('deployment_failed')
 current=health()
 if current.get('bale_transport')!='polling' or not current.get('intake_enabled'):raise RuntimeError('health_check_failed')
 snapshot.write_text(json.dumps({'previous_webhook':expected,'previous_worker_version':previous_version,'phase':'polling_active'}));snapshot.chmod(0o600)
 print('Polling transport deployed and health verified; cron processes the retained queue')
except Exception as error:
 if removed:
  rollback=subprocess.run([sys.executable,str(root/'scripts/wrangler.py'),'rollback',previous_version,'--yes','--message','Restore webhook transport after unsuccessful polling handover'],cwd=root)
  try:a.call('setWebhook',url=expected);print('Previous official webhook restored')
  except Exception:print('Webhook restore needs operator attention')
  config['vars']['BALE_TRANSPORT']='webhook';p.write_text(json.dumps(config,indent=2)+'\n')
 print('Controlled handover failed:',type(error).__name__);sys.exit(1)
