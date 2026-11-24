const { expect, test } = require('@playwright/test');
const labels = require('../../src/messages/fa.json');

test.skip(process.env.SEARCH_AND_GO_PHASE_3_E2E !== '1', 'Run against the Search and Go Phase 3 preview.');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mubarak.ui-language.v1', 'fa');
    localStorage.setItem('mushaf.safavi-default.v1', 'true');
  });
  await page.route('**/api/version', route => route.fulfill({ json: { version: 'fixture', releases: [] } }));
});

async function showControls(page) {
  const controls = page.locator('[data-phase3-controls]');
  await expect(controls).toBeVisible();
  await expect(controls.locator('[data-phase3-scope]')).toBeVisible();
  await expect(controls.locator('[data-phase3-more]')).toBeVisible();
  return controls;
}

const addresses = panel => panel.locator('[data-search-address]').evaluateAll(cards => cards.map(card => card.dataset.searchAddress));

test('quick and advanced search agree on the matches for a multiword query', async ({ page }) => {
  await page.goto('/s/20/a/34');
  await page.locator('.reader-quick-search-trigger').click();
  const quick = page.locator('.quick-surah-search');
  await quick.getByRole('button', { name: 'کل قرآن', exact: true }).click();
  await quick.getByRole('searchbox').fill('صبر نصر');
  await page.locator('.quick-search-status .analysis-position-button').click({ timeout: 30000 });
  const popup = page.locator('.quick-search-result-picker');
  const rows = popup.locator('[data-search-address]');
  await expect(rows.first()).toBeVisible();
  const quickResults = await addresses(popup);
  const matchedWords = await rows.first().locator('[data-search-match]').allTextContents();
  const normalize = text => text.replace(/\p{M}|ـ/gu, '');
  expect(matchedWords.some(word => normalize(word).includes('صبر'))).toBeTruthy();
  expect(matchedWords.some(word => normalize(word).includes('نصر'))).toBeTruthy();
  expect(matchedWords.map(normalize)).not.toContain('و');
  await expect(rows.first().locator('[data-highlight-state="selected"]')).toHaveText(matchedWords[0]);
  await popup.locator('.occurrence-picker-close').click();
  await quick.locator('.quick-search-advanced').click();
  const advanced = page.locator('[data-search-and-go]');
  await expect(advanced.getByRole('combobox')).toHaveValue('صبر نصر');
  await expect(advanced.locator('[data-search-address]').first()).toBeVisible({ timeout: 30000 });
  const advancedResults = await addresses(advanced);
  expect(advancedResults).toEqual(quickResults.slice(0, advancedResults.length));
});

test('empty search stays active after blur and clear until Browse is chosen', async ({ page }) => {
  await page.goto('/s/20/a/34');
  await page.locator('.reader-surah-link').click();
  const historyLength = await page.evaluate(() => history.length);
  const panel = page.locator('[data-search-and-go]');
  const input = panel.getByRole('combobox');
  const browse = panel.locator('.drawer-content-shell');
  const empty = panel.locator('.search-and-go-empty');
  await expect(browse).toBeVisible();
  await input.click();
  await expect(browse).toBeHidden();
  await expect(empty.getByRole('heading')).toHaveText(labels['searchP3.emptyTitle']);
  await input.blur();
  await expect(empty).toBeVisible();
  await empty.getByRole('button', { name: 'صبر', exact: true }).click();
  await expect(input).toHaveValue('صبر');
  await expect(panel.locator('[data-search-address]').first()).toBeVisible();
  await expect(panel.locator('.search-results-summary [role=status]')).toHaveText(/آیه · .+ وقوع تطبیق/);
  await input.fill('');
  await expect(empty).toBeVisible();
  await empty.getByRole('button', { name: labels['searchP3.browse'] }).click();
  await expect(browse).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await panel.getByRole('button', { name: labels['ui.685e0d6bc0'], exact: true }).click();
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/);
});

test('empty focus displays real mixed history with persistent pins and replay', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/s/20/a/34');
  const trigger = page.locator('.reader-surah-link');
  const panel = page.locator('[data-search-and-go]');
  const input = panel.getByRole('combobox');
  await trigger.click();
  await input.fill('طه ۴۰');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/s\/20\/a\/40$/);
  await trigger.click();
  await input.fill('صبر');
  await panel.locator('.search-result-open').first().click();
  await expect(panel).toHaveCount(0);
  await trigger.click();
  await input.click();
  const history = panel.locator('.search-and-go-history');
  await expect(history.locator('li')).toHaveCount(2);
  await expect(history.locator('.lucide-search')).toHaveCount(1);
  await expect(history.locator('.lucide-mouse-pointer-2')).toHaveCount(1);
  const pin = history.locator('li').filter({ has: page.locator('.lucide-mouse-pointer-2') }).locator('button[aria-pressed="false"]');
  await pin.click();
  await expect(history.locator('li').first().getByRole('button', { pressed: true })).toBeVisible();
  await panel.getByRole('button', { name: labels['ui.685e0d6bc0'], exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.reload();
  await trigger.click();
  await input.click();
  await expect(history.locator('li').first().getByRole('button', { pressed: true })).toBeVisible();
  await history.getByRole('button', { name: 'صبر', exact: true }).click();
  await expect(input).toHaveValue('صبر');
  await expect(panel.locator('.search-result-open').first()).toBeVisible();
});

