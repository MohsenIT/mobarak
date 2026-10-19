'use client'

import { quranDisplayText } from '@/lib/quran-display'

/** Apply font compatibility at display time; the bundled Quran text stays verbatim. */
export default function QuranText({ text }: { text: string }) {
  return <>{quranDisplayText(text)}</>
}
