const { test, expect } = require('@playwright/test');

test.skip(process.env.SEARCH_AND_GO_E2E !== '1', 'Run against a build with Search and Go enabled.');

async function openReader(page, path = '/s/20/a/34') {
  await page.addInitScript(() => {
    localStorage.setItem('mubarak.ui-language.v1', 'fa');
    localStorage.setItem('mushaf.safavi-default.v1', 'true');
  });
  await page.route('**/api/version', route => route.fulfill({ json: { version: 'fixture', releases: [] } }));
  await page.route('**/offline-manifest.json', route => route.fulfill({ json: { groups: { core: [] } } }));
  await page.goto(path);
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  await expect(page.locator('[data-reading-scroll] [data-pos]').first()).toBeAttached();
}

async function openSearchAndGo(page) {
  await page.locator('.reader-surah-link').click();
  const dialog = page.locator('[data-search-and-go]');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('the surah control opens the integrated surface, with browse and safe Enter', async ({ page }) => {
  await openReader(page);
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await expect(dialog.getByRole('slider')).toBeVisible();
  await expect(dialog.locator('[data-surah-row]')).toHaveCount(114);
  await field.fill('۳');
  await field.press('Enter');
  await expect(field).toHaveValue('۳');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('option', { selected: true })).toHaveCount(0);
  await field.press('ArrowDown');
  await expect(dialog.getByRole('option', { selected: true })).toHaveCount(1);
  await field.fill('بقره ۲۵۵');
  await expect(dialog.getByRole('option', { selected: true })).toHaveCount(1);
  await field.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/s\/2\/a\/255$/);
});

test('one field runs live text search and restores browsing when cleared', async ({ page }) => {
  await page.addInitScript(() => { window.SpeechRecognition = class { abort() {} }; });
  await openReader(page);
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await expect(field).toHaveAttribute('placeholder', /جست‌وجوی پیشرفته.*س ۲۰.*اسما الحسنی/);
  await expect(dialog.locator('header h2:visible')).toHaveCount(0);
  await expect(dialog.locator('.search-and-go-header')).toHaveCSS('border-bottom-width', '0px');
  await expect(dialog.locator('.drawer-content-shell')).toHaveCSS('border-top-width', '1px');
  await expect(dialog.locator('.search-and-go-help-icon')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await expect(dialog.getByRole('button', { name: 'بازگشت به قرآن' }).locator('.lucide-arrow-right')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'تایپ با صدا' })).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => {
    const input = el.querySelector('.search-page-input').getBoundingClientRect();
    const chip = el.querySelector('.drawer-recent-shortcuts:not([inert]) .chip').getBoundingClientRect();
    return Math.abs(input.right - chip.right) < 1 && input.bottom < chip.top;
  })).toBe(true);
  await field.focus();
  await expect(dialog.locator('.search-and-go-history')).toHaveCount(0);
  const href = page.url();
  await field.fill('«اسما الحسنی»');
  await expect(dialog.locator('[data-surah-row]')).toHaveCount(0);
  await expect(dialog.locator('.search-result-open').first()).toBeVisible({ timeout: 20000 });
  await expect(dialog.locator('.search-result-open')).toHaveCount(4);
  await expect(field).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'تایپ با صدا' })).toHaveCount(0);
  await field.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(href);
  await dialog.getByRole('button', { name: 'پاک کردن عبارت' }).click();
  await expect(dialog.locator('[data-surah-row]')).toHaveCount(114);
  const guide = dialog.getByRole('button', { name: 'راهنمای جست‌وجو' });
  await guide.click();
  await expect(dialog.locator('.search-and-go-help')).toContainText('اسما الحسنی');
  await guide.click();
  await expect(dialog.getByRole('slider')).toBeVisible();
});

