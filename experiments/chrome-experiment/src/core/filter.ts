import type { TabRecord } from "../browser/tabs.ts"

/**
 * Experiment-only transparent filter: every space-separated token must occur
 * literally (case-insensitive) somewhere in title + URL. This is not Peek's
 * prospective forgiving matcher or final ranking.
 */
export function filterTabs(tabs: readonly TabRecord[], query: string): TabRecord[] {
  const tokens = query.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean)
  if (tokens.length === 0) return [...tabs]

  return tabs.filter((tab) => {
    const haystack = `${tab.title} ${tab.url}`.toLocaleLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
}

export function orderForEmptyQuery(
  tabs: readonly TabRecord[],
  previousTabId: number | null
): TabRecord[] {
  return [...tabs].sort((left, right) => {
    if (left.id === previousTabId) return -1
    if (right.id === previousTabId) return 1
    return (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0)
  })
}
