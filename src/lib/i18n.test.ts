import {describe,test,expect} from 'bun:test'
import {readFileSync,readdirSync} from 'node:fs'
import ts from 'typescript'
import {t,resolveLanguage,uiDirection,setUiLanguage,UI_LANGUAGES,languageLabel,languageName} from './i18n'
import fa from '@/messages/fa.json'
import {EXTRA_TRANSLATIONS,isTranslator,defaultTranslation} from './translations'
describe('language and translation contracts',()=>{
 test('language matching uses supported device language before unsupported fallbacks',()=>{expect(resolveLanguage(['zz-ZZ','en-US','fa'])).toBe('en');expect(resolveLanguage(['pt-BR'])).toBe('pt');expect(resolveLanguage(['zz'])).toBeNull();expect(uiDirection('ur')).toBe('rtl');expect(uiDirection('en')).toBe('ltr')})
 test('all UI catalogues have the same keys and interpolation placeholders',()=>{for(const language of UI_LANGUAGES){const messages=JSON.parse(readFileSync(`src/messages/${language}.json`,'utf8'));expect(Object.keys(messages).sort()).toEqual(Object.keys(fa).sort());for(const key of Object.keys(fa)){expect(typeof messages[key]).toBe('string');expect(messages[key].trim().length).toBeGreaterThan(0);expect((messages[key].match(/\{\w+\}/g)||[]).sort()).toEqual(((fa as Record<string,string>)[key].match(/\{\w+\}/g)||[]).sort())}}})
 test('reader labels are externalized instead of hardcoded in JSX',()=>{
  const visibleProps=new Set(['title','aria-label','placeholder','alt'])
  for(const file of [...readdirSync('src/components/quran').filter(name=>name.endsWith('.tsx')).map(name=>`src/components/quran/${name}`),'src/app/page.tsx']){
   const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
   const visit=(node:ts.Node)=>{
    if(ts.isJsxText(node))expect(/[\u0621-\u064a\u067e\u0686\u0698\u06af\u06a9\u06cc]/.test(node.text)).toBe(false)
    if(ts.isJsxAttribute(node)&&visibleProps.has(node.name.getText(source))&&node.initializer&&ts.isStringLiteral(node.initializer))expect(/[\u0621-\u064a\u067e\u0686\u0698\u06af\u06a9\u06cc]/.test(node.initializer.text)).toBe(false)
    ts.forEachChild(node,visit)
   };visit(source)
  }
 })
 test('language names have a native and English label even when ICU lacks the locale',()=>{
  expect(UI_LANGUAGES.slice(0,3)).toEqual(['fa','ar','en'])
  expect(languageLabel('tt')).toBe('Tatar · татар')
  expect(languageLabel('fa')).toBe('Persian · فارسی')
  for(const code of UI_LANGUAGES){expect(languageName(code)).not.toBe(code);expect(languageName(code,'en')).not.toBe(code)}
 })
 test('only registered translations can be restored from a link',()=>{expect(isTranslator('en.sahih')).toBe(true);expect(isTranslator('../../secret')).toBe(false);expect(defaultTranslation('en')).toBe('en.sahih');expect(defaultTranslation('fa')).toBe('s');expect(new Set(EXTRA_TRANSLATIONS.map(item=>item.language)).size).toBe(43)})
 test('translations preserve complete ordered source arrays and recorded empty verses',()=>{for(const item of EXTRA_TRANSLATIONS){const rows=JSON.parse(readFileSync(`public/data/translations/${item.id}.json`,'utf8'));expect(rows.length).toBe(6236);expect(rows.every((row:unknown)=>typeof row==='string')).toBe(true);expect(rows.filter((row:string)=>row.trim()).length).toBe(item.translatedVerses)}})
 test('fallback stays Persian and substitution never injects markup',async()=>{await setUiLanguage('fa',false);expect(t('language.suggestBody',{language:'<b>English</b>'})).toContain('<b>English</b>');expect(t('unknown.key')).toBe('unknown.key');expect(await setUiLanguage('zz',false)).toBe(false)})
})
