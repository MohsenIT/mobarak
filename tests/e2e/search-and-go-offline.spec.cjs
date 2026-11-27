const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'allow' });
const phase3 = process.env.SEARCH_AND_GO_PHASE_3_E2E === '1';
test.skip(!phase3 && process.env.SEARCH_AND_GO_PHASE_2_E2E !== '1', 'Run against the Search and Go Phase 2 preview build.');

test('a downloaded reader can open and follow its first text search offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('mubarak.ui-language.v1', 'fa');
    localStorage.setItem('mushaf.safavi-default.v1', 'true');
  });
  await page.goto('/s/20/a/34');
  await expect(page.locator('[data-reading-scroll] [data-pos]').first()).toBeAttached();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  const pack = await page.evaluate(async () => {
    const path = '/data/quran-search.json';
    const manifest = await fetch('/offline-manifest.json').then(response => response.json());
    const index = manifest.groups.core.find(entry => entry.url === path);
    if (!index) throw new Error('Search corpus is missing from the core pack');
    const total = await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => {
        if (!data.error && !data.complete) return;
        channel.port1.close();
        if (data.error) reject(new Error(data.error));
        else resolve(data.total);
      };
      navigator.serviceWorker.controller.postMessage({ type: 'DOWNLOAD_PACKS', groups: ['core'] }, [channel.port2]);
    });
    const cached = await caches.match(path, { cacheName: 'quran-offline-packs-v1' });
    return { total, entries: manifest.groups.core.length, actualHash: cached?.headers.get('x-content-sha256'), expectedHash: index.sha256 };
  });
  expect(pack.entries).toBeGreaterThan(0);
  expect(pack.total).toBe(pack.entries);
  expect(pack.actualHash).toBe(pack.expectedHash);
  await expect.poll(() => page.evaluate(async () => !!(await caches.match('/__last-successful-document')))).toBe(true);

  await context.setOffline(true);
  expect(await page.evaluate(() => fetch('/data/__offline-search-probe.json').then(() => 'online', () => 'offline'))).toBe('offline');
  expect((await page.reload()).fromServiceWorker()).toBe(true);
  await expect(page.locator('[data-reading-scroll] [data-pos]').first()).toBeAttached();

  await page.locator('.reader-surah-link').click();
  const search = page.locator('[data-search-and-go]');
  await search.getByRole('combobox').fill(phase3 ? '«الأسماء الحسنى»' : 'اسما الحسنی');
  await expect(search.locator('.search-result-open')).toHaveCount(4, { timeout: 20_000 });
  await search.getByRole('button', { name: /اعراف.*۱۸۰/ }).click();
  await expect(search).toBeHidden();
  await expect(page).toHaveURL(/\/s\/7\/a\/180(?:\/w\/\d+)?$/);
  await expect(page.locator('[data-reading-scroll] [data-surah="7"][data-ayah="180"][data-pos]').first()).toBeAttached();
});


test('the downloaded professional engine evaluates a wildcard with an ordered gap offline', async ({ page, context, browserName }) => {
  test.skip(!phase3 || browserName !== 'chromium', 'Chromium download and cold reload scenario for Phase 3.');
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('mubarak.ui-language.v1', 'fa'));
  await page.goto('/s/20/a/34');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) => {
      if (data.error) reject(new Error(data.error));
      if (data.complete) resolve();
    };
    navigator.serviceWorker.controller.postMessage({ type: 'DOWNLOAD_PACKS', groups: ['core'] }, [channel.port2]);
  }));
  await expect.poll(() => page.evaluate(async () => !!(await caches.match('/__last-successful-document')))).toBe(true);
  await context.setOffline(true);
  expect((await page.reload()).fromServiceWorker()).toBe(true);
  await page.locator('.reader-surah-link').click();
  const panel = page.locator('[data-search-and-go]');
  await panel.getByRole('combobox').fill('قا? ...{2,5} موسى');
  const result = panel.locator('[data-search-address="7:127"]');
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result.locator('[data-search-match]')).toHaveCount(2);
  await result.getByRole('button').click();
  await expect(page).toHaveURL(/\/s\/7\/a\/127/);
});
