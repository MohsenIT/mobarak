import type { ContextRange } from "./contexts";
export type NoteKind = "verse" | "root" | "lemma" | "form" | "context";
export interface NoteAnchor {
  kind: NoteKind;
  key: string;
  label: string;
}
export interface StudyNote {
  id: string;
  anchor: NoteAnchor;
  text: string;
  createdAt: string;
  updatedAt: string;
}
export interface PersonalContext {
  id: string;
  from: number;
  to: number;
  title: string;
  body: string;
}
export interface StudyWorkspace {
  schema: 1;
  surah: 20;
  sourceSha: string;
  active: boolean;
  overview: string;
  contexts: PersonalContext[];
  notes: StudyNote[];
}
export function createStudy(
  ranges: ContextRange[],
  sourceSha: string,
): StudyWorkspace {
  return {
    schema: 1,
    surah: 20,
    sourceSha,
    active: false,
    overview: "",
    contexts: ranges.map((r) => ({
      id: `p20:${r.id}`,
      from: r.from,
      to: r.to,
      title: "",
      body: "",
    })),
    notes: [],
  };
}
export function validPartition(contexts: PersonalContext[]) {
  return (
    contexts.length > 0 &&
    contexts[0].from === 1 &&
    contexts.at(-1)!.to === 135 &&
    new Set(contexts.map((c) => c.id)).size === contexts.length &&
    contexts.every(
      (c, i) =>
        Number.isInteger(c.from) &&
        Number.isInteger(c.to) &&
        c.from <= c.to &&
        c.from >= 1 &&
        c.to <= 135 &&
        (!i || c.from === contexts[i - 1].to + 1),
    )
  );
}
export function moveBoundary(
  work: StudyWorkspace,
  id: string,
  to: number,
): StudyWorkspace {
  const next = structuredClone(work),
    i = next.contexts.findIndex((c) => c.id === id),
    context = next.contexts[i],
    following = next.contexts[i + 1];
  if (
    !context ||
    !following ||
    !Number.isInteger(to) ||
    to < context.from ||
    to >= following.to
  )
    throw new Error("invalid-boundary");
  context.to = to;
  following.from = to + 1;
  next.active = true;
  return next;
}
export function splitContext(
  work: StudyWorkspace,
  id: string,
  after: number,
  newId: string,
): StudyWorkspace {
  const next = structuredClone(work),
    i = next.contexts.findIndex((c) => c.id === id),
    context = next.contexts[i];
  if (
    !context ||
    !Number.isInteger(after) ||
    after < context.from ||
    after >= context.to ||
    next.contexts.some((c) => c.id === newId)
  )
    throw new Error("invalid-split");
  const end = context.to;
  context.to = after;
  next.contexts.splice(i + 1, 0, {
    id: newId,
    from: after + 1,
    to: end,
    title: "",
    body: "",
  });
  next.active = true;
  return next;
}
export function mergeContext(work: StudyWorkspace, id: string): StudyWorkspace {
  const next = structuredClone(work),
    i = next.contexts.findIndex((c) => c.id === id),
    a = next.contexts[i],
    b = next.contexts[i + 1];
  if (!a || !b) throw new Error("invalid-merge");
  a.to = b.to;
  a.body = [a.body, b.title, b.body].filter(Boolean).join("\n\n");
  next.contexts.splice(i + 1, 1);
  next.notes = next.notes.map((note) =>
    note.anchor.kind === "context" && note.anchor.key === b.id
      ? {
          ...note,
          anchor: {
            ...note.anchor,
            key: a.id,
            label: a.title || note.anchor.label,
          },
        }
      : note,
  );
  next.active = true;
  return next;
}
function validAnchor(anchor: NoteAnchor, contexts: PersonalContext[]) {
  if (
    !anchor ||
    Array.isArray(anchor) ||
    typeof anchor.key !== "string" ||
    !anchor.key.trim() ||
    anchor.key.length > 200 ||
    typeof anchor.label !== "string"
  )
    return false;
  if (anchor.kind === "verse")
    return (
      /^\d+$/.test(anchor.key) &&
      Number(anchor.key) >= 1 &&
      Number(anchor.key) <= 135
    );
  if (anchor.kind === "context")
    return (
      contexts.some((c) => c.id === anchor.key) ||
      /^s20:[1-9]$/.test(anchor.key)
    );
  return ["root", "lemma", "form"].includes(anchor.kind);
}
export function validateStudy(value: unknown): value is StudyWorkspace {
  const work = value as StudyWorkspace;
  return (
    !!work &&
    work.schema === 1 &&
    work.surah === 20 &&
    typeof work.sourceSha === "string" &&
    /^[a-f0-9]{64}$/.test(work.sourceSha) &&
    typeof work.active === "boolean" &&
    typeof work.overview === "string" &&
    work.overview.length <= 50000 &&
    Array.isArray(work.contexts) &&
    work.contexts.length <= 135 &&
    work.contexts.every(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.title === "string" &&
        typeof c.body === "string" &&
        c.title.length <= 500 &&
        c.body.length <= 50000,
    ) &&
    validPartition(work.contexts) &&
    Array.isArray(work.notes) &&
    work.notes.length <= 5000 &&
    new Set(work.notes.map((n) => n?.id)).size === work.notes.length &&
    work.notes.every(
      (n) =>
        n &&
        typeof n.id === "string" &&
        typeof n.text === "string" &&
        n.text.length <= 50000 &&
        typeof n.createdAt === "string" &&
        typeof n.updatedAt === "string" &&
        validAnchor(n.anchor, work.contexts),
    )
  );
}
export function upsertNote(
  work: StudyWorkspace,
  note: StudyNote,
): StudyWorkspace {
  const next = {
    ...work,
    notes: [...work.notes.filter((n) => n.id !== note.id), note],
  };
  if (!note.text.trim() || !validateStudy(next))
    throw new Error("invalid-note");
  return next;
}
