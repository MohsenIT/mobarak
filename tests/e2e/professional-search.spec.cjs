const { expect, test } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

test.skip(process.env.SEARCH_AND_GO_PHASE_3_E2E !== '1', 'Run against the Search and Go Phase 3 preview.');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mubarak.ui-language.v1', 'fa');
    localStorage.setItem('mushaf.safavi-default.v1', 'true');
  });
  await page.route('**/api/version', route => route.fulfill({ json: { version: 'fixture', releases: [] } }));
});

test('professional help examples insert and preserve raw syntax', async ({ page }) => {
  await page.goto('/q?q=صبر');
  const panel = page.locator('[data-search-and-go]');
  await panel.getByRole('button', { name: 'راهنمای جستجو' }).click();
  await panel.locator('summary').getByText('جست‌وجوی حرفه‌ای', { exact: true }).click();
  const guide = panel.getByRole('region', { name: 'جست‌وجوی حرفه‌ای' });
  await expect(guide).toBeVisible();
  const query = 'قال ...{2,5} موسى';
  await guide.getByRole('button', { name: query, exact: true }).click();
  await expect(panel.getByRole('combobox')).toHaveValue(query);
  await expect(guide).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(query);
  await expect(panel.locator('[data-search-address]').first()).toBeVisible({ timeout: 30000 });
});

test('incomplete syntax prompts for correction, and explicit operators replace the relation chooser', async ({ page }) => {
  await page.goto('/q?q=صبر+نصر&scope=all&rel=any');
  const panel = page.locator('[data-search-and-go]');
  const input = panel.getByRole('combobox');
  await expect(panel.locator('[data-phase3-relation]')).toBeVisible();
  await input.fill('صبر |');
  await expect(panel.getByRole('status').filter({ hasText: 'عبارت جست‌وجو را کامل یا اصلاح کنید.' })).toBeVisible();
  await expect(panel.locator('[data-search-address]')).toHaveCount(0);
  await input.fill('صبر | نصر');
  await expect(panel.locator('[data-phase3-relation]')).toBeHidden();
  await expect(panel.locator('[data-search-address]').first()).toBeVisible({ timeout: 30000 });
  await input.fill('صبر نصر');
  await expect(panel.locator('[data-phase3-relation]')).toBeVisible();
});


test('quick search matches a wildcard on the same shared corpus', async ({ page }) => {
  await page.goto('/s/1/a/4');
  await page.locator('.reader-quick-search-trigger').click();
  const quick = page.locator('.quick-surah-search');
  await quick.getByRole('searchbox').fill('مل؟');
  await page.locator('.quick-search-status .analysis-position-button').click({ timeout: 30000 });
  const row = page.locator('.quick-search-result-picker [data-search-address="1:4"]');
  await expect(row.locator('[data-search-match]')).toHaveCount(1);
});
