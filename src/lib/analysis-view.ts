import type { AnalysisTab } from './analysis'

const KEY = 'quran.analysis-view.v1'
const tabs: AnalysisTab[] = ['root', 'form', 'word', 'verse', 'context']
export type AnalysisView = { tab?: AnalysisTab; minimized?: boolean; scroll?: Partial<Record<AnalysisTab, number>> }
export function readAnalysisView(): AnalysisView {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const scroll: AnalysisView['scroll'] = {}
    for (const tab of tabs) if (Number.isFinite(value?.scroll?.[tab]) && value.scroll[tab] >= 0) scroll[tab] = value.scroll[tab]
    return { tab: tabs.includes(value?.tab) ? value.tab : undefined, minimized: value?.minimized === true, scroll }
  } catch { return {} }
}
export function saveAnalysisView(patch: AnalysisView) {
  try { const previous = readAnalysisView(); localStorage.setItem(KEY, JSON.stringify({ ...previous, ...patch, scroll: { ...previous.scroll, ...patch.scroll } })) } catch { /* Reading still works without browser storage. */ }
}
