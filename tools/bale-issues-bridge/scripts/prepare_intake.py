"""Prepare the opt-in conversation layer. Never enables a paid model."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
p=root/'wrangler.jsonc';config=json.loads(p.read_text());settings=config.setdefault('vars',{})
settings.update({'INTAKE_ENABLED':'true','PUBLIC_BASE_URL':(root/'.secrets/worker-url').read_text().strip(),'GITHUB_GOVERNANCE_READY':'true'})
settings.setdefault('AI_ENABLED','false');settings.setdefault('AI_REPORT_BUDGET_TOMAN','0')
settings.setdefault('AI_MODEL','gemini-3.1-flash-lite')
settings.setdefault('AI_INPUT_TOMAN_PER_MILLION','800');settings.setdefault('AI_OUTPUT_TOMAN_PER_MILLION','4600')
config['preview_urls']=False
p.write_text(json.dumps(config,indent=2)+'\n')
print('Intake configuration ready; paid AI remains disabled by default')