test('suggestions share one RTL row while arrow selection crosses groups', async ({ page }) => {
  await page.goto('/s/20/a/34');
  await page.locator('.reader-surah-link').click();
  const input = page.locator('[data-search-and-go]').getByRole('combobox');
  await input.fill('طه');
  const row = page.locator('.search-and-go-suggestions');
  const destination = row.locator('.drawer-destination-options').getByRole('option').first();
  const completion = row.locator('[data-search-completions]').getByRole('option').first();
  await expect(completion).toBeVisible();
  await expect(row.locator('.lucide-mouse-pointer-2')).toHaveCount(1);
  await expect(destination.locator('svg')).toHaveCount(0);
  await expect(completion.locator('.lucide-search')).toHaveCount(1);
  const [navigationBox, completionBox] = await Promise.all([destination.boundingBox(), completion.boundingBox()]);
  expect(Math.abs(navigationBox.y - completionBox.y)).toBeLessThan(1);
  expect(navigationBox.height).toBe(completionBox.height);
  expect(navigationBox.x).toBeGreaterThan(completionBox.x);
  await input.press('ArrowDown');
  await expect(destination).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowDown');
  await expect(completion).toHaveAttribute('aria-selected', 'true');
});

test('more filters push the summary down without moving the result scroll', async ({ page }) => {
  await page.goto(`/q?q=${encodeURIComponent('صبر')}&h=0`);
  const panel = page.locator('[data-search-and-go]');
  const list = panel.locator('.search-page-results');
  const summary = panel.locator('.search-results-summary');
  await expect(panel.locator('[data-search-address]').first()).toBeVisible();
  await expect(summary.getByRole('status')).toHaveText('۸۴ آیه · ۹۲ وقوع تطبیق');
  await list.evaluate(element => { element.scrollTop = 300; });
  const before = await summary.boundingBox();
  const historyLength = await page.evaluate(() => history.length);
  const more = (await showControls(page)).locator('[data-phase3-more]');
  await more.click();
  const research = panel.locator('.phase3-research');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const box = await research.boundingBox();
  const after = await summary.boundingBox();
  expect(after.y).toBeGreaterThan(before.y);
  expect(after.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
  expect(await list.evaluate(element => element.scrollTop)).toBe(300);
  await more.click();
  await expect(research).toBeHidden();
  expect(await list.evaluate(element => element.scrollTop)).toBe(300);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test('a narrow visual viewport leaves filter controls and results reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/s/20/a/34');
  await page.locator('.reader-surah-link').click();
  const panel = page.locator('[data-search-and-go]');
  const field = panel.getByRole('combobox');
  await field.fill('صبر');
  await expect(panel.locator('.search-result-card').first()).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - 280 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(panel).toHaveCSS('height', '420px');
  const row = panel.locator('.phase3-options');
  expect(await row.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await row.locator('[data-phase3-more]').click();
  await expect(panel.locator('.phase3-research')).toBeVisible();
  const results = await panel.locator('.search-page-results').boundingBox();
  expect(results.height).toBeGreaterThan(80);
});

test('a shared search restores its scoped results and preserves sort changes after reload', async ({ page }) => {
  await page.goto(`/q?q=${encodeURIComponent('علم')}&at=20&scope=current&rel=any&sort=relevance&sort=mushaf&h=0`);
  const panel = page.locator('[data-search-and-go]');
  await expect(panel.getByRole('combobox')).toHaveValue('علم');
  await expect(panel.locator('[data-search-address]').first()).toBeVisible({ timeout: 20_000 });
  expect(await addresses(panel)).toContain('20:114');
  expect((await addresses(panel)).every(address => address.startsWith('20:'))).toBe(true);

  const controls = await showControls(page);
  const scope = controls.locator('[data-phase3-scope]');
  await scope.locator('summary').click();
  await expect(scope.getByRole('button', { name: labels['searchP3.scope.current'], exact: true })).toHaveAttribute('aria-pressed', 'true');
  await scope.locator('summary').click();

  const relation = controls.locator('[data-phase3-relation]');
  await relation.locator('summary').click();
  await expect(relation.getByRole('button', { name: labels['searchP3.relation.any'], exact: true })).toHaveAttribute('aria-pressed', 'true');
  await relation.locator('summary').click();
  await expect(controls.locator('[data-phase3-roots]')).toHaveAttribute('aria-pressed', 'false');

  const sort = controls.locator('[data-phase3-sort]');
  await sort.locator('summary').click();
  await expect(sort.getByRole('button', { name: labels['searchP3.sort.relevance'], exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sort.getByRole('button', { name: labels['searchP3.sort.mushaf'], exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll('sort')).toEqual(['mushaf', 'relevance']);

  await page.reload();
  const reopened = await showControls(page);
  await reopened.locator('[data-phase3-sort] summary').click();
  await expect(reopened.getByRole('button', { name: labels['searchP3.sort.mushaf'], exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('[data-search-address]').first()).toBeVisible({ timeout: 20_000 });
  const ayahs = (await addresses(panel)).map(address => Number(address.split(':')[1]));
  expect(ayahs).toEqual([...ayahs].sort((left, right) => left - right));
});

test('Medinan and Meccan scopes filter real phrase results by chapter', async ({ page }) => {
  await page.goto(`/q?q=${encodeURIComponent('الأسماء الحسنى')}&scope=medinan&rel=phrase&h=0`);
  const panel = page.locator('[data-search-and-go]');
  await expect(panel.locator('[data-search-address="59:24"]')).toBeVisible({ timeout: 20_000 });
  expect(await addresses(panel)).toEqual(['59:24']);

  const controls = await showControls(page);
  const scope = controls.locator('[data-phase3-scope]');
  await scope.locator('summary').click();
  await scope.getByRole('button', { name: labels['searchP3.scope.meccan'], exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('scope')).toBe('meccan');
  await expect.poll(async () => (await addresses(panel)).sort()).toEqual(['17:110', '20:8', '7:180']);
});

test('shared research filters restore the attested root, lemma, and form together', async ({ page }) => {
  const params = new URLSearchParams({ q: 'قوم', m: 'r', at: '20', scope: 'current', fr: 'قوم', fl: '>aqaAma', ff: 'IV', h: '0' });
  await page.goto(`/q?${params}`);
  const panel = page.locator('[data-search-and-go]');
  await expect(panel.locator('[data-search-address="20:14"]')).toBeVisible({ timeout: 20_000 });
  expect(await addresses(panel)).toEqual(['20:14']);

  const controls = await showControls(page);
  const research = controls.locator('.phase3-research');
  const toggle = controls.locator('[data-phase3-more]');
  await toggle.click();
  for (const group of ['roots', 'lemmas', 'forms']) {
    await expect(research.getByRole('group', { name: labels[`searchP3.filter.${group}`] }).getByRole('button', { pressed: true })).toHaveCount(1);
  }
  const selectedForm = research.getByRole('group', { name: labels['searchP3.filter.forms'] }).getByRole('button', { pressed: true });
  await selectedForm.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.has('ff')).toBe(false);
  await toggle.click();
  await expect(research).toBeHidden();
  await toggle.click();
  await expect(research.getByRole('button', { pressed: true })).toHaveCount(2);
});

test('return restores the original current-surah scope and same-root setting after reading elsewhere', async ({ page }) => {
  await page.goto('/s/20/a/34');
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  await page.locator('.reader-surah-link').click();
  const panel = page.locator('[data-search-and-go]');
  const input = panel.getByRole('combobox');
  await input.fill('علم');
  const controls = await showControls(page);
  const scope = controls.locator('[data-phase3-scope]');
  await scope.locator('summary').click();
  await scope.getByRole('button', { name: labels['searchP3.scope.current'], exact: true }).click();
  await scope.locator('summary').click();
  const roots = controls.locator('[data-phase3-roots]');
  await roots.click();
  await expect(roots).toHaveAttribute('aria-pressed', 'true');

  const selected = panel.locator('[data-search-address="20:114"]').getByRole('button');
  await selected.click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/s\/20\/a\/114(?:\/w\/\d+)?$/);
  await page.locator('.reader-surah-link').click();
  await input.fill('بقره ۲۵۵');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/s\/2\/a\/255$/);

  await page.getByRole('button', { name: 'بازگشت به نتایج جست‌وجو', exact: true }).click();
  await expect(input).toHaveValue('علم');
  const params = new URL(page.url()).searchParams;
  expect(params.get('at')).toBe('20');
  expect(params.get('scope')).toBe('current');
  await expect(selected).toHaveAttribute('aria-current', 'true', { timeout: 20_000 });
  expect((await addresses(panel)).every(address => address.startsWith('20:'))).toBe(true);
  await expect((await showControls(page)).locator('[data-phase3-roots]')).toHaveAttribute('aria-pressed', 'true');
});
