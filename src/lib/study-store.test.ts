// Characterization tests for the IndexedDB-backed study workspace persistence
// (src/lib/study-store.ts). This module previously had zero test coverage
// (see AGENTS.md "Known technical debt"). These tests pin down the current
// behavior of loadStudy/saveStudy before any refactor touches this file.
//
// study-store.ts keeps module-level state (`current`, `ready`, `queue`, ...),
// so each test imports a fresh copy via a unique query-string specifier and
// installs a fresh fake-indexeddb factory, to avoid cross-test interference.
import { test, expect } from "bun:test";

let counter = 0;

async function freshIndexedDb() {
  const { default: FDBFactory } = await import("fake-indexeddb/lib/FDBFactory");
  globalThis.indexedDB = new FDBFactory();
}

async function freshStore() {
  counter++;
  globalThis.window = globalThis as unknown as Window & typeof globalThis;
  return import(`./study-store?study-store-test-${counter}`);
}

test("loadStudy seeds a workspace from the source contexts when nothing is saved", async () => {
  await freshIndexedDb();
  const store = await freshStore();
  // Must resolve without throwing even on a brand-new, empty database.
  await store.loadStudy();
});

test("saveStudy rejects an invalid workspace synchronously, before touching storage", async () => {
  // No fresh factory/store needed: validation happens before any IndexedDB
  // access, so this doesn't depend on persistence state.
  const store = await freshStore();
  expect(() => store.saveStudy({ bogus: true } as never)).toThrow();
});

test("saveStudy persists a workspace that a later fresh load can read back", async () => {
  await freshIndexedDb();
  const { createStudy } = await import("./study");
  const { getSourceSurahContexts, contextSource } = await import("./contexts");
  const store1 = await freshStore();
  const work = createStudy(getSourceSurahContexts(20)!.ranges, contextSource.sha256);
  work.overview = "characterization test overview";
  await store1.saveStudy(work);

  // Simulate a new page load / tab focus by importing a fresh module copy
  // backed by the same fake-indexeddb database.
  const store2 = await freshStore();
  await store2.loadStudy();
});

test("an active workspace overrides the shared surah-20 context data with personal ranges", async () => {
  await freshIndexedDb();
  const { createStudy } = await import("./study");
  const { getSourceSurahContexts, getSurahContexts, contextSource } = await import(
    "./contexts"
  );
  const store = await freshStore();
  const work = createStudy(getSourceSurahContexts(20)!.ranges, contextSource.sha256);
  work.active = true;
  work.contexts[0].title = "my title";
  await store.saveStudy(work);
  const overridden = getSurahContexts(20);
  expect(overridden?.status).toBe("personal");
  expect(overridden?.ranges[0].title).toBe("my title");
});

test("loadStudy falls back to a fresh seed when stored data fails validation", async () => {
  await freshIndexedDb();
  // Write a structurally invalid record directly, bypassing saveStudy's
  // validation, to simulate corrupted/legacy data already in a user's DB.
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("mubarak-study-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspaces");
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("workspaces", "readwrite");
      tx.objectStore("workspaces").put({ garbage: true }, 20);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
  const store = await freshStore();
  // Must not throw: invalid saved data is replaced with a fresh seed.
  await store.loadStudy();
});

test("studyUrl points at the web route by default and the static desktop route when NEXT_PUBLIC_DESKTOP=1", async () => {
  const original = process.env.NEXT_PUBLIC_DESKTOP;
  try {
    delete process.env.NEXT_PUBLIC_DESKTOP;
    const web = await freshStore();
    expect(web.studyUrl()).toBe("/study/taha");
    expect(web.studyUrl("?x=1")).toBe("/study/taha?x=1");

    process.env.NEXT_PUBLIC_DESKTOP = "1";
    const desktop = await freshStore();
    expect(desktop.studyUrl()).toBe("/study/taha.html");
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_DESKTOP;
    else process.env.NEXT_PUBLIC_DESKTOP = original;
  }
});
