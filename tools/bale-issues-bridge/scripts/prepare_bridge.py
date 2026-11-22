"""Prepare public bridge configuration and verify existing official Bale memberships."""
from pathlib import Path
import json
import sys
from bale_probe import API
root=Path(__file__).resolve().parents[1]
try:
 api=API();me=api.call('getMe');channel=api.call('getChat',chat_id='@mobarak_issues');group=api.call('getChat',chat_id=channel['linked_chat_id'])
 if str(group.get('linked_chat_id'))!=str(channel['id']):sys.exit('Channel/group link did not match')
 p=root/'wrangler.jsonc';config=json.loads(p.read_text())
 config['main']='src/bridge-worker.ts'
 config['vars']={'GITHUB_REPO':'MohsenIT/mobarak','BALE_CHANNEL_ID':str(channel['id']),'BALE_GROUP_ID':str(group['id']),'BALE_CHANNEL_USERNAME':channel['username'],'BALE_BOT_ID':str(me['id']),'BRIDGE_ENABLED':'true'}
 config['triggers']={'crons':['* * * * *']}
 config.pop('limits',None) # Free uses its platform default; custom CPU limits require Paid.
 p.write_text(json.dumps(config,indent=2)+'\n')
 print('Bridge configuration ready; official channel/group link verified')
except Exception as error:
 print(str(error) if isinstance(error,RuntimeError) else type(error).__name__)
 sys.exit(1)
