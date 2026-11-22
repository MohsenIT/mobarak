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
  const toggle = controls.locator('[data-phase3-toggle]');
  const scope = controls.locator('[data-phase3-scope]');
  if (await toggle.isVisible()) {
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(scope).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(scope).toBeVisible();
  return controls;
}

const addresses = panel => panel.locator('[data-search-address]').evaluateAll(cards => cards.map(card => card.dataset.searchAddress));

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

  const research = (await showControls(page)).locator('.phase3-research');
  await research.locator('summary').click();
  for (const group of ['roots', 'lemmas', 'forms']) {
    await expect(research.getByRole('group', { name: labels[`searchP3.filter.${group}`] }).getByRole('button', { pressed: true })).toHaveCount(1);
  }
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
