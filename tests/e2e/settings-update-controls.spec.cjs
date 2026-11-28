const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mubarak.ui-language.v1', 'fa'));
});

function openMenu(page) {
  return page.getByRole('button', { name: 'منوی برنامه', exact: true }).click();
}

test('About is last in the menu, the version stays at its safe bottom, and About returns to the menu', async ({ page }) => {
  await page.goto('/s/1');
  await openMenu(page);
  const menu = page.locator('.drawer');
  const about = menu.locator('.drawer-tools .drawer-tool-row').last();
  const footer = menu.locator('.drawer-version-footer');
  await expect(about).toHaveText('درباره مبارک');
  await expect(footer).toContainText(/نسخه [۰-۹.]+/);
  await page.setViewportSize({ width: page.viewportSize().width, height: 360 });
  await page.evaluate(() => document.documentElement.style.setProperty('--native-safe-area-bottom', '24px'));
  await expect.poll(async () => {
    const [panel, bottom] = await Promise.all([menu.boundingBox(), footer.boundingBox()]);
    return Math.round(panel.y + panel.height - bottom.y - bottom.height);
  }).toBe(24);
  await about.click();
  const panel = page.getByRole('dialog', { name: 'درباره مبارک', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.about-mobarak img')).toHaveAttribute('src', '/icons/logo-5-192.png');
  await expect(panel.locator('.about-meaning strong')).toHaveCount(6);
  const captions = await panel.locator('.about-meaning .about-caption, .about-identity').evaluateAll(nodes =>
    nodes.map(node => [getComputedStyle(node).fontSize, getComputedStyle(node).fontWeight]));
  expect(captions[0]).toEqual(captions[1]);
  await expect(panel.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/MohsenIT/mobarak');
  await panel.getByRole('button', { name: 'حمایت از مبارک' }).click();
  await expect(panel.locator('#about-support-note')).toBeVisible();
  await page.goBack();
  await expect(about).toBeFocused();
  await about.click();
  await panel.getByRole('button', { name: 'بازگشت به منوی اصلی' }).click();
  await expect(footer).toBeVisible();
  await menu.getByRole('button', { name: 'تنظیمات', exact: true }).click();
  await expect(page.locator('.settings-screen-tabs')).not.toContainText(/درباره|به‌روزرسانی/);
});

test('version history opens from the menu and update status distinguishes success from failure', async ({ page }) => {
  const version = await (await page.request.get('/api/version')).json().catch(() => null);
  test.skip(!version?.version, 'The static installer checks GitHub Releases instead of the web version endpoint.');
  let update = 'latest';
  await page.route('**/api/version', route => update === 'error' ? route.abort() :
    route.fulfill({ json: update === 'latest' ? version : { ...version, version: 'new-build' } }));
  await page.goto('/s/1');
  await openMenu(page);
  const footer = page.locator('.drawer-version-footer');
  await expect(footer).not.toContainText('به‌روزرسانی جدید');
  await footer.getByRole('button').click();
  const panel = page.getByRole('dialog', { name: 'نسخه و به‌روزرسانی' });
  await panel.getByRole('button', { name: 'تاریخچهٔ نسخه‌ها' }).click();
  const notes = page.locator('.release-notes-dialog');
  await expect(notes).toBeVisible();
  await expect(notes.locator('.release-notes-list section').first()).toBeVisible();
  await notes.locator('.release-action-secondary').click();
  const check = panel.getByRole('button', { name: 'بررسی به‌روزرسانی' });
  await check.click();
  await expect(panel.getByRole('status')).toHaveText('برنامه به‌روز است.');
  update = 'error';
  await check.click();
  await expect(panel.getByRole('status')).toContainText('بررسی یا دریافت انجام نشد');
  update = 'new';
  await check.click();
  await expect(panel.getByRole('status')).toHaveText('به‌روزرسانی جدید');
  await panel.getByRole('button', { name: 'بازگشت به منوی اصلی' }).click();
  await expect(footer).toContainText('به‌روزرسانی جدید');
  await page.context().setOffline(true);
  await expect(footer).not.toContainText('به‌روزرسانی جدید');
  await footer.getByRole('button').click();
  await expect(panel.getByRole('status')).toContainText('آفلاین هستید');
});

test('the native menu identifies the installer separately and checks GitHub Releases', async ({ page }) => {
  const response = await page.request.get('/api/version');
  test.skip(response.ok(), 'This check runs against the static installer frontend.');
  await page.route('https://api.github.com/repos/MohsenIT/mobarak/releases/latest', route =>
    route.fulfill({ json: { assets: [
      { name: 'app-arm64-release.apk' },
      { name: 'Quran.Mubarak_99.0.0_x64_en-US.msi' },
    ] } }));
  await page.goto('/s/1');
  await openMenu(page);
  const footer = page.locator('.drawer-version-footer');
  await expect(footer).toContainText('به‌روزرسانی جدید');
  await footer.getByRole('button').click();
  const panel = page.getByRole('dialog', { name: 'نسخه و به‌روزرسانی' });
  await expect(panel).toContainText('نسخهٔ محتوای برنامه');
  await expect(panel.getByRole('link', { name: 'دریافت نصب‌کننده از گیت‌هاب' })).toHaveAttribute('href', 'https://github.com/MohsenIT/mobarak/releases/latest');
});
