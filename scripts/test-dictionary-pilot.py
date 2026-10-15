"""Offline pilot checks; no credential or live API request required."""
import importlib.util,io,json,tempfile,unittest,urllib.error
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('pilot',Path(__file__).with_name('pilot-dictionary-translation.py'));pilot=importlib.util.module_from_spec(spec);spec.loader.exec_module(pilot)
class PilotChecks(unittest.TestCase):
 def setUp(self):
  self.entry={'id':'ishtiqaqi-test','book':'ishtiqaqi','heading':'تست','ar':'بند نخست\n\nبند دوم','referenceFa':'NEVER_SEND_REFERENCE','sourceSha256':'source-hash'}
 def response(self,parts,status='completed'):
  return {'status':status,'model':'gpt-5-mini','usage':{'input_tokens':100,'output_tokens':50},'output':[{'type':'message','content':[{'type':'output_text','text':json.dumps({'summary':'خلاصهٔ مستقل','paragraphs':parts})}]}]}
 def test_blind_prompt_and_matching_paragraph_schema(self):
  body=pilot.payload(self.entry);self.assertNotIn('NEVER_SEND_REFERENCE',json.dumps(body));self.assertEqual(body['text']['format']['schema']['properties']['paragraphs']['minItems'],2);self.assertEqual(body['model'],'gpt-5-mini');self.assertFalse(body['store'])
 def test_incomplete_and_missing_paragraphs_rejected(self):
  with self.assertRaises(ValueError):pilot.decode_response(self.response(['اول','دوم'],'incomplete'),self.entry)
  with self.assertRaises(ValueError):pilot.decode_response(self.response(['فقط خلاصه']),self.entry)
  result=pilot.decode_response(self.response(['اول','دوم']),self.entry);self.assertEqual(result['faFull'],'اول\n\nدوم');self.assertEqual(result['reviewStatus'],'pending_semantic_review')
 def test_http_contract_without_network(self):
  def transport(request,timeout):
   self.assertEqual(request.full_url,'https://api.openai.com/v1/responses');self.assertEqual(request.method,'POST');self.assertEqual(request.get_header('Authorization'),'Bearer fake-test-key');self.assertNotIn('fake-test-key',request.data.decode());return io.BytesIO(json.dumps(self.response(['اول','دوم'])).encode())
  self.assertEqual(pilot.request_one(self.entry,'fake-test-key',transport)['status'],'completed')
 def test_prepared_samples_are_50_unique_and_immutable(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp);data=pilot.prepare(path);self.assertEqual(len(data['entries']),50);self.assertEqual(len({e['id'] for e in data['entries']}),50)
   self.assertEqual(sum(e['book']=='maqayis' for e in data['entries']),25)
   before=(path/'samples.json').read_bytes();pilot.prepare(path);self.assertEqual((path/'samples.json').read_bytes(),before)
 def test_missing_key_prevents_all_requests(self):
  with tempfile.TemporaryDirectory() as tmp,patch.dict(pilot.os.environ,{'QURAN_TRANSLATION_API_KEY':'','OPENAI_API_KEY':''}),patch.object(pilot,'request_one') as request:
   with self.assertRaises(SystemExit):pilot.run(Path(tmp))
   request.assert_not_called()
 def test_duplicate_runner_is_rejected_before_any_request(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)
   with (path/'.run.lock').open('a') as lock:
    pilot.fcntl.flock(lock,pilot.fcntl.LOCK_EX|pilot.fcntl.LOCK_NB)
    with self.assertRaises(SystemExit):pilot.run(path)
 def test_resume_skips_saved_results_and_unknown_failed_requests(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp);data=pilot.prepare(path)
   for e in data['entries']:pilot.save(path/'results'/e['id']/'request-state.json',{'state':'inflight'})
   with patch.dict(pilot.os.environ,{'QURAN_TRANSLATION_API_KEY':'fake-test-key'}),patch.object(pilot,'request_one') as request:pilot.run(path)
   request.assert_not_called();self.assertIsNone(json.loads((path/'report.json').read_text())['costUsd'])
if __name__=='__main__':unittest.main()
