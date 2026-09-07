export interface AttentionState {
  readonly currentTabId: number | null
  readonly previousTabId: number | null
}

export const emptyAttention: AttentionState = {
  currentTabId: null,
  previousTabId: null
}

/** Record a tab that became visible to the user. Re-observing current is a no-op. */
export function observeVisibleTab(
  state: AttentionState,
  tabId: number
): AttentionState {
  if (state.currentTabId === tabId) return state

  return {
    currentTabId: tabId,
    previousTabId: state.currentTabId
  }
}

export function removeTab(
  state: AttentionState,
  tabId: number
): AttentionState {
  return {
    currentTabId: state.currentTabId === tabId ? null : state.currentTabId,
    previousTabId: state.previousTabId === tabId ? null : state.previousTabId
  }
}

export interface WindowAttentionFacts {
  readonly focused: boolean
  readonly incognito: boolean
  readonly type?: string | undefined
}

export function isVisibleNormalWindow(window: WindowAttentionFacts): boolean {
  return window.focused && !window.incognito && window.type === "normal"
}

export function isAttentionState(value: unknown): value is AttentionState {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  const isTabId = (candidate: unknown) =>
    candidate === null || (typeof candidate === "number" && Number.isInteger(candidate))

  return isTabId(record.currentTabId) && isTabId(record.previousTabId)
}
