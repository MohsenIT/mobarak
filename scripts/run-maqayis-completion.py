"""Durable API completion -> source-gated integration -> checked publication.
No ChatGPT worker is needed after launch. Restart this command after host shutdown.
"""
import argparse,datetime,fcntl,importlib.util,json,os,subprocess,sys
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('luna',ROOT/'scripts/finish-maqayis-luna.py');luna=importlib.util.module_from_spec(spec);spec.loader.exec_module(luna)
WORK=luna.WORK
ENV={**os.environ,'QURAN_TRANSLATION_BUDGET_USD':str(luna.bulk.read(luna.JOB/'budget.json',{}).get('ceilingUsd','10'))}

def command(args):
    subprocess.run(args,cwd=ROOT,env=ENV,check=True)

def snapshot(stage):
    index=luna.bulk.read(ROOT/'public/data/maqayis-index.json')
    state=luna.bulk.read(WORK/'status.json',{})
    budget=luna.bulk.read(luna.JOB/'budget.json',{'requests':{}})
    charged=sum(float(r.get('chargedUsd',0)) for r in budget['requests'].values())
    accounted=sum(float(r.get('chargedUsd',r['reservedUsd'])) for r in budget['requests'].values())
    now=datetime.datetime.now(ZoneInfo('Asia/Tehran')).isoformat(timespec='minutes')
    data={'stage':stage,'pid':os.getpid(),'updatedAt':now,'publishedCount':index['translatedCount'],'availableReferenceCount':index.get('availableReferenceCount'),'unavailableCount':len(index.get('unavailableRoots',{})),'completionCounts':state.get('counts',{}),'knownUsageUsd':round(charged,8),'accountedUsd':round(accounted,8),'budgetCapUsd':budget.get('ceilingUsd'),'additionalBudget':budget.get('additionalBudgetAuthorization'),'billingHalt':budget.get('halted'),'ishtiqaqiStarted':False}
    luna.bulk.save(WORK/'workflow-status.json',data)
    text=f'''# پیشرفت مقاییس

آخرین تصویر وضعیت: {now} (تهران). مرحله: `{stage}`. این گزارش هنگام انتشار خروجی به‌روز می‌شود، نه پس از هر درخواست API.

**{index['translatedCount']} مدخل آمادهٔ استفاده است.** در تب «ریشه»، بخش «مقاییس»، خلاصه، شرح فارسی، اصل عربی و منبع را باز کنید.

متن قابل تطبیق در نسخه‌های موجود برای **{index.get('availableReferenceCount',0)} ریشه** یافت شده است. برای **{len(index.get('unavailableRoots',{}))} صورت ریشه**، تطبیق مستقل با اطمینان انجام نشد یا فقط حاشیهٔ فاقد متن مؤلف در دسترس بود؛ برای آن‌ها متن ساخته نمی‌شود. آمار مرحلهٔ اجرای جاری: `{json.dumps(state.get('counts',{}),ensure_ascii=False)}`. این آمار با تعداد منتشرشده یکسان نیست.

هزینهٔ گزارش‌شدهٔ پاسخ‌ها: **{charged:.6f} دلار**؛ هزینه با احتساب رزروهای نامشخصِ حفظ‌شده: **{accounted:.6f} دلار**؛ اختلاف صورتحساب قبلی هنوز حل نشده؛ سقف مرحلهٔ تازه **۳ دلار اضافه** است، مستقل از هزینهٔ قبلی. مصرف تازه در دفتر محلی: **{max(0,accounted-float(budget.get('additionalBudgetAuthorization',{}).get('baselineAccountedUsd',accounted))):.6f} دلار**. مبلغ رزروهای نامشخص صفر فرض یا آزاد نشده است. توقف صورتحساب: `{budget.get('halted') or 'ندارد'}`.

تنظیمات تکمیل: مترجم `gpt-6-luna` با استدلال کم؛ ناظر اصلی `gemini-3-flash-preview` و Argon فقط برای ریسک مشخص مأخذ. ناظر Mini در آزمون واژگانیِ عربی کلاسیک خطا داشت؛ خروجی‌های آن پیش از انتشار دوباره بررسی می‌شوند. مدل فعال و نوع بازبینی هر مدخل در منبع آن ثبت است.

نسخهٔ متنی مستقل بدون حذف کلمات بازیابی شده است. بعضی مدخل‌های تازه متن مؤلف و حواشیِ مرجع را با هم دارند؛ حواشی می‌توانند متعلق به صفحه یا مدخل مجاور باشند. این تفاوت و خرابی‌های شناخته‌شدهٔ مأخذ در خود مدخل مشخص‌اند. ترجمهٔ کل متنِ مرجع به معنی تأیید کامل‌بودن اصل کتاب یا بازبینی انسانی نیست. ۷۴۱ ترجمهٔ پذیرفته‌شدهٔ قبلی حفظ شده‌اند.

اجرای API، ادغام، آزمون و ارسال خروجی به `main` توسط اسکریپت ادامه انجام می‌شود؛ عامل ChatGPT برای تولید ترجمه لازم نیست. پیشرفت و پاسخ‌ها ذخیره می‌شوند، ولی دوام فرایند پس از خاموش‌شدن میزبان تضمین نمی‌شود. فرمان ادامه: `python scripts/run-maqayis-completion.py --publish`.

**اشتقاقی شروع نشده است.** موارد ردشده یا ناقص به عنوان ترجمهٔ تأییدشده منتشر نمی‌شوند. اگر مرحله بودجه یا صورتحساب باشد، کار متوقف است و نباید کامل‌شده تلقی شود.
'''
    (ROOT/'docs/gapgpt-progress.md').write_text(text)
    return data

