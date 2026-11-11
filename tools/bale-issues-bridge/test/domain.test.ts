import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,similarity,classify,defaultCategories,channelPost,categories,githubComment} from '../src/domain.ts';
test('normalizes Persian/Arabic letters and diacritics for duplicate detection',()=>{
 assert.equal(normalize('كِتاب ي'),normalize('کتاب ی'));
 assert.equal(similarity('جستجوی کِتاب عربي','جستجوی کتاب عربی'),1);
 assert.equal(similarity('جستجوی کتاب','پخش صوت سوره'),0);
});
test('renders canonical GitHub status and configurable category on one original post',()=>{
 const text=channelPost({id:1,number:42,title:'خطای جستجو',body:'توضیح\n<!-- secret marker -->',state:'closed',state_reason:'completed',html_url:'https://github.com/o/r/issues/42',labels:[{name:'enhancement'}]},defaultCategories);
 assert.ok(text.includes('#بهبود'));assert.ok(text.includes('بسته‌شده'));assert.ok(!text.includes('secret marker'));assert.ok(text.includes('#42'));
 assert.equal(classify('پیشنهاد: افزودن قابلیت',defaultCategories).key,'suggestion');
 assert.throws(()=>categories('[{"key":"x","label":"a","hashtag":"bad tag"}]'));
});
test('bridge comment attribution is outside quoted user content',()=>{
 assert.ok(githubComment('from GitHub\nhello','کاربر بله','b:1').includes('> from GitHub\n> hello'));
});
