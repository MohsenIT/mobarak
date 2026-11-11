import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rules,redact,validateReport,githubDraft,usefulComment} from '../src/intake-domain.ts';
import {faq,relevantKnowledge} from '../src/knowledge.ts';
import {imageType} from '../src/attachments.ts';
test('complete report has zero questions and only explicit environment',()=>{
 const r=rules('وقتی توی موبایل روی واژه می‌زنم و پنل تحلیل رو می‌بندم، جای مطالعه‌ام گم می‌شه.');
 assert.equal(r.needs_clarification,false);assert.equal(r.intent,'bug');assert.equal(r.environment.platform,'موبایل');assert.equal(r.environment.browser,undefined);
});
test('vague search gets useful predictable options; feature needs no type question',()=>{
 const r=rules('جستجو خرابه.');assert.equal(r.needs_clarification,true);assert.equal(r.suggested_buttons.length,4);
 const f=rules('کاش می‌شد چند تا آیه رو با هم انتخاب کرد و کپی گرفت.');assert.equal(f.intent,'feature');assert.equal(f.needs_clarification,false);
});
test('Quranic correction is never endorsed and empty fields are omitted',()=>{
 const r=rules('ترجمه آیه ۱۴ سوره طه یه مشکلی داره.');assert.equal(r.intent,'content');assert.equal(r.needs_human_review,true);
 const draft=githubDraft(r,'stable','شرح اصلی');assert.ok(draft.body.includes('تأیید نشده'));assert.equal(draft.body.includes('### Environment'),false);assert.equal(draft.body.includes('### Steps to Reproduce'),false);
});
test('sensitive text is redacted before the model and publication',()=>{
 const r=redact('ایمیل a@example.com تلفن 09123456789 و ۰۹۱۲۳۴۵۶۷۸۹ و کارت 6037991234567890');
 assert.equal(r.text.includes('example.com'),false);assert.equal(r.text.includes('09123456789'),false);assert.equal(r.text.includes('۰۹۱۲'),false);assert.equal(r.text.includes('603799'),false);
});
test('strict versioned schema rejects invalid model fields and uncertainty alone adds no question',()=>{
 const r=rules('وقتی پنل تحلیل را می‌بندم جای مطالعه قبلی از دست می‌رود.');r.confidence=0.1;assert.equal(validateReport(r).needs_clarification,false);
 assert.throws(()=>validateReport({...r,environment:{platform:123}}));assert.throws(()=>validateReport({...r,confidence:NaN}));assert.throws(()=>validateReport({...r,schema_version:'v99'}));
});
test('FAQ uses product knowledge; low-value thread messages are not mirrored',()=>{
 assert.ok(faq('چطور ترجمه رو عوض کنم؟'));assert.equal(faq('نسخه جدید چه روزی میاد؟'),null);assert.ok(relevantKnowledge('بن‌واژه').includes('ریشه'));
 assert.equal(usefulComment('ممنون'),false);assert.equal(usefulComment('من هم'),false);assert.equal(usefulComment('در فایرفاکس هم با بستن پنل، جای قبلی مطالعه گم می‌شود.'),true);
});
test('attachment signature allowlist rejects active content',()=>{
 assert.equal(imageType(new TextEncoder().encode('<svg>bad</svg>')),null);assert.equal(imageType(new Uint8Array([255,216,255,1])),'image/jpeg');
});
