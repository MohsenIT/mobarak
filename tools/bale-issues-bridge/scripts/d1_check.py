"""Read only public issue/thread IDs and aggregated operational counts from live D1."""
from pathlib import Path
import json
import urllib.request
root=Path(__file__).resolve().parents[1]
config=json.loads((root/'wrangler.jsonc').read_text())
secret_dir=root/'.secrets'
token=(secret_dir/'cloudflare-api-token').read_text().strip()
account=(secret_dir/'cloudflare-account-id').read_text().strip()
database=config['d1_databases'][0]['database_id']
queries=["SELECT number,channel_post_id,group_root_id,state FROM issues ORDER BY number", "SELECT source,COUNT(*) AS n FROM comment_links GROUP BY source", "SELECT state,COUNT(*) AS n FROM events GROUP BY state"]
try:
 for sql in queries:
  req=urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query',method='POST',headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},data=json.dumps({'sql':sql}).encode())
  with urllib.request.urlopen(req,timeout=25) as response:value=json.load(response)
  print(json.dumps(value.get('result',[{}])[0].get('results',[]),ensure_ascii=False))
except Exception as e:print('D1 verification failed:',type(e).__name__)
