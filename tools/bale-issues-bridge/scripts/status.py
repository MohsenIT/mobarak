"""Print operational state, never event bodies, user identities or credentials."""
from pathlib import Path
import urllib.request
import json
root=Path(__file__).resolve().parents[1]
try:
 url=(root/'.secrets/worker-url').read_text().strip()
 secret=(root/'.secrets/admin-secret').read_text().strip()
 req=urllib.request.Request(url+'/admin/status',headers={'Authorization':'Bearer '+secret,'User-Agent':'mobarak-issues-bridge-health/1.0'})
 with urllib.request.urlopen(req,timeout=25) as response:state=json.load(response)
 print(json.dumps({'events':state.get('events'),'uncertain_effects':state.get('uncertain_effects'),'abuse_report_count':len(state.get('abuse_reports',[]))},ensure_ascii=False,indent=2))
except Exception as e:print('Status check failed:',type(e).__name__)
