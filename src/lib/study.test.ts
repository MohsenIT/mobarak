import { test, expect } from "bun:test";
import {
  createStudy,
  moveBoundary,
  splitContext,
  mergeContext,
  upsertNote,
  validateStudy,
  validPartition,
} from "./study";
import { getSourceSurahContexts, contextSource } from "./contexts";
const seed = () =>
  createStudy(getSourceSurahContexts(20)!.ranges, contextSource.sha256);
test("personal boundaries stay contiguous and source stays immutable", () => {
  const before = JSON.stringify(getSourceSurahContexts(20)),
    base = seed(),
    moved = moveBoundary(base, "p20:1", 10);
  expect(base.contexts[0].to).toBe(8);
  expect(moved.contexts.slice(0, 2).map((c) => [c.from, c.to])).toEqual([
    [1, 10],
    [11, 23],
  ]);
  expect(validPartition(moved.contexts)).toBe(true);
  expect(JSON.stringify(getSourceSurahContexts(20))).toBe(before);
  expect(() => moveBoundary(base, "p20:1", 23)).toThrow();
  expect(() => moveBoundary(base, "p20:9", 130)).toThrow();
});
test("splits keep IDs stable and merging carries notes/explanations without losing content", () => {
  const base = seed(),
    split = splitContext(base, "p20:1", 4, "new-context");
  split.contexts[1].title = "second";
  split.contexts[1].body = "explanation";
  const noted = upsertNote(split, {
    id: "n1",
    anchor: { kind: "context", key: "new-context", label: "second" },
    text: "note",
    createdAt: "2026-10-26",
    updatedAt: "2026-10-26",
  });
  const merged = mergeContext(noted, "p20:1");
  expect(merged.contexts[0].id).toBe("p20:1");
  expect(merged.contexts[0].body).toContain("second");
  expect(merged.contexts[0].body).toContain("explanation");
  expect(merged.notes[0].anchor.key).toBe("p20:1");
  expect(validateStudy(merged)).toBe(true);
});
test("notes are independent single anchors and malformed backups are rejected", () => {
  const base = seed(),
    note = {
      id: "n1",
      anchor: { kind: "verse" as const, key: "72", label: "verse 72" },
      text: "independent",
      createdAt: "2026-10-26",
      updatedAt: "2026-10-26",
    };
  const noted = upsertNote(base, note);
  expect(noted.active).toBe(false);
  expect(noted.notes).toHaveLength(1);
  expect(base.notes).toHaveLength(0);
  expect(
    validateStudy({ ...noted, contexts: [...noted.contexts.slice(1)] }),
  ).toBe(false);
  expect(
    validateStudy({
      ...noted,
      notes: [{ ...note, anchor: [note.anchor, note.anchor] }],
    }),
  ).toBe(false);
  expect(
    validateStudy({
      ...noted,
      notes: [{ ...note, anchor: { kind: "verse", key: "999", label: "bad" } }],
    }),
  ).toBe(false);
  expect(validateStudy(JSON.parse(JSON.stringify(noted)))).toBe(true);
});
