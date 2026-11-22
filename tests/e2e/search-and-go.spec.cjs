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

test('typed text explicitly hands off to the existing advanced search', async ({ page }) => {
  await openReader(page);
  const dialog = await openSearchAndGo(page);
  const field = dialog.getByRole('combobox');
  await field.fill('الحمد لله');
  await field.press('Enter');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'جست‌وجوی پیشرفته' }).click();
  await expect(page.locator('[data-search-page] input[type=search]').first()).toHaveValue('الحمد لله');
  await expect(page).toHaveURL(/\/q\?/);
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

test('empty focus teaches real commands, then shows only executed and pinnable operations', async ({ page }) => {
  await openReader(page);
  let dialog = await openSearchAndGo(page);
  let field = dialog.getByRole('combobox');
  await field.focus();
  await expect(dialog.locator('.search-and-go-examples button')).toHaveCount(6);
  await dialog.locator('.search-and-go-examples').getByRole('button', { name: /صفحه ۶۰۴/ }).click();
  await expect(field).toHaveValue('صفحه ۶۰۴');
  expect(await page.evaluate(() => localStorage.getItem('mushaf.search-and-go-history.v1'))).toBeNull();
  await field.fill('طه ۴۰');
  await field.press('Enter');
  await expect(page).toHaveURL(/\/s\/20\/a\/40$/);

  dialog = await openSearchAndGo(page);
  field = dialog.getByRole('combobox');
  await field.focus();
  const history = dialog.locator('.search-and-go-history');
  const pin = history.getByRole('button', { name: /سنجاق/ });
  await pin.focus();
  await pin.press('Space');
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'بازگشت به قرآن' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  dialog = await openSearchAndGo(page);
  await dialog.getByRole('combobox').focus();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await history.locator('.search-and-go-replay').click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/s\/20\/a\/40$/);
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

test('selecting a real advanced text result records a replayable text operation', async ({ page }) => {
  await openReader(page);
  const dialog = await openSearchAndGo(page);
  await dialog.getByRole('combobox').fill('الحمد لله');
  await dialog.getByRole('button', { name: 'جست‌وجوی پیشرفته' }).click();
  await expect(page.locator('[data-search-page]').locator('.search-results-total')).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => localStorage.getItem('mushaf.search-and-go-history.v1'))).toBeNull();
  await page.locator('.search-result-open').first().click();
  await expect(page.locator('[data-search-page]')).toHaveCount(0);
  const reopened = await openSearchAndGo(page);
  await reopened.getByRole('combobox').focus();
  await reopened.locator('.search-and-go-replay').getByText('الحمد لله', { exact: true }).click();
  await expect(page.locator('[data-search-page] input[type=search]').first()).toHaveValue('الحمد لله');
});
