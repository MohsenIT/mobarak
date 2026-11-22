"""Configure only labels/webhooks for the explicitly selected Issues repository."""
import argparse
import json
from pathlib import Path
import sys
import urllib.request
import urllib.error
root=Path(__file__).resolve().parents[1]
secrets=root/'.secrets'
token=(secrets/'github-token').read_text().strip()
repo='MohsenIT/mobarak'
def call(path,method='GET',data=None):
 req=urllib.request.Request('https://api.github.com/repos/'+repo+path,method=method,
  data=json.dumps(data).encode() if data is not None else None,
  headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'mobarak-bridge-setup','Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
 except urllib.error.HTTPError as e:raise RuntimeError('GitHub HTTP '+str(e.code)) from None
parser=argparse.ArgumentParser();parser.add_argument('action',choices=['labels','webhook','inventory']);args=parser.parse_args()
try:
 if args.action=='labels':
  existing={l['name'].lower() for l in call('/labels?per_page=100')}
  required=[('bug','d73a4a','گزارش خطا'),('suggestion','a2eeef','پیشنهاد قابلیت'),('enhancement','84b6eb','بهبود قابلیت موجود'),('question','d876e3','پرسش')]
  required.extend(('area:'+name,'c5def5','حوزه محصول') for name in ['reader','search','analysis','translation','tafsir','recitation','settings','other'])
  required.extend([('needs-info','fbca04','نیازمند اطلاعات بیشتر'),('needs-content-review','b60205','نیازمند بررسی متخصص محتوا'),('blocked','cccccc','متوقف')])
  for name,color,description in required:
   if name not in existing:call('/labels','POST',{'name':name,'color':color,'description':description});print('Created label:',name)
  print('Required labels ready')
 elif args.action=='webhook':
  url=(secrets/'worker-url').read_text().strip()+'/webhooks/github'
  config={'url':url,'content_type':'json','insecure_ssl':'0','secret':(secrets/'github-webhook-secret').read_text().strip()}
  hooks=call('/hooks');matches=[h for h in hooks if h.get('config',{}).get('url')==url]
  if matches:result=call('/hooks/'+str(matches[0]['id']),'PATCH',{'active':True,'events':['issues','issue_comment'],'config':config})
  else:result=call('/hooks','POST',{'name':'web','active':True,'events':['issues','issue_comment'],'config':config})
  print('Repository webhook ready; id:',result['id'])
 else:
  issues=[]
  for page in range(1,11):
   batch=call(f'/issues?state=all&per_page=100&page={page}')
   issues.extend({'number':i['number'],'state':i['state']} for i in batch if 'pull_request' not in i)
   if len(batch)<100:break
  print('Existing issues:',len(issues));print('Issue numbers:',json.dumps(issues))
except Exception as e:
 print(str(e) if isinstance(e,RuntimeError) else type(e).__name__);sys.exit(1)
