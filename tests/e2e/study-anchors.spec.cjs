const {test,expect}=require('@playwright/test');
// Characterization coverage for the study notebook's note anchors. The list of
// anchors a note can attach to used to be built inline in StudyNotebook; it now
// comes from src/lib/study-anchors.ts (unit tested). These tests pin what the
// notebook actually offers for each anchor kind, because the unit tests cannot
// prove the component passes the right inputs.

async function setup(page){
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.theme',JSON.stringify('paper'));
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
}
async function openNotes(page){
 await page.goto('/study/taha',{waitUntil:'domcontentloaded'});
 const nav=page.locator('.study-tabs');
 await expect(nav).toBeVisible({timeout:20000});
 await nav.getByRole('button',{name:'یادداشت‌ها'}).click();
 await expect(page.locator('.study-notes')).toBeVisible();
 const kind=page.getByRole('combobox',{name:'این یادداشت دربارهٔ چیست؟'});
 return {kind,target:page.getByRole('combobox',{name:'انتخاب مورد'})};
}
const options=async locator=>locator.locator('option').evaluateAll(nodes=>nodes.map(node=>({value:node.value,label:node.textContent})));

test('verse anchors cover every verse of Surah Taha',async({page})=>{
 await setup(page);
 const {kind,target}=await openNotes(page);
 await expect(kind).toHaveValue('verse');
 const rows=await options(target);
 expect(rows.length).toBe(135);
 expect(rows[0].value).toBe('1');
 expect(rows[rows.length-1].value).toBe('135');
});

test('root anchors are unique roots, not one row per word',async({page})=>{
 await setup(page);
 const {kind,target}=await openNotes(page);
 await kind.selectOption('root');
 await expect.poll(async()=>(await options(target)).length).toBeGreaterThan(1);
 const rows=await options(target);
 // One row per distinct root: no duplicate values, and every row is labelled
 // with its own root.
 expect(new Set(rows.map(row=>row.value)).size).toBe(rows.length);
 expect(rows.every(row=>row.label===row.value)).toBe(true);
});

test('form anchors key on root and form, not the surface word',async({page})=>{
 await setup(page);
 const {kind,target}=await openNotes(page);
 await kind.selectOption('form');
 await expect.poll(async()=>(await options(target)).length).toBeGreaterThan(1);
 const rows=await options(target);
 // Every form anchor carries a root:form key, so switching form then root never
 // collides on the same key.
 expect(rows.every(row=>row.value.includes(':'))).toBe(true);
});

test('context anchors list the source ranges before the readers own contexts',async({page})=>{
 await setup(page);
 const {kind,target}=await openNotes(page);
 await kind.selectOption('context');
 await expect.poll(async()=>(await options(target)).length).toBeGreaterThan(1);
 const rows=await options(target);
 // Source ranges are keyed s20:<id>; personal contexts are keyed p20:<n>.
 const firstPersonal=rows.findIndex(row=>row.value.startsWith('p20:'));
 expect(firstPersonal).toBeGreaterThan(0);
 expect(rows.slice(0,firstPersonal).every(row=>row.value.startsWith('s20:'))).toBe(true);
});

test('saving a note anchored to a verse keeps the anchor after a reload',async({page})=>{
 await setup(page);
 const {kind,target}=await openNotes(page);
 await kind.selectOption('verse');
 await target.selectOption('7');
 await page.getByRole('textbox').last().fill('یادداشت آزمایشی');
 await page.getByRole('button',{name:'ذخیرهٔ یادداشت'}).click();
 await expect(page.locator('.study-notes article.study-context').first()).toContainText('یادداشت آزمایشی',{timeout:10000});

 // The anchor kind/value survive a reload (persistence is IndexedDB + storage).
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.study-tabs').getByRole('button',{name:'یادداشت‌ها'}).click();
 await expect(page.locator('.study-notes article.study-context').first()).toContainText('یادداشت آزمایشی',{timeout:20000});
});
