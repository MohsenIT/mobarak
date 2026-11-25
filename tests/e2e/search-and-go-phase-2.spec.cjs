const { test, expect } = require('@playwright/test')

test.skip(process.env.SEARCH_AND_GO_PHASE_2_E2E !== '1', 'Requires the phase 2 preview flag.')

async function openSearch(page) {
  await page.addInitScript(() => localStorage.setItem('mubarak.ui-language.v1', 'fa'))
  await page.goto('/s/20/a/34')
  await expect(page.locator('.startup-splash')).toHaveCount(0)
  await page.locator('.reader-surah-link').click()
  const panel = page.locator('[data-search-and-go]')
  return { panel, field: panel.getByRole('combobox') }
}

test('a surah name has simultaneous destinations and real text results, with safe Enter', async ({ page }) => {
  const { panel, field } = await openSearch(page)
  const length = await page.evaluate(() => history.length)
  await field.fill('طه')
  await expect(panel.locator('.drawer-destination-options [role="option"]')).toContainText('طه')
  await expect(panel.locator('.search-result-open').first()).toBeVisible()
  await expect(panel.locator('.search-results-detail')).toContainText(/آیه · .+ یافته شده$/)
  await field.press('Enter')
  await expect(panel).toBeVisible()
  await field.fill('۳')
  await expect(panel.locator('.drawer-destination-options [aria-selected="true"]')).toHaveCount(0)
  await field.press('Enter')
  await expect(panel).toBeVisible()
  expect(await page.evaluate(() => history.length)).toBe(length)
  await field.fill('طه ۴۰')
  await expect(panel.locator('.drawer-destination-options [aria-selected="true"]')).toHaveCount(1)
  await expect(panel.locator('.search-result-open')).toHaveCount(0)
  await field.press('Enter')
  await expect(page).toHaveURL(/\/s\/20\/a\/40$/)
})

test('completion fills the same input and keeps search open, even after typing a trailing space', async ({ page }) => {
  const { panel, field } = await openSearch(page)
  await field.fill('وعد ')
  const completion = panel.locator('[data-search-completions] [role="option"]').first()
  await expect(completion).toBeVisible()
  await field.press('ArrowDown')
  await expect(completion).toHaveAttribute('aria-selected', 'true')
  await field.press('Enter')
  await expect(field).not.toHaveValue('وعد ')
  await expect(panel.locator('.search-result-open').first()).toBeVisible()
  await expect(page).toHaveURL(/\/s\/20\/a\/34$/)
  await field.fill('سذپژتسذپژت')
  await expect(panel.locator('.search-empty')).toBeVisible()
  await expect(panel.locator('.search-result-open')).toHaveCount(0)
})

test('late worker replies cannot replace the newest rendered results', async ({ page }) => {
  await page.addInitScript(() => {
    window.Worker = class extends Worker {
      queries = new Map()

      postMessage(data, ...args) {
        this.queries.set(data.id, data.query)
        return super.postMessage(data, ...args)
      }

      set onmessage(handler) {
        super.onmessage = event => {
          if (this.queries.get(event.data.id) === 'صب') {
            window.releaseOldReply = () => handler(event)
          } else {
            handler(event)
          }
        }
      }
    }
  })
  const { panel, field } = await openSearch(page)
  await field.fill('صب')
  await page.waitForFunction(() => typeof window.releaseOldReply === 'function')
  await field.fill('صبری')
  await expect(panel.locator('.search-page-results')).toHaveAttribute('aria-busy', 'false')
  const summary = panel.locator('.search-results-detail')
  await expect(summary).toBeVisible()
  const newest = await summary.innerText()
  await page.evaluate(() => window.releaseOldReply())
  await expect(summary).toHaveText(newest)
  await expect(field).toHaveValue('صبری')
})

test('one verse card represents multiple separately counted matches', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mubarak.ui-language.v1', 'fa'))
  await page.goto('/q?q=%D8%B2%D8%A8%D8%AF&s=13&h=0')
  const panel = page.locator('[data-search-and-go]')
  await expect(panel.locator('.search-results-detail')).toHaveText('۱ آیه · ۳ یافته شده')
  await expect(panel.locator('.search-result-card')).toHaveCount(1)
  const highlighted = await panel.locator('.search-result-card [data-search-match]').allTextContents()
  const plain = highlighted.join(' ').normalize('NFD').replace(/\p{M}/gu, '')
  expect(plain.match(/زبد/g)).toHaveLength(3)
})

test('the same live input retries when Quran data temporarily fails to load', async ({ page }) => {
  const { panel, field } = await openSearch(page)
  const index = '**/data/quran-search.json'
  await page.route(index, route => route.abort())
  await field.fill('صبر')
  const retry = panel.locator('.search-page-results > button.chip')
  await expect(retry).toBeVisible()
  await page.unroute(index)
  await retry.click()
  await expect(panel.locator('.search-result-open').first()).toBeVisible()
  await expect(field).toHaveValue('صبر')
})
