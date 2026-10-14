"""Source identity, publication boundary, coverage and translation alignment checks."""
import hashlib,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class SourceChecks(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source=json.loads((ROOT/'data/maqayis/source.json').read_text());cls.index=json.loads((ROOT/'public/data/maqayis-index.json').read_text());cls.translations=json.loads((ROOT/'data/maqayis/translations.json').read_text())
 def test_all_six_volumes_and_pages(self):
  self.assertEqual({f['volume'] for f in self.source['source']['files']},set(range(1,7)))
  self.assertEqual(sum(f['pageCount'] for f in self.source['source']['files']),2933)
 def test_only_translated_entries_published(self):
  self.assertEqual(set(self.index['translatedRoots']),set(self.translations))
  self.assertEqual({f.stem for f in (ROOT/'public/data/maqayis').glob('*.json')},set(self.translations))
  self.assertEqual(self.index['translatedCount']+len(self.index['pendingRoots']),self.index['totalQuranRoots'])
  self.assertFalse(set(self.index['translatedRoots'])&set(self.index['pendingRoots']))
 def test_full_author_text_matches_source_and_separate_summary(self):
  for root,translation in self.translations.items():
   with self.subTest(root=root):
    published=json.loads((ROOT/f'public/data/maqayis/{root}.json').read_text())
    matches=[e for e in self.source['entries'] if e['key']==root];self.assertEqual(len(matches),1)
    self.assertEqual(published['ar'],matches[0]['ar']);self.assertEqual(published['fa'],translation['fa']);self.assertEqual(published['summary'],translation['summary'])
    self.assertNotEqual(published['fa'],published['summary']);self.assertEqual(published['provenance']['arabicSha256'],hashlib.sha256(published['ar'].encode()).hexdigest())
    self.assertGreater(len(published['fa']),20);self.assertGreaterEqual(published['provenance']['pageEnd'],published['provenance']['page'])
 def test_contradictory_qist_meanings_not_collapsed(self):
  self.assertIn('قِسْط',self.translations['قسط']['fa']);self.assertIn('قَسْط',self.translations['قسط']['fa']);self.assertIn('متضاد',self.translations['قسط']['summary'])
if __name__=='__main__':unittest.main()
