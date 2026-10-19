"""Build lexical-part and morphology statistics from bundled surahs."""
import json
import re
from pathlib import Path
from collections import defaultdict
root = Path(__file__).resolve().parents[1]
words = defaultdict(dict)
forms = defaultdict(dict)
root_forms = defaultdict(dict)
for n in range(1, 115):
    data = json.loads((root / f'public/data/surah/{n}.json').read_text())
    for verse in data['v']:
        for word in verse['w']:
            prefix = re.match(r'^(?:۞\s*)?و[\u064b-\u065f\u0670\u06d6-\u06ed]*', word['t'])[0] if word.get('wa') else ''
            for part, text in ([('prefix', prefix), ('stem', word['t'][len(prefix):])] if prefix else [('stem', word['t'])]):
                key = re.sub(r'[\u064b-\u065f\u0670\u06d6-\u06edـ۞\s]', '', text).translate(str.maketrans('یىکٱ', 'ييكا'))
                if part == 'stem' and word.get('lemma'):
                    key = f"lemma:{word['lemma']}"
                words[key][str(n)] = words[key].get(str(n), 0) + 1
            if word.get('form'):
                form = word['form']
                forms[form][str(n)] = forms[form].get(str(n), 0) + 1
                if word.get('r'):
                    key = f"{word['r']}:{form}"
                    root_forms[key][str(n)] = root_forms[key].get(str(n), 0) + 1
(root / 'public/data/analysis-index.json').write_text(json.dumps({'words': words, 'forms': forms, 'rootForms': root_forms}, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Indexed {len(words)} lexical parts and {len(forms)} annotated forms.')
