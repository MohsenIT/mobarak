const { test, expect } = require('@playwright/test');

test.skip(process.env.SEARCH_AND_GO_PERF !== '1', 'Run against a Search and Go build to collect timings.');

const baseline = process.env.SEARCH_AND_GO_PERF_BASELINE === '1';
test.use({ ignoreHTTPSErrors: baseline });

const workloads = [
  ['phrase', 'اسما الحسنی'],
  ['exact', 'الحمد لله'],
  ['single word', 'صبر'],
  ['many results', 'الله'],
  ['no results', 'زززززز'],
];

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => Math.round(sorted[Math.ceil(sorted.length * p) - 1] * 10) / 10;
  return { median: percentile(0.5), p95: percentile(0.95), max: percentile(1) };
}

test('measure cold initialization, warm searches, rapid input, and retained page heap', async ({ page, context, browserName }, info) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    localStorage.setItem('mubarak.ui-language.v1', 'fa');
    localStorage.setItem('mushaf.safavi-default.v1', 'true');
    const stats = window.searchPerf = { inputs: [], requests: [] };
    addEventListener('input', event => {
      if (event.target.closest('[data-search-and-go]')) stats.inputs.push({ query: event.target.value, at: performance.now() });
    }, true);

    window.Worker = class extends Worker {
      requests = new Map();

      constructor(...args) {
        super(...args);
        this.addEventListener('message', ({ data }) => {
          const request = this.requests.get(data.id);
          if (!request) return;
          Object.assign(request, {
            replied: performance.now(),
            timing: data.timing,
            resultCount: data.results?.length,
            verses: data.results?.slice(0, 4).map(({ s, a }) => [s, a]),
          });
          this.requests.delete(data.id);
        });
      }

      postMessage(data, ...args) {
        if (typeof data.query === 'string') {
          const request = { query: data.query, sent: performance.now() };
          this.requests.set(data.id, request);
          stats.requests.push(request);
        }
        return super.postMessage(data, ...args);
      }
    };
  });

  await page.route('**/api/version', route => route.fulfill({ json: { version: 'perf', releases: [] } }));
  await page.route('**/offline-manifest.json', route => route.fulfill({ json: { groups: { core: [] } } }));
  await page.goto('/s/20/a/34');
  await expect(page.locator('.startup-splash')).toHaveCount(0);
  await expect(page.locator('[data-reading-scroll] [data-pos]').first()).toBeAttached();
  await page.locator('.reader-surah-link').click();
  const field = page.locator('[data-search-and-go]').getByRole('combobox');
  await expect(field).toBeVisible();

  const cdp = browserName === 'chromium' ? await context.newCDPSession(page) : null;
  const cpuThrottle = Number(process.env.SEARCH_AND_GO_CPU_RATE || 1);
  if (cpuThrottle !== 1) {
    if (!cdp || !Number.isFinite(cpuThrottle) || cpuThrottle < 1) throw new Error('CPU throttling requires Chromium and a rate of at least 1');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
  }
  const pageHeap = async () => {
    if (!cdp) return null;
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize;
  };
  const before = await pageHeap();

  async function search(queries) {
    const { inputIndex, requestIndex } = await page.evaluate(() => ({
      inputIndex: window.searchPerf.inputs.length,
      requestIndex: window.searchPerf.requests.length,
    }));
    for (const query of queries) await field.fill(query);
    const result = await page.waitForFunction(({ query, inputIndex, requestIndex }) => {
      const input = window.searchPerf.inputs.slice(inputIndex).findLast(item => item.query === query);
      const request = window.searchPerf.requests.slice(requestIndex).findLast(item => item.query === query);
      const list = document.querySelector('[data-search-and-go] .search-page-results');
      const summary = document.querySelector('[data-search-and-go] .search-results-summary .search-results-total');
      if (!input || !request?.replied || !summary || list?.getAttribute('aria-busy') !== 'false') return;
      return {
        timing: request.timing,
        resultCount: request.resultCount,
        verses: request.verses,
        displayed: list.querySelectorAll('.search-result-open').length,
        roundTripMs: request.replied - request.sent,
        inputToResultsMs: performance.now() - input.at,
        dispatched: window.searchPerf.requests.length - requestIndex,
      };
    }, { query: queries.at(-1), inputIndex, requestIndex }, { timeout: 20_000 });
    const sample = await result.jsonValue();
    await result.dispose();
    if (!baseline) expect(sample.timing).toEqual({ initMs: expect.any(Number), searchMs: expect.any(Number) });
    return sample;
  }

  const cold = await search([workloads[0][1]]);
  expect(cold.resultCount).toBe(4);
  const initialized = await pageHeap();
  const samples = Object.fromEntries(workloads.map(([name]) => [name, []]));
  for (let i = 0; i < 20; i++) {
    for (const [name, query] of [...workloads.slice(1), workloads[0]]) {
      samples[name].push(await search([query]));
    }
  }
  const many = samples['many results'][0];
  expect(many.resultCount).toBeGreaterThan(100);
  expect(many.displayed).toBeLessThan(many.resultCount);
  expect(samples['no results'][0].resultCount).toBe(0);
  const repeated = await pageHeap();
  const rapid = await search(['الحمد', 'الحمد ل', 'الحمد لله']);
  expect(rapid.verses).toEqual(samples.exact[0].verses);
  await expect(page.locator('[data-search-and-go] .search-result-open').first()).toHaveAccessibleName(/فاتحه.*۲/);

  const warm = Object.fromEntries(Object.entries(samples).map(([name, runs]) => [name, {
    samples: runs.length,
    resultCount: runs[0].resultCount,
    renderedCards: runs[0].displayed,
    workerSearchMs: baseline ? null : summarize(runs.map(run => run.timing.searchMs)),
    roundTripMs: summarize(runs.map(run => run.roundTripMs)),
    inputToResultsMs: summarize(runs.map(run => run.inputToResultsMs)),
  }]));
  const report = {
    project: info.project.name,
    build: baseline ? 'phase 1' : 'phase 2',
    browser: context.browser()?.version(),
    viewport: page.viewportSize(),
    chromiumCpuThrottle: cpuThrottle,
    cold, warm, rapid,
    pageHeapBytes: { before, initialized, repeated },
  };
  console.log(JSON.stringify(report, null, 2));
  await info.attach('search-and-go-performance', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});
