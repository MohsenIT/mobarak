# Bale ↔ GitHub Issues Bridge

پل TypeScript برای Cloudflare Workers + D1 و API رسمی بله/GitHub. GitHub مرجع وضعیت است؛ هر Issue یک پست کانال و یک ترد دیدگاه متناظر دارد. وضعیت استقرار و آزمون واقعی در [PHASE_ZERO.md](PHASE_ZERO.md) ثبت می‌شود؛ عبور تست محلی به‌تنهایی پذیرش E2E نیست.

## امکانات

- گزارش خصوصی، تشخیص دسته، جستجوی موضوع مشابه و تأیید صریح قبل از انتشار عمومی.
- نگاشت خودکار پست به ترد واقعی گروه دیدگاه، همگام‌سازی نظرها و ویرایش‌ها، جلوگیری از حلقه.
- به‌روزرسانی همان پست برای وضعیت/برچسب و اطلاع به گزارش‌دهنده اولیه.
- D1 inbox و effect journal، جلوگیری از تکرار، backoff، توقف عملیات مبهم برای جلوگیری از ساخت پست تکراری.
- اعتبارسنجی HMAC گیت‌هاب، راز مسیر وب‌هوک بله، محدودیت ورودی و دسترسی مدیر.
- گزارش محتوای نامناسب، شناسه نمایشی نویسنده بله، حذف پیش‌نویس و توقف پیگیری خصوصی.

## توسعه و تست

Node.js 24 و npm لازم است:

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run test:integration
python3 -m unittest discover -s tests -v
```

آزمون یکپارچه از D1 واقعی شبیه‌ساز Cloudflare و HTTP mock استفاده می‌کند؛ داده محلی ساختگی جدا از شواهد واقعی بله است. ساخت `npm run build` dry-run است و استقرار نمی‌کند.

## استقرار

1. حساب Cloudflare Free و API Token با Workers Scripts Edit و D1 Edit آماده شود. دامنه پولی یا VPS لازم نیست.
2. D1 ساخته و database_id واقعی در wrangler.jsonc تنظیم شود. سپس migrationها با Wrangler اعمال شوند.
3. Secrets: BALE_TOKEN، GITHUB_TOKEN، BALE_WEBHOOK_SECRET، GITHUB_WEBHOOK_SECRET، ADMIN_SECRET. رازها را در فایل Git یا فرمان دارای مقدار مستقیم ننویسید؛ از ورودی امن `wrangler secret put` استفاده کنید.
4. vars عمومی شامل مخزن، شناسه کانال/گروه/بات و username کانال تنظیم شوند. CATEGORIES_JSON اختیاری فهرست `{key,label,hashtag}` است. BRIDGE_ENABLED تا آماده‌شدن تنظیمات و تست true نشود.
5. `npm run deploy` و ساخت وب‌هوک GitHub برای events: issues و issue_comment، content_type: json، TLS فعال. URL: `/webhooks/github` با secret مستقل.
6. وب‌هوک رسمی بله به `/webhooks/bale/SECRET` تنظیم شود. بات باید در کانال مجوز ارسال/ویرایش و در گروه متصل دسترسی پیام‌ها داشته باشد. حریم خصوصی و نمایش عمومی دیدگاه‌ها به کاربران اعلام شود.
7. برای Issueهای قدیمی از مسیر مدیر `/admin/sync` استفاده شود؛ در حالت عادی webhookها ادامه همگام‌سازی را انجام می‌دهند.

اسکریپت‌های Python پوشه scripts برای راه‌اندازی همین محیط از `.secrets` استفاده می‌کنند و توکن را در argv چاپ نمی‌کنند. `.secrets`، `.tools` و داده‌های محلی داخل سورس منتشر نمی‌شوند. برای CI، Wrangler از متغیرهای محیطی Secrets استفاده می‌کند.

جزئیات خطا، آشتی‌دادن عملیات مبهم، نگه‌داری داده و محدودیت‌ها: [راهنمای راهبری](docs/OPERATIONS.fa.md). آزمون فاز صفر: [راهنما](docs/phase-zero-runbook.md)، [نتایج](PHASE_ZERO.md).

## محل سورس و CI/CD

گردش‌کار GitHub برای قرارگیری مستقل این سرویس در `tools/bale-issues-bridge` مخزن MohsenIT/mobarak آماده شده است. فایل گردش‌کار باید در `.github/workflows/bale-issues-bridge.yml` ریشه مخزن قرار گیرد؛ تغییرات اپ اصلی وارد ساخت این سرویس نمی‌شوند. پس از عبور تست‌ها، push به main فقط برای مسیرهای همین سرویس باعث migration و deploy می‌شود. Secrets لازم در GitHub: `MOBARAK_BRIDGE_CF_TOKEN` و `MOBARAK_BRIDGE_CF_ACCOUNT_ID`. توکن بله/GitHub و رازهای وب‌هوک در Cloudflare باقی می‌مانند و به GitHub Actions منتقل نمی‌شوند. فعال‌بودن واقعی CI/CD پس از انتشار سورس و ثبت این دو Secret قابل تأیید است.

## نتیجه آزمون واقعی

در ۲۰ آبان ۱۴۰۵، گزارش از رابط رسمی بات به Issue آزمایشی [#5](https://github.com/MohsenIT/mobarak/issues/5) و پست [36 کانال](https://ble.ir/mobarak_issues/36) تبدیل شد. دیدگاه بله به GitHub و پاسخ GitHub به دیدگاه همان پست رسید؛ تغییر برچسب به enhancement متن اصلی را به #بهبود تغییر داد و بستن Issue همان پست را ویرایش کرد. اعلان خصوصی نتیجه نیز دریافت شد. گزارش واقعی #4 باز ماند. جزئیات و محدودیت‌های تحویل در [گزارش پذیرش](docs/ACCEPTANCE.fa.md) است.
