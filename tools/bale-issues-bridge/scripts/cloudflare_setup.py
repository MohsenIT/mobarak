"""Create/reuse only the project's D1 and free workers.dev subdomain; no billing API calls."""
import json
import secrets
import sys
import urllib.request
import urllib.error
from pathlib import Path
root = Path(__file__).resolve().parents[1]
secret_dir = root / '.secrets'
token = (secret_dir / 'cloudflare-api-token').read_text().strip()
account = (secret_dir / 'cloudflare-account-id').read_text().strip()

def call(method, path, data=None):
    req = urllib.request.Request('https://api.cloudflare.com/client/v4/accounts/' + account + path,
        method=method, data=None if data is None else json.dumps(data).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            value = json.load(response)
    except urllib.error.HTTPError as error:
        try: codes = [e.get('code') for e in json.load(error).get('errors',[])]
        except Exception: codes = []
        raise RuntimeError(f'Cloudflare HTTP {error.code}; codes {codes}') from None
    if not value.get('success'):
        raise RuntimeError('Cloudflare rejected request')
    return value['result']
try:
    databases = call('GET','/d1/database?name=bridge-db')
    exact = [d for d in databases if d.get('name')=='bridge-db']
    db = exact[0] if exact else call('POST','/d1/database',{'name':'bridge-db'})
    config_path = root / 'wrangler.jsonc'
    config = json.loads(config_path.read_text())
    config['name'] = 'mobarak-issues-bridge'
    config['d1_databases'][0]['database_id'] = db['uuid']
    config_path.write_text(json.dumps(config,indent=2)+'\n')
    print('D1 ready: bridge-db')
    try:
        subdomain = call('GET','/workers/subdomain')['subdomain']
    except RuntimeError as error:
        if '10007' not in str(error): raise
        subdomain = call('PUT','/workers/subdomain',{'subdomain':'mobarak-issues-'+account[:8]})['subdomain']
    (secret_dir / 'worker-url').write_text('https://mobarak-issues-bridge.'+subdomain+'.workers.dev')
    for name in ['bale-webhook-secret','admin-secret','github-webhook-secret']:
        path = secret_dir / name
        if not path.exists():
            path.write_text(secrets.token_urlsafe(48)); path.chmod(0o600)
    print('workers.dev subdomain ready')
except Exception as error:
    print(str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    sys.exit(1)
