"""Build exact-written-word and morphology statistics from bundled surahs."""
import json
from pathlib import Path
from collections import defaultdict
root = Path(__file__).resolve().parents[1]
words = defaultdict(dict)
forms = defaultdict(dict)
for n in range(1, 115):
    data = json.loads((root / f'public/data/surah/{n}.json').read_text())
    for verse in data['v']:
        for word in verse['w']:
            words[word['t']][str(n)] = words[word['t']].get(str(n), 0) + 1
            if word.get('form'):
                form = word['form']
                forms[form][str(n)] = forms[form].get(str(n), 0) + 1
(root / 'public/data/analysis-index.json').write_text(json.dumps({'words': words, 'forms': forms}, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Indexed {len(words)} exact words and {len(forms)} annotated forms.')
