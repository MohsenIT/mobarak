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
  cls.archiveEntries=cls.entries.copy()
  cls.reviews=json.loads((ROOT/'data/ishtiqaqi/source-reviews.json').read_text())
  for review in cls.reviews['reviews']:
   del cls.entries[review['originalEntryId']]
   cls.entries.update({e['id']:e for e in review['entries']})
 def test_archive_checksums_and_counts(self):
  for name,digest in self.checks.items():self.assertEqual(hashlib.sha256(self.raw[name]).hexdigest(),digest)
  self.assertEqual(len(self.archiveEntries),1924);self.assertEqual(len(self.entries),1925);self.assertEqual(len(self.pages),2380)
 def test_root_coverage_is_exact_partition(self):
  roots=set(json.loads((ROOT/'public/data/roots.json').read_text()))
  matched=set(self.index['matchedRoots']);missing=set(self.index['missingRoots'])
  self.assertEqual(matched|missing,roots);self.assertFalse(matched&missing)
  self.assertEqual(len(matched),1640);self.assertEqual(missing,{'مجس','سوح'})
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
  self.assertTrue({'عرش','بسم','جوع','جدث','لقي','قول','رحم','رحق'} <= set(self.index['translatedRoots']))
  for root in self.index['translatedRoots']:
   entries=json.loads((ROOT/f'public/data/ishtiqaqi/{root}.json').read_text())['entries']
   self.assertTrue(all(e['translation'] and e['translation'].get('faFull') for e in entries))
  self.assertTrue(set(self.index['translatedRoots']) <= set(self.index['summarizedRoots']))
  translated=json.loads((ROOT/'data/ishtiqaqi/translations.json').read_text())
  for key,t in translated.items():
   self.assertEqual(t['sourceSha256'],hashlib.sha256(self.entries[key]['explanation'].encode()).hexdigest())
   self.assertEqual(t['kind'],'full-author-entry' if t.get('faFull') else 'core-summary')
 def test_multiple_entries_are_preserved(self):
  for root,ids in self.index['multipleEntries'].items():
   published=json.loads((ROOT/f'public/data/ishtiqaqi/{root}.json').read_text());self.assertEqual([e['id'] for e in published['entries']],ids)
 def test_reviewed_mappings_have_source_and_quran_evidence(self):
  data=json.loads((ROOT/'data/ishtiqaqi/root-mappings.json').read_text())
  self.assertEqual(data['archiveSha256'],self.index['archiveSha256'])
  self.assertEqual(len(data['mappings']),23)
  for mapping in data['mappings']:
   with self.subTest(root=mapping['root']):
    original=self.entries[mapping['entryId']]
    self.assertEqual(mapping['sourceHeading'],original['heading'])
    self.assertEqual(mapping['sourceSha256'],hashlib.sha256(original['explanation'].encode()).hexdigest())
    self.assertIn(mapping['evidenceQuote'],original['explanation'])
    published=json.loads((ROOT/f'public/data/ishtiqaqi/{mapping["root"]}.json').read_text())
    self.assertIn(mapping['entryId'],[e['id'] for e in published['entries']])
    for token in mapping['quranTokens']:
     surah=json.loads((ROOT/f'public/data/surah/{token["surah"]}.json').read_text())
     verse=next(v for v in surah['v'] if v['n']==token['ayah']);word=verse['w'][token['word']-1]
     self.assertEqual(word['t'],token['text']);self.assertEqual(word['r'],mapping['root'])
    for excluded in mapping['excludeFromRoots']:
     record=json.loads((ROOT/f'public/data/ishtiqaqi/{excluded}.json').read_text())
     self.assertNotIn(mapping['entryId'],[e['id'] for e in record['entries']])
 def test_reviewed_boundaries_preserve_every_original_paragraph(self):
  self.assertEqual(self.reviews['archiveSha256'],self.index['archiveSha256'])
  for review in self.reviews['reviews']:
   original=self.archiveEntries[review['originalEntryId']]
   self.assertEqual(review['originalSha256'],hashlib.sha256(original['explanation'].encode()).hexdigest())
   self.assertEqual([p for e in review['entries'] for p in e['paragraphs']],original['paragraphs'])
   for entry in review['entries']:
    for paragraph in entry['paragraphs']:
     ref=paragraph['source'];page=self.pages[ref['page_id']]
     self.assertEqual(next(p['text'] for p in page['paragraphs'] if p['source']['paragraph']==ref['paragraph']),paragraph['text'])
if __name__=='__main__':unittest.main()
