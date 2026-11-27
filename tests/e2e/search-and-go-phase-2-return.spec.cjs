const { expect, test } = require('@playwright/test');

test.skip(process.env.SEARCH_AND_GO_PHASE_2_E2E !== '1', 'Run against a phase 2 build.');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mubarak.ui-language.v1', 'fa');
    localStorage.setItem('mushaf.safavi-default.v1', 'true');
  });
  await page.route('**/api/version', route => route.fulfill({ json: { version: 'fixture', releases: [] } }));
  await page.route('**/offline-manifest.json', route => route.fulfill({ json: { groups: { core: [] } } }));
});

test('return follows the result journey after moving and dismissal survives Back and Forward', async ({ page }) => {
  await page.goto('/s/20/a/34');
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  await page.locator('.reader-surah-link').click();
  const dialog = page.locator('[data-search-and-go]');
  const field = dialog.getByRole('combobox');
  const query = '«الحمد لله»';
  await field.fill(query);
  await dialog.locator('.search-result-open').first().click({ timeout: 20000 });
  await expect(dialog).toHaveCount(0);
  const chip = page.locator('[data-advanced-search-return]');
  await expect(chip).toBeVisible();
  const hit = page.url();
  await page.keyboard.press('ArrowLeft');
  await expect(page).not.toHaveURL(hit);
  const next = page.url();
  await chip.click();
  await expect(field).toHaveValue(query);
  await dialog.getByRole('button', { name: 'بازگشت به قرآن' }).click();
  await expect(page).toHaveURL(next);
  await page.getByRole('button', { name: 'بستن نوار بازگشت به جست‌وجو', exact: true }).click();
  await expect(chip).toHaveCount(0);
  await page.goBack();
  await expect(field).toHaveValue(query);
  await page.goForward();
  await expect(page).toHaveURL(next);
  await expect(chip).toHaveCount(0);
});

test('a direct advanced link opens the unified field and its close restores reading', async ({ page }) => {
  const query = 'علم';
  await page.goto(`/q?q=${encodeURIComponent(query)}&m=r&s=20`);
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  const dialog = page.locator('[data-search-and-go][data-search-page]');
  await expect(dialog.getByRole('combobox')).toHaveValue(query);
  await expect(page.locator('[data-search-page]')).toHaveCount(1);
  await expect(page).toHaveURL(/[?&]m=r&s=20\b/);
  await dialog.getByRole('button', { name: 'بازگشت به قرآن' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/s\/\d+$/);
});

test('a mushaf journey restores the selected card and its loaded viewport after changing pages and surahs', async ({ page }) => {
  await page.goto('/p/42');
  await expect(page.locator('[data-mushaf-page="42"]')).toBeAttached();
  await page.locator('.reader-surah-link').click();
  const panel = page.locator('[data-search-and-go]');
  const input = panel.getByRole('combobox');
  await input.fill('صبر');
  const list = panel.locator('.search-page-results');
  await list.locator('.search-more').click({ timeout: 20000 });
  const card = list.locator('[data-search-result-index="25"]');
  await card.scrollIntoViewIfNeeded();
  const address = await card.getAttribute('data-search-address');
  const offset = await card.evaluate(element => element.getBoundingClientRect().top -
    element.closest('.search-page-results').getBoundingClientRect().top);
  await card.getByRole('button').click();
  await expect(panel).toBeHidden();
  const back = page.locator('[data-advanced-search-return]');
  await expect(back).toBeVisible();
  await page.locator('.reader-surah-link').click();
  await input.fill('ناس ۴');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/p\/604$/);
  await expect(back).toBeVisible();
  await back.click();
  await expect(input).toHaveValue('صبر');
  const restored = list.locator(`[data-search-address="${address}"]`);
  await expect(restored.getByRole('button')).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => restored.evaluate((element, before) => Math.abs(
    element.getBoundingClientRect().top - element.closest('.search-page-results').getBoundingClientRect().top - before,
  ), offset)).toBeLessThan(12);
});

test('quick search and analysis transfer their criterion and scope into the shared field', async ({ page }) => {
  await page.goto('/s/20/a/34');
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  await page.locator('.reader-toolbar button[aria-label="جست‌وجو در قرآن"]').click();
  const quick = page.locator('.quick-surah-search');
  await quick.locator('button[aria-pressed]').filter({ hasText: /بُ?ن‌واژه/ }).click();
  await quick.getByRole('searchbox').fill('رحمة');
  await quick.getByRole('button', { name: 'پیشرفته' }).click();
  const panel = page.locator('[data-search-and-go]');
  await expect(panel.getByRole('combobox')).toHaveValue('رحمة');
  await expect(page).toHaveURL(/[?&]m=l&s=20\b/);
  await panel.getByRole('button', { name: 'بازگشت به قرآن' }).click();
  await quick.getByRole('button', { name: 'بستن جست‌وجوی سریع' }).click();

  const word = page.locator('[data-reading-scroll] [data-surah="20"][data-ayah="34"][data-pos="1"] [data-word-part="stem"]');
  await word.click();
  await page.locator('.analysis-position-button').click();
  await page.locator('[data-occurrence-scope="surah"]').click();
  await expect(panel.getByRole('combobox')).not.toHaveValue('');
  await expect(page).toHaveURL(/[?&]o=r\.20\.34\.1/);
  await expect(panel.locator('.search-result-open').first()).toBeVisible();
});
