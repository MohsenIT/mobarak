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
        for root in INDEX['apkMatchedRoots']:
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
        self.assertEqual(len(matched), 1642)
        self.assertEqual(len(INDEX['apkMatchedRoots']), 1554)
        self.assertEqual(len(INDEX['supplementRoots']), 88)
        self.assertEqual(len(missing), 0)
        self.assertFalse(matched & missing)
        self.assertEqual(matched | missing, roots)
        self.assertIn('نور', INDEX['supplementRoots'])
        self.assertEqual(len(INDEX['ambiguousRoots']), 8)
        for root in INDEX['ambiguousRoots']:
            entries = json.loads((ROOT / f'public/data/tahqiq/{root}.json').read_text())['entries']
            self.assertGreater(len(entries), 1)
        self.assertEqual({e['word'] for e in json.loads((ROOT / 'public/data/tahqiq/الم.json').read_text())['entries']}, {'الم', 'ألم'})

    def test_supplements_preserve_translation_source_and_have_valid_quran_examples(self):
        supplement = json.loads((ROOT / 'data/tahqiq/supplement-source.json').read_text())
        for root in INDEX['supplementRoots']:
            public = json.loads((ROOT / f'public/data/tahqiq/{root}.json').read_text())['entries'][0]
            source = supplement['entries'][root]
            for key in ['word', 'fa', 'ar', 'provenance']:
                self.assertEqual(public[key], source[key])
            self.assertEqual(public['provenance']['kind'], 'translated-summary')
            self.assertGreaterEqual(public['provenance']['volume'], 1)
            self.assertLessEqual(public['provenance']['volume'], 14)
            self.assertGreaterEqual(public['provenance']['pageEnd'], public['provenance']['page'])
            self.assertTrue(all(line in source['sourceArabic'] for line in public['ar'].splitlines()))
            self.assertTrue(public['examples'])
            for example in public['examples']:
                data = json.loads((ROOT / f"public/data/surah/{example['s']}.json").read_text())
                word = data['v'][example['a'] - 1]['w'][example['pos'] - 1]
                self.assertEqual(word['r'], root)
                self.assertEqual(word['t'], example['text'])

    def test_similar_spellings_are_matched_by_the_actual_quran_word(self):
        expected = {'ايي': ('آية', 'نشانه'), 'هات': ('هات', 'بیاور'), 'كلو': ('كلا', 'دو چیز'), 'لوت': ('لات', 'کلمهٔ نفی'), 'صفصف': ('صفصف', 'هموار')}
        for root, (title, meaning) in expected.items():
            entry = json.loads((ROOT / f'public/data/tahqiq/{root}.json').read_text())['entries'][0]
            self.assertEqual(entry['word'], title)
            self.assertIn(meaning, entry['fa'])

if __name__ == '__main__': unittest.main()
