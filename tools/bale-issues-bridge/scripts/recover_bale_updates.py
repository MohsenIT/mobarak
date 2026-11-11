"""Replay real unacknowledged Bale updates through the authenticated Worker, preserving retry safety."""
from pathlib import Path
import json
import sys
import urllib.request
import urllib.error
from bale_probe import API
root=Path(__file__).resolve().parents[1]
secrets=root/'.secrets'
a=API()
expected=(secrets/'worker-url').read_text().strip()+'/webhooks/bale/'+(secrets/'bale-webhook-secret').read_text().strip()
previous=None
try:
 info=a.call('getWebhookInfo');previous=info.get('url','')
 print('expected_webhook_matches:',previous==expected,'pending:',info.get('pending_update_count'))
 if previous!=expected:sys.exit('Webhook mismatch; no change made')
 a.call('deleteWebhook')
 updates=a.call('getUpdates',limit=100,timeout=0)
 print('real_updates_read:',len(updates))
 highest=None
 for update in updates:
  req=urllib.request.Request(expected,method='POST',headers={'Content-Type':'application/json','User-Agent':'mobarak-issues-bridge-recovery/1.0'},data=json.dumps(update).encode())
  try:
   with urllib.request.urlopen(req,timeout=25) as response:print('replayed_update:',update['update_id'],'HTTP:',response.status)
   highest=update['update_id']
  except urllib.error.HTTPError as error:
   print('replay_failure:',update['update_id'],'HTTP:',error.code,'response:',error.read(250).decode(errors='replace'))
   break
  except Exception as error:
   print('replay_connection_failure:',type(error).__name__);break
 if highest is not None:a.call('getUpdates',offset=highest+1,limit=1,timeout=0)
except Exception as error:print('recovery_failure:',str(error) if isinstance(error,RuntimeError) else type(error).__name__)
finally:
 if previous==expected:
  try:a.call('setWebhook',url=previous);print('webhook_restored: yes')
  except Exception:print('webhook_restore_failed: needs retry')
