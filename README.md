# Quran Vajeh — قرآن واژه

قرآن‌خوان فارسی با نمایش مصحف و متن پیوسته، ترجمه و تحلیل ریشهٔ واژه‌ها.

[نسخهٔ آنلاین قرآن واژه](https://quran-vajeh.pastelcat2.chatgpt.site) — با ورود به حساب مالک سایت.

شناسهٔ سایت در `.openai/hosting.json` ذخیره شده است تا در توسعه‌های بعدی همان سایت به‌روزرسانی شود. نسخهٔ فعلی در Sites منتشر شده؛ اتصال خودکار به گیت‌هاب هنوز نیاز به راه‌اندازی میزبان دارد.

## توسعه از هر دستگاه

[باز کردن محیط توسعه در مرورگر](https://codespaces.new/MohsenIT/quran-vajeh)

با حساب گیت‌هاب صاحب مخزن وارد شوید و یک Codespace بسازید. نصب وابستگی‌ها و اجرای پیش‌نمایش روی پورت ۳۰۰۰ خودکار است. در تب Ports می‌توانید پیش‌نمایش را باز کنید؛ همین محیط با ورود به همان حساب از دستگاه دیگر قابل ادامه است. پس از ویرایش، تغییرات را commit و push کنید تا در مخزن ذخیره شوند. مصرف محیط تابع سهمیهٔ Codespaces حساب شماست؛ پس از کار آن را متوقف کنید.

هر push به main و هر pull request به‌صورت خودکار build می‌شود. برای انتشار خودکار، مخزن را در Vercel وارد کنید، Next.js را انتخاب کنید و نام پروژه را `quran-vajeh` بگذارید. پس از اتصال، push به main نسخهٔ اصلی و pull request پیش‌نمایش جداگانه می‌سازد. برنامهٔ قرآن به متغیر محیطی نیاز ندارد.

## Run locally or in a cloud development environment

Requirements: Node.js 20.9+ and Bun (the project includes `bun.lock`).

```sh
bun install --frozen-lockfile
bun run dev
```

Open port 3000. In a cloud workspace, use its forwarded port preview.

```sh
bun run build
bun run start
```

The Quran reader loads its text, translations, roots, and fonts from `public/data`; its core functionality does not require a database or API key. Preferences and bookmarks stay in the browser's local storage.

## Structure

- `src/app/page.tsx`: reading state and navigation
- `src/components/quran/`: Quran display, settings, and root analysis
- `src/lib/quran.ts`: data loading and keyword scoring
- `public/data/`: local Quran datasets, translations, and fonts
- `prisma/schema.prisma`: optional database scaffold

For optional database development, copy `.env.example` to `.env` and run `bun run db:generate` followed by `bun run db:migrate`. Never upload `.env` or local database files.

`.zscripts/` contains scripts from the project's previous hosting environment. Use the commands above for normal development.
