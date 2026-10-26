"use client";
import { useEffect, useSyncExternalStore } from "react";
import {
  contextSource,
  getSourceSurahContexts,
  setPersonalContextOverride,
} from "./contexts";
import { createStudy, validateStudy, type StudyWorkspace } from "./study";
let current: StudyWorkspace | null = null,
  problem = false,
  pending = 0,
  loading = false,
  ready: Promise<void> | null = null,
  queue = Promise.resolve();
const listeners = new Set<() => void>(),
  snapshot = () => current,
  serverSnapshot = () => null;
const seed = () =>
  createStudy(getSourceSurahContexts(20)!.ranges, contextSource.sha256);
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mubarak-study-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspaces");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function publish(work: StudyWorkspace) {
  current = work;
  const source = getSourceSurahContexts(20)!;
  setPersonalContextOverride(
    20,
    work.active
      ? {
          ...source,
          status: "personal",
          ranges: work.contexts.map((c, i) => ({
            id: i + 1,
            stableId: c.id,
            from: c.from,
            to: c.to,
            title: c.title,
            note: c.body,
            origin: "personal",
            sourcePage: source.sourcePage,
          })),
        }
      : null,
  );
  listeners.forEach((listener) => listener());
}
export function loadStudy() {
  if (!ready)
    ready = (async () => {
      loading = true;
      try {
        const db = await database();
        const saved = await new Promise<unknown>((resolve, reject) => {
          const request = db
            .transaction("workspaces")
            .objectStore("workspaces")
            .get(20);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        db.close();
        const next = validateStudy(saved) ? saved : seed();
        if (JSON.stringify(next) !== JSON.stringify(current)) publish(next);
      } catch {
        problem = true;
        if (!current) publish(seed());
      } finally {
        loading = false;
      }
    })();
  return ready;
}
export function saveStudy(work: StudyWorkspace) {
  if (!validateStudy(work)) throw new Error("invalid-workspace");
  pending++;
  publish(work);
  queue = queue
    .then(async () => {
      const db = await database();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("workspaces", "readwrite");
        tx.objectStore("workspaces").put(work, 20);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
      problem = false;
    })
    .catch(() => {
      problem = true;
    })
    .finally(() => {
      pending--;
      listeners.forEach((listener) => listener());
    });
  return queue;
}
export function useStudyWorkspace() {
  const work = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    snapshot,
    serverSnapshot,
  );
  const storageError = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => problem,
    () => false,
  );
  const saving = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => pending > 0,
    () => false,
  );
  useEffect(() => {
    void loadStudy();
    const refresh = () => {
      if (!pending && !loading) {
        ready = null;
        void loadStudy();
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);
  return { work, storageError, saving };
}
export function studyUrl(query = "") {
  return `${process.env.NEXT_PUBLIC_DESKTOP === "1" ? "/study/taha.html" : "/study/taha"}${query}`;
}
