const { test, expect } = require('@playwright/test');

test('opening and closing Go preserves the reading position and URL', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mubarak.ui-language.v1', 'fa');
    localStorage.setItem('mushaf.safavi-default.v1', 'true');
  });
  await page.route('**/api/version', route => route.fulfill({ json: { version: 'fixture', releases: [] } }));
  await page.route('**/offline-manifest.json', route => route.fulfill({ json: { groups: { core: [] } } }));
  await page.goto('/s/20/a/34');
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  const reader = page.locator('[data-reading-scroll]');
  await expect.poll(() => reader.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const offset = await reader.evaluate(el => el.scrollTop);
  const trigger = page.locator('.reader-surah-link');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'بستن', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/);
  await expect.poll(() => reader.evaluate(el => el.scrollTop)).toBe(offset);
});
