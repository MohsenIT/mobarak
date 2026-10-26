"use client";
import fa from "@/messages/study/fa.json";
import en from "@/messages/study/en.json";
import { currentLanguage } from "./i18n";
import { formatDigits } from "./locale-numbers";
/** Preview UI is reviewed in Persian/English first; content is never machine-rewritten. */
export function studyT(
  key: keyof typeof fa,
  values: Record<string, string | number> = {},
) {
  const language = currentLanguage() === "en" ? "en" : "fa",
    messages = language === "en" ? en : fa;
  return formatDigits(
    messages[key].replace(/\{(\w+)\}/g, (match, name) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    ),
    language,
  );
}
export const studyDirection = () =>
  currentLanguage() === "en" ? "ltr" : "rtl";
