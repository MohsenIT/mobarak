"""Run official Wrangler with local credentials, never exposing tokens in argv."""
import os
from pathlib import Path
import subprocess
import sys
root = Path(__file__).resolve().parents[1]
node = Path('/usr/lib/chatgpt/resources/cua_node/bin/node')
if not node.exists():
    import shutil
    found = shutil.which('node')
    if not found: sys.exit('Node.js is required')
    node = Path(found)
env = os.environ.copy()
env['CLOUDFLARE_API_TOKEN'] = (root / '.secrets/cloudflare-api-token').read_text().strip()
env['CLOUDFLARE_ACCOUNT_ID'] = (root / '.secrets/cloudflare-account-id').read_text().strip()
env['WRANGLER_SEND_METRICS'] = 'false'
env['XDG_CONFIG_HOME'] = str(root / '.tools/config')
env['PATH'] = str(node.parent) + os.pathsep + env.get('PATH','')
args = sys.argv[1:]
input_data = None
# Use an allowlist to avoid exposing secrets through command arguments.
if len(args) == 3 and args[:2] == ['secret','put']:
    files = {'BALE_WEBHOOK_SECRET':'bale-webhook-secret','ADMIN_SECRET':'admin-secret',
             'GITHUB_WEBHOOK_SECRET':'github-webhook-secret','BALE_TOKEN':'bale-token','GITHUB_TOKEN':'github-token','AI_API_TOKEN':'ai-api-token'}
    if args[2] not in files: sys.exit('Unknown project secret')
    input_data = (root / '.secrets' / files[args[2]]).read_text().strip().encode()
result = subprocess.run([str(node), str(root / 'node_modules/wrangler/bin/wrangler.js'), *args],
                        cwd=root, env=env, input=input_data)
sys.exit(result.returncode)
