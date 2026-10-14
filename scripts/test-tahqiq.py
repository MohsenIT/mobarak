"""Validate source linkage and known semantic anchors, without requiring the APK."""
import json, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / 'data/tahqiq/source.json').read_text())
INDEX = json.loads((ROOT / 'public/data/tahqiq-index.json').read_text())

class TahqiqTests(unittest.TestCase):
    def test_source_has_complete_paired_entries_and_attribution(self):
        self.assertEqual(len(SOURCE['entries']), 1772)
        self.assertEqual(len({e['word'] for e in SOURCE['entries']}), 1772)
        self.assertTrue(all(e['ar'].strip() and e['fa'].strip() for e in SOURCE['entries']))
        self.assertEqual(len(SOURCE['source']['apkSha256']), 64)
        self.assertIn('صادق عباسی', SOURCE['source']['translator'])

    def test_every_public_definition_is_verbatim_from_its_named_source_entry(self):
        entries = {e['word']: e for e in SOURCE['entries']}
        for root in INDEX['matchedRoots']:
            public = json.loads((ROOT / f'public/data/tahqiq/{root}.json').read_text())
            self.assertEqual(public['root'], root)
            self.assertTrue(public['entries'])
            for entry in public['entries']:
                self.assertEqual(entry, entries[entry['word']])

    def test_pairing_matches_known_root_meanings_not_an_adjacent_entry(self):
        expected = {'علم': 'حضور و احاطه', 'لقي': 'رويارويي', 'عرش': 'بالاي سر', 'ربب': 'راندن چيزي به سوي كمال'}
        for root, phrase in expected.items():
            public = json.loads((ROOT / f'public/data/tahqiq/{root}.json').read_text())
            self.assertIn(phrase, public['entries'][0]['fa'])
        self.assertEqual(json.loads((ROOT / 'public/data/tahqiq/ربب.json').read_text())['entries'][0]['word'], 'ربّ')
        self.assertEqual(json.loads((ROOT / 'public/data/tahqiq/لقي.json').read_text())['entries'][0]['word'], 'لقی')

    def test_missing_and_ambiguous_entries_are_explicit(self):
        roots = set(json.loads((ROOT / 'public/data/roots.json').read_text()))
        matched, missing = set(INDEX['matchedRoots']), set(INDEX['missingRoots'])
        self.assertEqual(len(matched), 1554)
        self.assertEqual(len(missing), 88)
        self.assertFalse(matched & missing)
        self.assertEqual(matched | missing, roots)
        self.assertIn('نور', missing)
        self.assertEqual(len(INDEX['ambiguousRoots']), 8)
        for root in INDEX['ambiguousRoots']:
            entries = json.loads((ROOT / f'public/data/tahqiq/{root}.json').read_text())['entries']
            self.assertGreater(len(entries), 1)
        self.assertEqual({e['word'] for e in json.loads((ROOT / 'public/data/tahqiq/الم.json').read_text())['entries']}, {'الم', 'ألم'})

if __name__ == '__main__': unittest.main()
