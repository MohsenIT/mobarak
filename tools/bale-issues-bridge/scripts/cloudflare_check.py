"""Check deployment credentials without printing tokens or account contact details."""
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

root = Path(__file__).resolve().parents[1]
token = (root / '.secrets/cloudflare-api-token').read_text().strip()
account = (root / '.secrets/cloudflare-account-id').read_text().strip()
if not re.fullmatch(r'[a-fA-F0-9]{32}', account):
    sys.exit('Account ID must be exactly the 32-character ID, without URL or extra text')
for name, path in [('token', '/user/tokens/verify'), ('databases', f'/accounts/{account}/d1/database'), ('workers_subdomain', f'/accounts/{account}/workers/subdomain')]:
    req = urllib.request.Request('https://api.cloudflare.com/client/v4' + path,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            value = json.load(response)
        result = value.get('result')
        print(name, 'success:', value.get('success'))
        if name == 'token' and isinstance(result,dict): print('token_status:', result.get('status'))
        if name == 'databases' and isinstance(result,list): print('database_count:', len(result))
        if name == 'workers_subdomain' and isinstance(result,dict): print('subdomain_configured:', bool(result.get('subdomain')))
    except urllib.error.HTTPError as error:
        try:
            body = json.load(error)
            codes = [e.get('code') for e in body.get('errors',[])]
        except Exception:
            codes = []
        print(name, 'HTTP:', error.code, 'error_codes:', codes)
    except Exception:
        print(name, 'network failure')
