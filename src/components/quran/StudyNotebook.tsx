"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, NotebookPen, Download, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DictationInput, DictationTextarea } from "./DictationInput";
import { useUiLanguage } from "@/lib/i18n";
import { studyT as st, studyDirection } from "@/lib/study-messages";
import { saveStudy, useStudyWorkspace } from "@/lib/study-store";
import { contextSource, getSourceSurahContexts } from "@/lib/contexts";
import {
  moveBoundary,
  splitContext,
  mergeContext,
  upsertNote,
  validateStudy,
  type StudyWorkspace,
  type NoteKind,
  type NoteAnchor,
  type StudyNote,
} from "@/lib/study";
import { loadSurah, toFa, morphologyLabel, type SurahData } from "@/lib/quran";
import { lemmaDisplay } from "@/lib/lemma-display";
const kinds = ["verse", "root", "lemma", "form", "context"] as const;
const targetLabel = (kind: NoteKind) =>
  st(kind === "context" ? "noteContext" : kind);
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function StudyNotebook() {
  useUiLanguage();
  const { work, storageError, saving } = useStudyWorkspace(),
    [surah, setSurah] = useState<SurahData | null>(null);
  const [tab, setTab] = useState<"reader" | "editor" | "notes" | "report">(
      "reader",
    ),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState("p20:1");
  const [boundary, setBoundary] = useState<number | null>(null),
    [action, setAction] = useState<"move" | "split" | "merge">("move"),
    [error, setError] = useState("");
  const [noteKind, setNoteKind] = useState<NoteKind>("verse"),
    [noteKey, setNoteKey] = useState("1"),
    [noteText, setNoteText] = useState(""),
    [noteId, setNoteId] = useState<string | null>(null);
  const [history, setHistory] = useState<StudyWorkspace[]>([]),
    importFile = useRef<HTMLInputElement>(null);
  const [back,setBack]=useState({a:1,w:1});
  const source = getSourceSurahContexts(20)!;
  useEffect(() => {
    loadSurah(20).then(setSurah);
    const query=new URLSearchParams(location.search),a=Number(query.get('backA')),w=Number(query.get('backW'));if(Number.isInteger(a)&&a>=1&&a<=135)setBack({a,w:Number.isInteger(w)&&w>=1&&w<=500?w:1});
    try {
      const theme = JSON.parse(
        localStorage.getItem("mushaf.theme") ?? '"paper"',
      );
      if (theme === "paper" || theme === "night")
        document.documentElement.dataset.theme = theme;
    } catch {}
  }, []);
  const options = useMemo(() => {
    if (!surah || !work) return [];
    if (noteKind === "verse")
      return surah.v.map((v) => ({
        key: String(v.n),
        label: `${st("verse")} ${toFa(v.n)}`,
      }));
    if (noteKind === "context")
      return [
        ...source.ranges.map((c, i) => ({
          key: `s20:${c.id}`,
          label: `${st("source")} · ${st("context", { n: i + 1 })}`,
        })),
        ...work.contexts.map((c, i) => ({
          key: c.id,
          label: `${st("personal")} · ${c.title || st("context", { n: i + 1 })}`,
        })),
      ];
    const rows = surah.v
      .flatMap((v) => v.w)
      .flatMap((w) =>
        noteKind === "root" && w.r
          ? [{ key: w.r, label: w.r }]
          : noteKind === "lemma" && w.lemma
            ? [{ key: w.lemma, label: lemmaDisplay(w.lemma) }]
            : noteKind === "form" && w.r && w.form
              ? [
                  {
                    key: `${w.r}:${w.form}`,
                    label: `${w.r} · ${morphologyLabel(w.form)}`,
                  },
                ]
              : [],
      );
    return [...new Map(rows.map((row) => [row.key, row])).values()].sort(
      (a, b) => a.label.localeCompare(b.label, "ar"),
    );
  }, [surah, work, noteKind]);
  useEffect(() => {
    if (options.length && !options.some((option) => option.key === noteKey))
      setNoteKey(options[0].key);
  }, [options, noteKey]);
  useEffect(() => {
    if (!surah || !work) return;
    const query = new URLSearchParams(location.search),
      kind = query.get("kind"),
      key = query.get("key");
    if (kind && kinds.includes(kind as NoteKind) && key) {
      setNoteKind(kind as NoteKind);
      setNoteKey(key);
      setTab("notes");
    }
  }, [!!surah, !!work]);
  if (!work || !surah)
    return (
      <main className="study-page" dir={studyDirection()}>
        <p>{st("loading")}</p>
      </main>
    );
  const existingNote=work.notes.find(note=>note.id===noteId);
  const draftDirty=noteId?noteText!==existingNote?.text||noteKind!==existingNote?.anchor.kind||noteKey!==existingNote?.anchor.key:!!noteText.trim();
  const remember = (next: StudyWorkspace) => {
    setHistory((items) => [...items.slice(-19), structuredClone(work)]);
    void saveStudy(next);
    setError("");
  };
  const changeContext = (id: string, field: "title" | "body", value: string) =>
    remember({
      ...work,
      active: true,
      contexts: work.contexts.map((c) =>
        c.id === id ? { ...c, [field]: value } : c,
      ),
    });
  const index = work.contexts.findIndex((c) => c.id === selected),
    current = work.contexts[index],
    next = work.contexts[index + 1];
  const active = work.active
    ? work.contexts
    : source.ranges.map((r) => ({
        id: `s20:${r.id}`,
        from: r.from,
        to: r.to,
        title: "",
        body: "",
      }));
  const range = (from: number, to: number) => st("range", { from, to });
  const noteAnchor = (): NoteAnchor => ({
    kind: noteKind,
    key: noteKey,
    label: options.find((row) => row.key === noteKey)?.label ?? noteKey,
  });
  const saveNote = () => {
    if (!noteText.trim()) {
      setError(st("noteRequired"));
      return;
    }
    const previous = work.notes.find((n) => n.id === noteId),
      now = new Date().toISOString();
    remember(
      upsertNote(work, {
        id: noteId ?? crypto.randomUUID(),
        anchor: noteAnchor(),
        text: noteText,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      }),
    );
    setNoteText("");
    setNoteId(null);
  };
  const editNote = (note: StudyNote) => {
    setNoteKind(note.anchor.kind);
    setNoteKey(note.anchor.key);
    setNoteText(note.text);
    setNoteId(note.id);
    setTab("notes");
  };
  const apply = () => {
    try {
      remember(
        action === "merge"
          ? mergeContext(work, selected)
          : action === "split"
            ? splitContext(work, selected, boundary!, crypto.randomUUID())
            : moveBoundary(work, selected, boundary!),
      );
      setBoundary(null);
    } catch {
      setError(st("invalidBoundary"));
    }
  };
  const anchorLabel = (note: StudyNote) => {
    if (note.anchor.kind === "context") {
      const i = work.contexts.findIndex((c) => c.id === note.anchor.key);
      if (i >= 0)
        return `${st("personal")} · ${work.contexts[i].title || st("context", { n: i + 1 })}`;
    }
    return note.anchor.label;
  };
  const hasPersonal =
    work.active ||
    !!work.overview ||
    work.contexts.some(
      (c, i) =>
        c.title ||
        c.body ||
        c.from !== source.ranges[i]?.from ||
        c.to !== source.ranges[i]?.to,
    );
  const reportContexts = hasPersonal ? work.contexts : active;
  const markdown = () =>
    [
      `# ${st("reportTitle")}`,
      `## ${st("reportSource")}`,
      contextSource.title,
      contextSource.publisher,
      `${location.origin}${contextSource.url}`,
      ...(work.overview ? [`## ${st("overview")}`, work.overview] : []),
      `## ${hasPersonal ? st("reportPersonal") : st("source")}`,
      ...reportContexts.flatMap((c, i) => [
        `### ${c.title || st("context", { n: i + 1 })} — ${range(c.from, c.to)}`,
        c.body || st("empty"),
      ]),
      `## ${st("reportNotes")}`,
      ...work.notes.flatMap((n) => [
        `### ${targetLabel(n.anchor.kind)} · ${anchorLabel(n)}`,
        n.text,
        `https://quran-vajeh.vercel.app/s/20${n.anchor.kind === "verse" ? `/a/${n.anchor.key}` : ""}`,
      ]),
    ].join("\n\n");
  return (
    <main
      className="study-page"
      dir={studyDirection()}
      lang={studyDirection() === "rtl" ? "fa" : "en"}
    >
      <header className="study-header">
        <a
          className="icon-btn"
          href={process.env.NEXT_PUBLIC_DESKTOP === "1" ? `/?s=20&a=${back.a}&w=${back.w}` : `/s/20/a/${back.a}/w/${back.w}`}
          aria-label={st("back")}
        >
          <ArrowRight size={20} />
        </a>
        <div>
          <h1>
            <NotebookPen size={20} />
            {st("title")}
          </h1>
          <p>{st("preview")}</p>
        </div>
        <button
          className="icon-btn"
          disabled={!history.length}
          title={st("undo")}
          aria-label={st("undo")}
          onClick={() => {
            const previous = history.at(-1);
            if (previous) {
              setHistory((items) => items.slice(0, -1));
              void saveStudy(previous);
            }
          }}
        >
          <Undo2 size={20} />
        </button>
      </header>
      <p className="study-save-status" role="status">
        {draftDirty
          ? st("unsavedNote")
          : storageError
          ? st("storageError")
          : saving
            ? st("saving")
            : st("saved")}
      </p>
      <nav className="study-tabs" aria-label={st("title")}>
        {(["reader", "editor", "notes", "report"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {st(key)}
          </button>
        ))}
      </nav>
      {error && (
        <p className="study-error" role="alert">
          {error}
        </p>
      )}
      <section className="study-version">
        <p>{st("sourceInfo")}</p>
        <div className="study-actions">
          <button
            aria-pressed={!work.active}
            onClick={() => remember({ ...work, active: false })}
          >
            {st("source")}
          </button>
          <button
            aria-pressed={work.active}
            onClick={() => remember({ ...work, active: true })}
          >
            {st("personal")}
          </button>
        </div>
        <a
          href={`${contextSource.url}#page=11`}
          target="_blank"
          rel="noreferrer"
        >
          {st("sourceLink")}
        </a>
      </section>
      {tab === "editor" && (
        <article className="study-editor">
          <label>
            {st("overview")}
            <DictationTextarea
              maxLength={50000}
              value={work.overview}
              placeholder={st("overviewHint")}
              onChange={(event) =>
                remember({ ...work, overview: event.target.value })
              }
            />
          </label>
          {work.contexts.map((c, i) => (
            <section className="study-context" key={c.id}>
              <h2>
                {st("context", { n: i + 1 })}
                <small>{range(c.from, c.to)}</small>
              </h2>
              <label>
                {st("contextTitle")}
                <DictationInput
                  maxLength={500}
                  value={c.title}
                  onChange={(event) =>
                    changeContext(c.id, "title", event.target.value)
                  }
                />
              </label>
              <label>
                {st("contextBody")}
                <DictationTextarea
                  maxLength={50000}
                  rows={4}
                  value={c.body}
                  onChange={(event) =>
                    changeContext(c.id, "body", event.target.value)
                  }
                />
              </label>
              <div className="study-actions">
                <button
                  onClick={() => {
                    setSelected(c.id);
                    setEditing(true);
                    remember({ ...work, active: true });
                    setTab("reader");
                  }}
                >
                  {st("editMode")}
                </button>
                {i < work.contexts.length - 1 && (
                  <button
                    onClick={() => {
                      setSelected(c.id);
                      setAction("merge");
                      setBoundary(c.to);
                    }}
                  >
                    {st("merge")}
                  </button>
                )}
              </div>
            </section>
          ))}
        </article>
      )}
      {tab === "reader" && (
        <section className="study-reader">
          <label className="choice-row">
            <span>{st("editMode")}</span>
            <input
              type="checkbox"
              checked={editing}
              onChange={(event) => {
                setEditing(event.target.checked);
                if (event.target.checked && !work.active)
                  remember({ ...work, active: true });
              }}
            />
          </label>
          {editing && (
            <>
              <label>
                {st("chooseContext")}
                <select
                  aria-label={st("chooseContext")}
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {work.contexts.map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {c.title || st("context", { n: i + 1 })} ·{" "}
                      {range(c.from, c.to)}
                    </option>
                  ))}
                </select>
              </label>
              <p>{st("editHint")}</p>
            </>
          )}
          {active.map((c, i) => (
            <section className="study-context" key={c.id}>
              <h2>
                {c.title || st("context", { n: i + 1 })}
                <small>{range(c.from, c.to)}</small>
              </h2>
              {c.body && <p className="study-context-body">{c.body}</p>}
              <p className="font-quran study-quran" lang="ar" dir="rtl">
                {surah.v
                  .filter((v) => v.n >= c.from && v.n <= c.to)
                  .map((v) => (
                    <span key={v.n}>
                      {v.w.map((w) => w.t).join(" ")}{" "}
                      <button
                        type="button"
                        className="study-ayah"
                        aria-label={`${st("verse")} ${toFa(v.n)}`}
                        onClick={() => {
                          if (editing) {
                            setAction(next ? "move" : "split");
                            setBoundary(v.n);
                            setError("");
                          } else {
                            setNoteKind("verse");
                            setNoteKey(String(v.n));
                            setTab("notes");
                          }
                        }}
                      >
                        {toFa(v.n)}
                      </button>{" "}
                    </span>
                  ))}
              </p>
              <button
                onClick={() => {
                  setNoteKind("context");
                  setNoteKey(c.id);
                  setTab("notes");
                }}
              >
                {st("continueNote")}
              </button>
            </section>
          ))}
        </section>
      )}
      {tab === "notes" && (
        <section className="study-notes">
          <p>{st("noteOne")}</p>
          <label>
            {st("noteTarget")}
            <select
              aria-label={st("noteTarget")}
              value={noteKind}
              onChange={(event) => {
                setNoteKind(event.target.value as NoteKind);
                setNoteKey("");
              }}
            >
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {targetLabel(kind)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {st("target")}
            <select
              aria-label={st("target")}
              value={noteKey}
              onChange={(event) => setNoteKey(event.target.value)}
            >
              {options.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {st("noteText")}
            <DictationTextarea
              maxLength={50000}
              rows={5}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
            />
          </label>
          <p>{st("audioHint")}</p>
          <button className="study-primary" onClick={saveNote}>
            {st("saveNote")}
          </button>
          {!work.notes.length && <p>{st("emptyNotes")}</p>}
          {work.notes.map((note) => (
            <article className="study-context" key={note.id}>
              <h2>
                {targetLabel(note.anchor.kind)} · {anchorLabel(note)}
              </h2>
              <p className="study-context-body">{note.text}</p>
              <div className="study-actions">
                <button onClick={() => editNote(note)}>{st("editNote")}</button>
                <button
                  onClick={() =>
                    remember({
                      ...work,
                      notes: work.notes.filter((n) => n.id !== note.id),
                    })
                  }
                >
                  {st("deleteNote")}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {tab === "report" && (
        <section className="study-report">
          <div className="study-actions">
            <button
              onClick={() =>
                download(
                  "taha-study.md",
                  markdown(),
                  "text/markdown;charset=utf-8",
                )
              }
            >
              <Download size={16} />
              {st("exportReport")}
            </button>
            <button
              onClick={() =>
                download(
                  "taha-study.json",
                  JSON.stringify(work, null, 2),
                  "application/json",
                )
              }
            >
              {st("exportBackup")}
            </button>
            <button onClick={() => importFile.current?.click()}>
              {st("importBackup")}
            </button>
            <input
              hidden
              type="file"
              ref={importFile}
              accept="application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 10_000_000) throw new Error("size");
                  const value = JSON.parse(await file.text());
                  if (!validateStudy(value)) throw new Error("invalid");
                  remember(value);
                } catch {
                  setError(st("importError"));
                }
                event.target.value = "";
              }}
            />
          </div>
          <pre>{markdown()}</pre>
        </section>
      )}
      <Dialog
        open={boundary !== null}
        onOpenChange={(open) => {
          if (!open) setBoundary(null);
        }}
      >
        <DialogContent
          className="resource-picker-dialog"
          dir={studyDirection()}
        >
          <DialogTitle>{st("boundary")}</DialogTitle>
          <DialogDescription>
            {action === "merge"
              ? st("confirmMerge")
              : st("selectedVerse", { n: boundary ?? 0 })}
          </DialogDescription>
          {action !== "merge" && (
            <select
              aria-label={st("boundary")}
              value={action}
              onChange={(event) =>
                setAction(event.target.value as "move" | "split")
              }
            >
              <option value="move">{st("move")}</option>
              <option value="split">{st("split")}</option>
            </select>
          )}
          {current && (
            <>
              <p>
                <b>{st("before")}</b>
                <br />
                {current.title || st("context", { n: index + 1 })}:{" "}
                {range(current.from, current.to)}
                {next && (
                  <>
                    <br />
                    {next.title || st("context", { n: index + 2 })}:{" "}
                    {range(next.from, next.to)}
                  </>
                )}
              </p>
              <p>
                <b>{st("after")}</b>
                <br />
                {action === "merge" && next
                  ? range(current.from, next.to)
                  : range(current.from, boundary ?? current.to)}
                {action === "move" && next && (
                  <>
                    <br />
                    {range((boundary ?? current.to) + 1, next.to)}
                  </>
                )}
                {action === "split" && (
                  <>
                    <br />
                    {range((boundary ?? current.to) + 1, current.to)}
                  </>
                )}
              </p>
            </>
          )}
          <div className="study-actions">
            <button onClick={apply}>{st("apply")}</button>
            <button onClick={() => setBoundary(null)}>{st("cancel")}</button>
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