def integrate_and_publish(publish,final=False):
    command([sys.executable,'scripts/integrate-maqayis-luna.py'])
    command([sys.executable,'scripts/build-maqayis.py'])
    command([sys.executable,'scripts/test-maqayis.py'])
    if final:command(['/workspace/.onboarding-tools/node_modules/.bin/bun','run','build'])
    data=snapshot('final-checkpoint' if final else 'continuing')
    if not publish:return data
    allowed=['data/maqayis/translations.json','public/data/maqayis','public/data/maqayis-index.json','docs/gapgpt-progress.md']
    staged=subprocess.check_output(['git','diff','--cached','--name-only'],cwd=ROOT,text=True).splitlines()
    if any(not any(x==p or x.startswith(p+'/') for p in allowed) for x in staged):raise RuntimeError('Unrelated staged changes; publication stopped')
    command(['git','add','--',*allowed]);command(['git','diff','--cached','--check'])
    if subprocess.run(['git','diff','--cached','--quiet'],cwd=ROOT).returncode:
        command(['git','commit','-m',f"Publish checked Maqayis completion checkpoint ({data['publishedCount']} entries)"])
        command(['git','push','origin','HEAD:main'])
    return data

def run(publish):
    WORK.mkdir(parents=True,exist_ok=True)
    with (WORK/'workflow.lock').open('a') as own:
        fcntl.flock(own,fcntl.LOCK_EX|fcntl.LOCK_NB)
        snapshot('waiting-for-current-worker')
        # Wait for the separately launched worker to settle all in-flight requests.
        with (luna.JOB/'bulk/run.lock').open('a') as current:
            fcntl.flock(current,fcntl.LOCK_EX)
        integrate_and_publish(publish)
        for _ in range(2):
            if luna.bulk.read(luna.JOB/'budget.json',{}).get('halted'):break
            snapshot('running-api-completion')
            command([sys.executable,'scripts/finish-maqayis-luna.py','run','--concurrency','8','--retry-known-failures','--recheck-mini'])
            integrate_and_publish(publish)
            if luna.bulk.read(WORK/'status.json',{}).get('state') in ('blocked_billing','paused_allocation_or_budget'):break
        integrate_and_publish(publish,True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--publish',action='store_true');parser.add_argument('--snapshot-only',action='store_true');args=parser.parse_args()
    if args.snapshot_only:print(json.dumps(snapshot('running-api-completion'),ensure_ascii=False))
    else:
        try:run(args.publish)
        except Exception as error:
            luna.bulk.save(WORK/'workflow-error.json',{'errorType':type(error).__name__,'atUtc':luna.bulk.now()})
            raise
