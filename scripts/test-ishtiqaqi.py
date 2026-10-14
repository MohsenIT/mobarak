"""Check uploaded source identity, root mappings, reference scope and translation status."""
import hashlib,json,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class Checks(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  with zipfile.ZipFile(ROOT/'data/ishtiqaqi/source.zip') as z:
   cls.source=json.loads(z.read('roots.json'));cls.pages={p['source']['page_id']:p for p in map(json.loads,z.read('source_pages.jsonl').splitlines())};cls.checks=json.loads(z.read('checksums.json'));cls.raw={name:z.read(name) for name in cls.checks}
  cls.index=json.loads((ROOT/'public/data/ishtiqaqi-index.json').read_text());cls.entries={e['id']:e for e in cls.source['roots']}
 def test_archive_checksums_and_counts(self):
  for name,digest in self.checks.items():self.assertEqual(hashlib.sha256(self.raw[name]).hexdigest(),digest)
  self.assertEqual(len(self.entries),1924);self.assertEqual(len(self.pages),2380)
 def test_root_coverage_is_exact_partition(self):
  roots=set(json.loads((ROOT/'public/data/roots.json').read_text()))
  matched=set(self.index['matchedRoots']);missing=set(self.index['missingRoots'])
  self.assertEqual(matched|missing,roots);self.assertFalse(matched&missing)
  self.assertEqual(len(matched),1616);self.assertEqual(len(missing),26)
 def test_published_arabic_and_shared_notes_are_unchanged(self):
  common={e['id']:e for e in self.source['common_meanings']}
  for root in self.index['matchedRoots']:
   published=json.loads((ROOT/f'public/data/ishtiqaqi/{root}.json').read_text())
   for e in published['entries']:
    original=self.entries[e['id']]
    self.assertEqual(e['ar'],original['explanation']);self.assertEqual(e['coreAr'],original['core_meaning']);self.assertEqual(e['references'],original['references']);self.assertEqual(e['footnotes'],original['footnotes'])
    for note in e['footnotes']:self.assertEqual(note['scope'],'source_page');self.assertIn(note,self.pages[note['source']['page_id']]['footnotes'])
    for c in e['commonMeanings']:self.assertEqual(c['ar'],common[c['id']]['explanation']);self.assertEqual(common[c['id']]['section_path'],original['section_path'])
 def test_paragraph_references_match_source_pages(self):
  for e in self.source['roots']:
   for paragraph in e['paragraphs']:
    ref=paragraph['source'];page=self.pages[ref['page_id']]
    found=[p for p in page['paragraphs'] if p['source']['paragraph']==ref['paragraph']]
    self.assertEqual(len(found),1);self.assertEqual(found[0]['text'],paragraph['text'])
 def test_full_translation_and_summary_are_separate(self):
  self.assertEqual(set(self.index['translatedRoots']),{'عرش','بسم','جوع','جدث'})
  self.assertEqual(len(self.index['summarizedRoots']),10)
  translated=json.loads((ROOT/'data/ishtiqaqi/translations.json').read_text())
  for key,t in translated.items():
   self.assertEqual(t['sourceSha256'],hashlib.sha256(self.entries[key]['explanation'].encode()).hexdigest())
   self.assertEqual(t['kind'],'full-author-entry' if t.get('faFull') else 'core-summary')
 def test_multiple_entries_are_preserved(self):
  for root,ids in self.index['multipleEntries'].items():
   published=json.loads((ROOT/f'public/data/ishtiqaqi/{root}.json').read_text());self.assertEqual([e['id'] for e in published['entries']],ids)
if __name__=='__main__':unittest.main()
