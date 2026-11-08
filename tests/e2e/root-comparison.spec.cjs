const {test,expect}=require('@playwright/test');
// Characterization coverage for range comparison root visibility: which roots
// are highlighted, and what tapping a root does to the hidden/solo state.
// The pure decision logic now lives in src/lib/root-comparison.ts (unit
// tested); these tests pin the same behavior through the real UI, since it was
// previously untested end to end. Surah 55 (Ar-Rahman) verses 1-13 is used
// because its refrains share a substantial set of roots with the rest of the
// surah, which is what makes the comparison non-empty.

async function setup(page, theme='paper'){
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(t=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
  localStorage.setItem('mushaf.theme',JSON.stringify(t));
 },theme);
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}
async function openComparison(page, from='1', to='13'){
 await page.locator('button[aria-label="منوی برنامه"]').click();
 await page.locator('.drawer-tool-row').filter({hasText:'ارتباط ریشه‌ای بازه آیات'}).click();
 const sheet=page.locator('.surah-index-drawer');
 await expect(sheet).toBeVisible();
 await sheet.getByLabel('از آیه').fill(from);
 await sheet.getByLabel('تا آیه').fill(to);
 // The rows are the shared roots; a range with none is a different test.
 await expect(sheet.locator('.flex-1.overflow-y-auto button').first()).toBeVisible({timeout:20000});
 return sheet;
}

/**
 * The range sheet covers the reader, and its open flag suppresses word taps.
 * Dismissing it leaves the comparison highlighting in place, which is the state
 * the reader actually interacts with.
 */
async function dismissSheet(page){
 await page.getByRole('button',{name:'بستن مقایسه'}).click();
 await expect(page.locator('.surah-index-drawer')).toHaveCount(0);
 // The reader-side band confirms the comparison highlight is still live.
 await expect(page.locator('.comparison-range-band').first()).toBeVisible({timeout:20000});
}

test('comparison highlights shared roots and tapping one mutes exactly that root',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await openComparison(page);
 await dismissSheet(page);
 const shared=page.locator('.quran-word.comparison-shared');
 await expect(shared.first()).toBeAttached({timeout:20000});

 const target=shared.first();
 const root=await target.getAttribute('data-comparison-root');
 const all=[...new Set(await page.locator('.quran-word[data-comparison-root]').evaluateAll(nodes=>nodes.map(n=>n.dataset.comparisonRoot)))];
 expect(all.length).toBeGreaterThan(1);
 const sameRoot=page.locator(`.quran-word[data-comparison-root="${root}"]`);
 const sameRootCount=await sameRoot.count();

 // Tapping a highlighted word mutes its whole root — and only its root.
 await target.click();
 await expect(page.locator('.quran-word.comparison-muted')).toHaveCount(sameRootCount);
 for(const other of all.filter(r=>r!==root)) await expect(page.locator(`.quran-word[data-comparison-root="${other}"].comparison-muted`)).toHaveCount(0);

 // The reader-side chip reports the muted count and restores every root.
 const reset=page.getByRole('button',{name:'روشن کردن همهٔ ریشه‌ها'});
 await expect(reset).toBeVisible();
 await reset.click();
 await expect(page.locator('.quran-word.comparison-muted')).toHaveCount(0);
});

test('tapping a muted root restores it and leaves other muted roots alone',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await openComparison(page);
 await dismissSheet(page);
 const shared=page.locator('.quran-word.comparison-shared');
 await expect(shared.first()).toBeAttached({timeout:20000});

 const firstRoot=await shared.first().getAttribute('data-comparison-root');
 await shared.first().click();
 await expect(page.locator(`.quran-word[data-comparison-root="${firstRoot}"]`).first()).toHaveClass(/comparison-muted/);

 const second=page.locator('.quran-word.comparison-shared:not(.comparison-muted)').first();
 const secondRoot=await second.getAttribute('data-comparison-root');
 expect(secondRoot).not.toBe(firstRoot);
 await second.click();
 await expect(page.locator(`.quran-word[data-comparison-root="${secondRoot}"]`).first()).toHaveClass(/comparison-muted/);
 // Two roots muted, so the chip reports the count and offers to reveal them.
 const mutedChip=page.getByRole('button',{name:'روشن کردن همهٔ ریشه‌ها'});
 await expect(mutedChip).toBeVisible();
 await expect(mutedChip).toContainText('ریشه پنهان');

 // Revealing the first root must not reveal the second.
 await page.locator(`.quran-word[data-comparison-root="${firstRoot}"].comparison-muted`).first().click();
 await expect(page.locator(`.quran-word[data-comparison-root="${firstRoot}"].comparison-muted`)).toHaveCount(0);
 await expect(page.locator(`.quran-word[data-comparison-root="${secondRoot}"]`).first()).toHaveClass(/comparison-muted/);
});

test('long-pressing a root solos it, muting every other root until it is cleared',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await openComparison(page);
 await dismissSheet(page);

 // Solo mode is entered by long-pressing a highlighted word (never a mouse
 // press, and never a plain tap).
 const target=page.locator('.quran-word.comparison-shared').first();
 await expect(target).toBeAttached({timeout:20000});
 const soloName=(await target.getAttribute('data-comparison-root')).trim();
 await target.evaluate(node=>{
  const rect=node.getBoundingClientRect();
  const init={bubbles:true,cancelable:true,pointerType:'touch',pointerId:1,isPrimary:true,button:0,buttons:1,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2};
  node.dispatchEvent(new PointerEvent('pointerdown',init));
 });
 await page.waitForTimeout(700);
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:1,isPrimary:true})));

 // The reader now shows a solo chip naming that root.
 const soloChip=page.getByRole('button',{name:'نمایش همهٔ ریشه‌ها'});
 await expect(soloChip).toBeVisible({timeout:20000});
 await expect(soloChip).toContainText(soloName.split('').join(' '));

 // Every other root is muted; the soloed one is not.
 const others=page.locator(`.quran-word.comparison-shared:not([data-comparison-root="${soloName}"])`);
 const otherCount=await others.count();
 expect(otherCount).toBeGreaterThan(0);
 await expect(page.locator('.quran-word.comparison-muted')).toHaveCount(otherCount);
 await expect(page.locator(`.quran-word[data-comparison-root="${soloName}"].comparison-muted`)).toHaveCount(0);

 // Leaving solo mode restores every root.
 await soloChip.click();
 await expect(page.locator('.quran-word.comparison-muted')).toHaveCount(0);
});

test('closing the comparison clears every comparison highlight',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await openComparison(page);
 await dismissSheet(page);
 await expect(page.locator('.quran-word.comparison-shared').first()).toBeAttached({timeout:20000});
 await page.getByRole('button',{name:'پاک کردن هایلایت مقایسه'}).click();
 await expect(page.locator('.quran-word.comparison-shared')).toHaveCount(0);
 await expect(page.locator('.quran-word.comparison-muted')).toHaveCount(0);
});
