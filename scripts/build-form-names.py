"""Extract attested verbal nouns; explicit examples fill unlisted names."""
import re,json
from pathlib import Path
from collections import defaultdict
root=Path(__file__).resolve().parents[1]
letters=dict(zip("'|>&<}AbptvjHxd*rzs$SDTZEgfqklmnhwYy",'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي'))
letters['{']='ا';letters['`']='ا'
ignored=set('aiou~FNK_^#@')
def arabic(value, is_root=False):
 text=''.join(letters.get(c,c) for c in value if c not in ignored)
 return text.replace('ى','ي') if is_root else text
names=defaultdict(set)
for line in (root/'data/quranic-corpus-morphology-0.4.txt').read_text().splitlines():
 if not line.startswith('('):continue
 loc,text,tag,features=line.split('\t')
 if '|VN|' not in features:continue
 form=re.search(r'\(([IVX]+)\)',features);lemma=re.search(r'LEM:([^|]+)',features);r=re.search(r'ROOT:([^|]+)',features)
 if form and lemma and r:names[f'{arabic(r[1],True)}:{form[1]}'].add(arabic(lemma[1]))
examples={'لقي:IV':'إلقاء','علم:II':'تعليم','علم:V':'تعلّم','علم:X':'استعلام'}
for key,name in examples.items():names[key].add(name)
result={key:sorted(values) for key,values in sorted(names.items())}
(root/'public/data/form-names.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'Indexed verbal-noun names for {len(result)} root/form families.')
