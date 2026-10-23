"""Publish separately stored, source-bound semantic previews without changing full entries."""
import argparse,hashlib,json,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('summary_job',ROOT/'scripts/rewrite-root-summaries.py');job=importlib.util.module_from_spec(spec);spec.loader.exec_module(job)
def publish(book):
 reviewed=job.JOB/(book+'-reviewed.json')
 source={r['id']:r for r in job.source_rows(book)}
 values=json.loads(reviewed.read_text())
 if set(values)!=set(source):raise ValueError('Missing or extra source entries')
 # Direct source edits and user-specified examples, checked against the source.
 corrections={
  'tahqiq':{'نسي:0':'غفلت شخص از چیزی که به خاطر داشته است.','وجد:0':'ادراک و دریافتن چیزی در حالتی حادث.','بغل:0':'حیوانی میان اسب و الاغ (قاطر).','الف:0':'همزهٔ استفهام؛ پرسیدن و طلب فهم.','ترق:0':'بالارفتن تدریجی و درجه‌به‌درجه.','سنو:0':'دگرگونی و تحول.','مصر:0':'نام سرزمین مصر.','شقو:0':'حالتی از شدت و رنج که راه خیر و صلاح و کمال را می‌بندد و در برابر سعادت قرار می‌گیرد.'},
  'maqayis':{'زني:0':'زنا؛ بالارفتن از کوه؛ کوتاهی؛ نگه‌داشتن ادرار (معانی مستقل).','سري:0':'سخاوت و جوانمردی؛ کنارزدن و آشکارکردن؛ سفر شبانه؛ بلندی و پشتِ چیزی (معانی جداگانه).','سلق:0':'زمین هموار و پست؛ ماده‌گرگ؛ فریادزدن؛ سرشت؛ اثر تسمه؛ بالارفتن از دیوار؛ برگ‌ریزه؛ پوست‌ریزی زبان؛ چرب‌کردن مشک؛ تاکردن خورجین (معانی جداگانه).','فقع:0':'قارچ دنبلان؛ صدای ترکیدن یا شکستن؛ زردِ خالص؛ بدحالی و بلا؛ نوشیدنیِ کف‌دار و حباب (معانی مستقل).','لوت:0':'خبر دادن از چیزی غیر از آنچه پرسیده شده؛ کتمان (صحت هر دو معنا محل تردید است).','حيث:0':'واژه‌ای مبهم برای اشاره به هر مکان.','اخو:0':'همزه بدل از واو دانسته شده و معنای مستقلی برای این صورت ذکر نشده است.','ستت:0':'عدد شش.','مجس:0':'مجوس و مجوس‌شدن (واژه‌ای احتمالاً فارسی و بدون قیاس شناخته‌شده).','تور:0':'«تَوْر»: فرستاده میان قوم (اعتبار این ریشه پذیرفته نشده است).','همن:0':'برای «همن» اصل معتبری پذیرفته نشده است؛ «مُهَیمِن» به معنای گواه، از «امن» دانسته شده است.','نسي:0':'از یاد بردن چیزی؛ ترک کردن چیزی.','وجد:0':'یافتن چیزی (کاربرد «وِجدان» در معنای خشم نیز گزارش شده است).'},
 }
 for key,text in corrections.get(book,{}).items():
  if key in values:values[key].update(summary=text,needsReview=False,note='بازبینی مستقیم با متن مأخذ و در موارد ارجاعی با عنوان ثبت‌شده در provenance؛ نمونه‌های صریح کاربر حفظ شدند.')
 # The Arabic K-D-H passage is correct, but its old Persian body is Haman's.
 if book=='tahqiq' and 'كدح:0' in values and 'هامان' in source['كدح:0']['fa'] and 'جهد في تعب مع استمرار' in source['كدح:0']['ar']:
  values['كدح:0'].update(summary='تلاش و کوشش همراه با رنج و استمرار.',needsReview=False,sourceWarning='شرح فارسیِ قدیمی این مدخل با متن عربی تطابق ندارد؛ خلاصهٔ جدید از متن عربیِ کدح استخراج شده است.')

 public={}
 for identity,row in values.items():
  original=source[identity]
  if row['sourceSha256']!=original['sourceSha256']:raise ValueError('Source changed: '+identity)
  if not row.get('summary') and not row.get('needsReview'):raise ValueError('Missing definition: '+identity)
  public.setdefault(original['root'],[]).append({k:row[k] for k in ['word','summary','needsReview','sourceSha256']+(['sourceWarning'] if row.get('sourceWarning') else [])})
 # Preserve source order for the handful of roots with several entries.
 for root,entries in public.items():
  order=[r['word'] for r in source.values() if r['root']==root]
  entries.sort(key=lambda r:order.index(r['word']))
 canonical={'schemaVersion':1,'book':book,'policy':'direct-semantic-core-v2','model':__import__('os').environ.get('QURAN_TRANSLATION_MODEL'),'reviewModels':sorted({r.get('reviewModel','manual') for r in values.values()}),'entries':values}
 job.budget.save(ROOT/'data/root-summaries'/(book+'.json'),canonical)
 job.budget.save(ROOT/'public/data'/(book+'-summaries.json'),{'schemaVersion':1,'book':book,'entries':public})
 print(book,'published',len(values),'previews;',sum(r['needsReview'] for r in values.values()),'require source review')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('book',choices=['tahqiq','maqayis']);publish(p.parse_args().book)