test('recent Taha restores its last reading passage after a reload', async ({ page }) => {
  await openReader(page, '/s/20/a/40');
  const anchor = page.locator('[data-reading-scroll] [data-surah="20"][data-ayah="40"][data-pos="1"]');
  await anchor.evaluate(el => {
    const scroll = el.closest('[data-reading-scroll]');
    scroll.scrollTop += el.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mushaf.surah-positions.v1') || '{}')['20']?.a)).toBe(40);
  const dialog = await openSearchAndGo(page);
  await dialog.getByRole('combobox').fill('بقره ۲۵۵');
  await dialog.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/\/s\/2\/a\/255$/);
  await page.reload();
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  const reopened = await openSearchAndGo(page);
  await reopened.locator('.drawer-recent-shortcuts:not([inert])').getByRole('button', { name: 'طه', exact: true }).click();
  await expect(page).toHaveURL(/\/s\/20\/a\/40(?:\/w\/\d+)?$/);
});

test('executed jumps still record history while empty focus keeps only surah shortcuts', async ({ page }) => {
  await openReader(page);
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await field.focus();
  expect(await page.evaluate(() => localStorage.getItem('mushaf.search-and-go-history.v1'))).toBeNull();
  await field.fill('طه ۴۰');
  await field.press('Enter');
  await expect(page).toHaveURL(/\/s\/20\/a\/40$/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mushaf.search-and-go-history.v1'))[0].operation.type)).toBe('navigation');
  await openSearchAndGo(page);
  await field.focus();
  await expect(dialog.locator('.search-and-go-history')).toHaveCount(0);
  await expect(dialog.locator('.drawer-recent-shortcuts:not([inert]) .chip').first()).toBeVisible();
});

test('typing, closing, Back and Forward preserve the visual reading context', async ({ page }) => {
  await openReader(page, '/s/20/a/34');
  const origin = page.locator('[data-reading-scroll] [data-surah="20"][data-ayah="34"][data-pos="1"]');
  const offset = await origin.evaluate(async el => {
    await document.fonts.ready;
    const scroll = el.closest('[data-reading-scroll]');
    scroll.scrollTop += el.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 19;
    return el.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
  });
  const initialLength = await page.evaluate(() => history.length);
  let dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await dialog.getByRole('button', { name: 'بازگشت به قرآن' }).press('ArrowLeft');
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/);
  await field.pressSequentially('abc');
  await field.fill('');
  expect(await page.evaluate(() => history.length)).toBe(initialLength + 1);
  await dialog.getByRole('button', { name: 'بازگشت به قرآن' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/);

  dialog = await openSearchAndGo(page);
  await field.fill('بقره ۲۵۵');
  await field.press('Enter');
  await expect(page).toHaveURL(/\/s\/2\/a\/255$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-search-page]')).toHaveCount(0);
  await expect.poll(() => origin.evaluate((el, offset) => Math.abs(el.getBoundingClientRect().top - el.closest('[data-reading-scroll]').getBoundingClientRect().top - offset), offset)).toBeLessThanOrEqual(2);
  await page.goForward();
  await expect(page).toHaveURL(/\/s\/2\/a\/255$/);
  await expect(dialog).toHaveCount(0);
});

test('mushaf page commands keep the mode through traversal and reload', async ({ page }) => {
  await openReader(page, '/p/42');
  const dialog = await openSearchAndGo(page);
  await dialog.getByRole('combobox').fill('صفحه ۶۰۴');
  await dialog.getByRole('combobox').press('Enter');
  await expect(page).toHaveURL(/\/p\/604$/);
  await expect(page.locator('[data-mushaf-page="604"]')).toBeAttached();
  await page.goBack();
  await expect(page).toHaveURL(/\/p\/42$/);
  await expect(page.locator('[data-mushaf-page="42"]')).toBeAttached();
  await page.goForward();
  await expect(page).toHaveURL(/\/p\/604$/);
  await page.reload();
  await expect(page.locator('[data-mushaf-page="604"]')).toBeAttached();
});

test('mobile keyboard dismissal keeps typed input and uses no extra history entries', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium-desktop');
  await openReader(page);
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await field.fill('۳');
  const length = await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - 260 });
    visualViewport.dispatchEvent(new Event('resize'));
    return history.length;
  });
  await expect(dialog).toHaveCSS('height', `${(page.viewportSize()?.height ?? 0) - 260}px`);
  await page.goBack();
  await expect(field).toHaveValue('۳');
  await expect(field).not.toBeFocused();
  await expect.poll(() => page.evaluate(() => history.state?.searchAndGoOverlay)).toBe(true);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  await expect(dialog).toHaveCount(0);
});

test('a verse on a shared mushaf page activates its own surah', async ({ page }) => {
  await openReader(page, '/p/42');
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await field.fill('ناس ۴');
  await field.press('Enter');
  await expect(page).toHaveURL(/\/p\/604$/);
  await expect(page.locator('.reader-surah-link')).toContainText('الناس');
  await expect(page.locator('[data-mushaf-page="604"] [data-surah="114"][data-ayah="4"][data-pos="1"]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/p\/42$/);
  await expect(page.locator('.reader-surah-link')).toContainText('البقرة');
  await page.goForward();
  await expect(page.locator('.reader-surah-link')).toContainText('الناس');
});

test('the return chip reuses the same search entry and closing restores the reader', async ({ page }) => {
  await openReader(page);
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await field.fill('الحمد لله');
  const results = dialog.locator('.search-result-open');
  await expect(results.first()).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => localStorage.getItem('mushaf.search-and-go-history.v1'))).toBeNull();
  await results.first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/s\/\d+\/a\/\d+/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mushaf.search-and-go-history.v1'))[0].operation.type)).toBe('text');
  const length = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'بازگشت به نتایج جست‌وجو' }).click();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await expect(field).toHaveValue('الحمد لله');
  await expect(results.first()).toBeVisible({ timeout: 20000 });
  await dialog.getByRole('button', { name: 'بازگشت به قرآن' }).click();
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/);
  await expect(page.getByRole('button', { name: 'بازگشت به نتایج جست‌وجو' })).toHaveCount(0);
});

test('a result on the current mushaf page stays in mushaf on Forward and reload', async ({ page }) => {
  await openReader(page, '/p/1');
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await field.fill('الحمد لله');
  await dialog.locator('.search-result-open').first().click({ timeout: 20000 });
  await expect(page).toHaveURL(/\/p\/1$/);
  await expect(dialog).toHaveCount(0);
  await page.goBack();
  await expect(field).toHaveValue('الحمد لله');
  await page.goForward();
  await expect(page).toHaveURL(/\/p\/1$/);
  await expect(page.locator('[data-continuous-mushaf]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-continuous-mushaf]')).toBeVisible();
  await expect(page.locator('[data-mushaf-page="1"] [data-surah="1"][data-ayah="2"] .flash').first()).toBeAttached();
});

test('Back cancels a result whose surah is still loading', async ({ page }) => {
  await openReader(page);
  let resume;
  let requested;
  const gate = new Promise(resolve => { resume = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  await page.route('**/data/surah/1.json', async route => {
    requested();
    await gate;
    await route.continue();
  });
  const dialog = await openSearchAndGo(page);
  await dialog.getByRole('combobox').fill('الحمد لله');
  await dialog.locator('.search-result-open').first().click({ timeout: 20000 });
  try {
    await started;
    await page.goBack();
    await expect(dialog).toHaveCount(0);
  } finally {
    resume();
  }
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/);
  await expect(page.locator('.reader-surah-link')).toContainText('طه');
});
