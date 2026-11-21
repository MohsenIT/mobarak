import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('probe', Path(__file__).resolve().parents[1] / 'scripts/bale_probe.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class EvidenceTests(unittest.TestCase):
    def test_private_chat_identity_is_removed(self):
        self.assertEqual(probe.shape({'id': 123, 'type': 'private', 'first_name': 'secret'}), {'type': 'private'})

    def test_keeps_routing_without_private_content(self):
        raw = {'update_id': 7, 'message': {'message_id': 12, 'text': 'PRIVATE',
               'from': {'id': 101, 'first_name': 'PRIVATE'}, 'chat': {'id': -20, 'type': 'group', 'title': 'PRIVATE'},
               'reply_to_message': {'message_id': 11, 'forward_from_chat': {'id': -30, 'type': 'channel'},
                                    'forward_from_message_id': 4, 'text': 'PRIVATE'}}}
        clean = probe.shape(raw)
        self.assertNotIn('PRIVATE', str(clean))
        self.assertNotIn('101', str(clean))
        self.assertEqual(clean['message']['reply_to_message']['forward_from_message_id'], 4)
        self.assertEqual(clean['message']['chat']['id'], -20)

if __name__ == '__main__':
    unittest.main()
