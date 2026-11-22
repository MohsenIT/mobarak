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
