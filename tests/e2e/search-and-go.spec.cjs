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
