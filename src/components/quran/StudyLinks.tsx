"use client";
import { NotebookPen } from "lucide-react";
import { studyT as st } from "@/lib/study-messages";
import { studyUrl, useStudyWorkspace } from "@/lib/study-store";
import type { AnalysisTab } from "@/lib/analysis";
import type { SurahData } from "@/lib/quran";
export function StudyEntry() {
  return (
    <a className="drawer-advanced-search" href={studyUrl()}>
      <NotebookPen size={18} />
      <span>{st("entry")}</span>
    </a>
  );
}
export function StudyNoteLink({
  surah,
  a,
  pos,
  tab,
  contextId,
}: {
  surah: SurahData;
  a: number;
  pos: number;
  tab: AnalysisTab;
  contextId?: string;
}) {
  if (surah.n !== 20) return null;
  const word = surah.v.find((v) => v.n === a)?.w[pos - 1];
  let kind = "verse",
    key = String(a);
  if (tab === "root" && word?.r) {
    kind = "root";
    key = word.r;
  }
  if (tab === "form" && word?.r && word.form) {
    kind = "form";
    key = `${word.r}:${word.form}`;
  }
  if (tab === "word" && word?.lemma) {
    kind = "lemma";
    key = word.lemma;
  }
  if (tab === "context") {
    kind = "context";
    key = contextId ?? `s20:${1}`;
  }
  const query = new URLSearchParams({ kind, key, backA:String(a),backW:String(pos) });
  return (
    <a
      className="icon-btn sm"
      href={studyUrl(`?${query}`)}
      title={st("continueNote")}
      aria-label={st("continueNote")}
    >
      <NotebookPen size={17} />
    </a>
  );
}
