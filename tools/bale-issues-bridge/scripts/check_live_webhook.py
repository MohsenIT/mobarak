"""Use real Bale events to verify the deployed phase-zero Worker/D1 receiver."""
import json
from pathlib import Path
import sys
import urllib.request
import time
from bale_probe import API
root=Path(__file__).resolve().parents[1]
secrets=root/'.secrets'
url=(secrets/'worker-url').read_text().strip()
webhook_secret=(secrets/'bale-webhook-secret').read_text().strip()
admin=(secrets/'admin-secret').read_text().strip()
state=root/'.phase-zero/live-webhook.json'
try:
 with urllib.request.urlopen(urllib.request.Request(url+'/health',headers={'User-Agent':'mobarak-issues-bridge-health/1.0'}),timeout=25) as response:
  health=json.load(response)
 print('deployed stage:',health.get('stage'))
 a=API()
 if not state.exists():
  previous=a.call('getWebhookInfo').get('url','')
  state.write_text(json.dumps({'previous_webhook':previous,'test_post':None}));state.chmod(0o600)
 config=json.loads(state.read_text())
 a.call('setWebhook',url=url+'/webhooks/bale/'+webhook_secret)
 print('Bale webhook configured: yes (URL secret withheld)')
 if not config.get('test_post'):
  result=a.call('sendMessage',chat_id=4357475772,text='#بهبود\nآزمون اتصال واقعی وب‌هوک Cloudflare\nاین پست برای تأیید دریافت رویداد رسمی بله در Workers و D1 است.')
  config['test_post']=result['message_id'];state.write_text(json.dumps(config))
  print('real Bale test post:',result['message_id'])
 req=urllib.request.Request(url+'/admin/events',headers={'Authorization':'Bearer '+admin,'User-Agent':'mobarak-issues-bridge-health/1.0'})
 for attempt in range(4):
  with urllib.request.urlopen(req,timeout=25) as response: events=json.load(response)
  if events:break
  time.sleep(1)
 print('durably stored real updates:',len(events))
 print('routing:',json.dumps(events,ensure_ascii=False))
 if not events:sys.exit(2)
except Exception as error:
 print('Live verification failed:',type(error).__name__)
 sys.exit(1)
