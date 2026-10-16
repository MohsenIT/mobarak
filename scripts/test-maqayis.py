"""Source identity, publication boundary, coverage and translation alignment checks."""
import hashlib,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class SourceChecks(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source=json.loads((ROOT/'data/maqayis/source.json').read_text());cls.index=json.loads((ROOT/'public/data/maqayis-index.json').read_text());cls.translations=json.loads((ROOT/'data/maqayis/translations.json').read_text())
  cls.mappings=json.loads((ROOT/'data/maqayis/root-mappings.json').read_text())['entries'] if (ROOT/'data/maqayis/root-mappings.json').exists() else {}
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
    mapping=self.mappings.get(root)
    matches=[e for e in self.source['entries'] if e['key']==(mapping['sourceKey'] if mapping else root)];self.assertEqual(len(matches),1)
    if mapping:self.assertEqual(mapping['sourceSha256'],hashlib.sha256(matches[0]['ar'].encode()).hexdigest())
    self.assertEqual(published['ar'],matches[0]['ar']);self.assertEqual(published['fa'],translation['fa']);self.assertEqual(published['summary'],translation['summary'])
    self.assertNotEqual(published['fa'],published['summary']);self.assertEqual(published['provenance']['arabicSha256'],hashlib.sha256(published['ar'].encode()).hexdigest())
    if translation.get('sourceSha256'):self.assertEqual(translation['sourceSha256'],published['provenance']['arabicSha256'])
    self.assertGreater(len(published['fa']),20);self.assertGreaterEqual(published['provenance']['pageEnd'],published['provenance']['page'])
 def test_contradictory_qist_meanings_not_collapsed(self):
  self.assertIn('قِسْط',self.translations['قسط']['fa']);self.assertIn('قَسْط',self.translations['قسط']['fa']);self.assertIn('متضاد',self.translations['قسط']['summary'])
 def test_reviewed_entry_corrections_are_reproducible(self):
  reviews=json.loads((ROOT/'data/maqayis/source-reviews.json').read_text())['entries']
  for review in reviews:
   with self.subTest(identity=review['sourceIdentity']):
    matches=[e for e in self.source['entries'] if all(e[k]==v for k,v in review['sourceIdentity'].items())]
    self.assertEqual(matches,[review['entry']])
    self.assertEqual(review['sourceFileSha256'],next(f['sha256'] for f in self.source['source']['files'] if f['volume']==review['sourceIdentity']['volume']))
 def test_new_gemini_entries_have_current_source_evidence(self):
  audit=json.loads((ROOT/'data/maqayis/source-audit.json').read_text())['entries']
  machine=json.loads((ROOT/'data/maqayis/model-source-audit.json').read_text())['entries']
  exclusions=json.loads((ROOT/'data/maqayis/source-audit-exclusions.json').read_text())['entries']
  for root,t in self.translations.items():
   if t.get('translator')!='gemini-3.1-flash-lite':continue
   with self.subTest(root=root):
    self.assertNotIn(root,exclusions)
    evidence=machine[root] if t.get('sourceAuditModel') else audit[root]
    self.assertEqual(evidence['sourceSha256'],t['sourceSha256'])
    self.assertEqual(evidence['verdict'],'pass' if t.get('sourceAuditModel') else 'verified')
    if t.get('sourceAuditModel'):
     self.assertIs(evidence['sourceComplete'],True);self.assertIs(evidence['authorTextAdded'],False)
     self.assertTrue(all(d['category'] in ('editorial','orthographic') for d in evidence['differences']))
if __name__=='__main__':unittest.main()
