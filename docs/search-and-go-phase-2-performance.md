# Search and Go Phase 2 verification

Run the browser checks against a local standalone build. The offline test uses the real service worker, the generated core pack and browser network disconnection. The performance test blocks service workers to avoid background downloads during timing.

```sh
NEXT_PUBLIC_SEARCH_AND_GO=1 NEXT_PUBLIC_SEARCH_AND_GO_PHASE_2=1 bun run build
PORT=3026 HOSTNAME=127.0.0.1 node .next/standalone/server.js
```

```sh
SEARCH_AND_GO_PHASE_2_E2E=1 READER_URL=http://127.0.0.1:3026 bunx playwright test \
  --project=chromium-phone --project=chromium-desktop search-and-go-offline

SEARCH_AND_GO_PERF=1 READER_URL=http://127.0.0.1:3026 bunx playwright test \
  --project=chromium-phone --project=chromium-desktop --workers=1 search-and-go-performance
```

Set `SEARCH_AND_GO_PERF_BASELINE=1` and point `READER_URL` to a Phase 1 build to capture comparable round-trip and input-to-results timings. Browser CPU throttling is optional via `SEARCH_AND_GO_CPU_RATE` on Chromium. The runner prints JSON and attaches it to the Playwright result.

| Measurement | Start and end |
| --- | --- |
| Cold initialization | The first worker request waits for corpus fetch, parse and index creation. Phase 2 reports that wait separately from search. |
| Worker search | The initialized worker computes results and suggestions. |
| Worker round trip | The main thread posts the request and receives the response, including startup, scheduling and transfer costs. |
| Input to results | A browser `input` event and the first observed settled results DOM, including debounce and rendering. |
| Rapid input | Three successive field edits, ending in a known query. The report records how many worker requests were dispatched. |
| Many results | Per-query result count and number of initially mounted result cards. Warm sampling covers five workloads over 100 searches. |
| Retained page heap | Chromium's reported main-page JavaScript heap after garbage collection before searching, after the cold search and after 100 warm searches with the cold query showing again. Dedicated worker memory, native allocations and total browser memory require separate measurement. |

For device verification, use the preview on an actual Android and iOS phone. Allow the initial cache and download to finish. Close and reopen the reader with network access disabled, open Search and Go, search `اسما الحسنی`, and open an ayah. Measure repeated searches and rapid input on the device so the result captures its browser and hardware.

## Collected measurements

Chromium 156 on the shared Linux runner. Each warm row has 20 samples per build and viewport. Phase 1 was served from beta commit `f573bbd`. Phase 2 was served locally from preview commit `4634b31`. The later scope change affects suggested candidates. Phase 1 used its existing default root expansion, so the single-word and high-volume result counts differ. The runner was shared with other verification work.

| Query | Phase 1 desktop input → display p95 | Phase 2 desktop input → display p95 | Phase 2 mobile viewport input → display p95 | Phase 2 Worker p95 desktop / mobile viewport |
| --- | ---: | ---: | ---: | ---: |
| اسما الحسنی | 2,798 ms | 687 ms | 911 ms | 161 / 173 ms |
| الحمد لله | 1,953 ms | 755 ms | 1,246 ms | 162 / 276 ms |
| صبر | 500 ms | 654 ms | 1,002 ms | 51 / 84 ms |
| الله | 671 ms | 928 ms | 1,010 ms | 78 / 149 ms |
| Zero-result control | 543 ms | 631 ms | 1,212 ms | 17 / 52 ms |

Phase 2 cold initialization, including fetch, parsing and indexing, took 1,491 ms on the desktop viewport and 3,847 ms on the mobile viewport. The first result appeared after 1,885 ms and 4,987 ms respectively. The Phase 1 beta baseline took 7,506 ms from first input to display. Cold startup includes the serving environment, which differed between the runs.

Rapid changes took 378 ms on the desktop viewport and 147 ms on the mobile viewport from the final input to results. Both recorded three dispatched queries. The stale-reply browser test additionally held an earlier real Worker reply, rendered a later query and then released the older reply.

The worker returned 1,746 verse results for «الله» in Phase 2 and rendered 20 cards initially. The retained main-page heap after the repeated-query run was about 20.5 MB on both Phase 2 viewports. Worker memory and native keyboard behavior require physical-device measurement before product approval. The report separates Worker time from user-visible response.
