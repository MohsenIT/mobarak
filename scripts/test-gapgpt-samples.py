"""Offline tests: hard request admission, exact sample scope and no live calls."""
import importlib.util,json,os,tempfile,unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch
s=importlib.util.spec_from_file_location('gap',Path(__file__).with_name('gapgpt-dictionary-samples.py'));gap=importlib.util.module_from_spec(s);s.loader.exec_module(gap)
class Checks(unittest.TestCase):
 def test_only_three_maqayis_samples_and_blind_prompt(self):
  with tempfile.TemporaryDirectory() as tmp:
   data=gap.prepare(Path(tmp));self.assertEqual([e['root'] for e in data['entries']],['بسم','قسط','علم']);self.assertFalse(data['bulkAuthorizedAfterSampleReview'])
   entry=dict(data['entries'][0],referenceFa='HIDDEN_BASELINE');self.assertNotIn('HIDDEN_BASELINE',json.dumps(gap.messages(entry)))
 def test_budget_admission_stops_before_10_and_cannot_be_raised_to_11(self):
  with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'QURAN_TRANSLATION_BUDGET_USD':'11'}):
   ledger=gap.Ledger(Path(tmp))
   ledger.transaction(lambda d:d['requests'].update({'old':{'reservedUsd':'9.9999','chargedUsd':'9.9999'}}))
   with self.assertRaises(ValueError):ledger.reserve('new','gemini-3.1-flash-lite',[{'role':'user','content':'سلام'}],4096)
   self.assertNotIn('new',json.loads((Path(tmp)/'budget.json').read_text())['requests'])
 def test_saved_lower_cap_is_still_respected(self):
  with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'QURAN_TRANSLATION_BUDGET_USD':'10'}):
   ledger=gap.Ledger(Path(tmp))
   def lower(d):
    d['ceilingUsd']='8';d['requests']['old']={'reservedUsd':'7.9999','chargedUsd':'7.9999'}
   ledger.transaction(lower)
   with self.assertRaises(ValueError):ledger.reserve('new','gemini-3.1-flash-lite',[],4096)
 def test_settle_uses_user_rates_and_preserves_unknown_reservations(self):
  with tempfile.TemporaryDirectory() as tmp:
   ledger=gap.Ledger(Path(tmp));ledger.reserve('one','gemini-3.1-flash-lite',[],4096)
   self.assertEqual(ledger.settle('one',{'prompt_tokens':1000,'completion_tokens':2000}),Decimal('.00325'))
   with self.assertRaises(ValueError):ledger.reserve('one','gemini-3.1-flash-lite',[],4096)
   ledger.reserve('unknown','gemini-4-argon',[],1536)
   with self.assertRaises(ValueError):ledger.settle('unknown',{})
   record=json.loads((Path(tmp)/'budget.json').read_text())['requests']['unknown'];self.assertIn('reservedUsd',record);self.assertNotIn('chargedUsd',record)
 def test_provider_overage_halts_future_requests(self):
  with tempfile.TemporaryDirectory() as tmp:
   ledger=gap.Ledger(Path(tmp));ledger.reserve('bad','gemini-3.1-flash-lite',[],1);ledger.settle('bad',{'prompt_tokens':100000,'completion_tokens':100000})
   with self.assertRaises(ValueError):ledger.reserve('more','gemini-3.1-flash-lite',[],1)
 def test_missing_key_causes_no_api_call(self):
  with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'QURAN_TRANSLATION_API_KEY':''}),patch.object(gap.urllib.request,'urlopen') as request:
   with self.assertRaises(SystemExit):gap.run_samples(Path(tmp))
   request.assert_not_called()
if __name__=='__main__':unittest.main()
