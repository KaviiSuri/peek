import { Context, Effect } from "effect"

export interface TabRecord {
  readonly id: number
  readonly windowId: number
  readonly title: string
  readonly url: string
  readonly active: boolean
  readonly lastAccessed?: number
}

export interface OverlayModel {
  readonly tabs: readonly TabRecord[]
  readonly currentTabId: number
  readonly previousTabId: number | null
  readonly historyAvailable: boolean
}

export type SelectionOutcome = "activated" | "current-no-op"

export class BrowserBoundaryError extends Error {
  readonly _tag = "BrowserBoundaryError"
  readonly operation: string
  readonly detail: string

  constructor(operation: string, detail: string, options?: ErrorOptions) {
    super(`${operation}: ${detail}`, options)
    this.name = "BrowserBoundaryError"
    this.operation = operation
    this.detail = detail
  }
}

export interface BrowserTabsService {
  readonly list: Effect.Effect<readonly TabRecord[], BrowserBoundaryError>
  readonly injectOverlay: (tabId: number) => Effect.Effect<void, BrowserBoundaryError>
  readonly commit: (
    sourceTabId: number,
    targetTabId: number,
    targetWindowId: number
  ) => Effect.Effect<SelectionOutcome, BrowserBoundaryError>
}

export const BrowserTabs = Context.GenericTag<BrowserTabsService>(
  "peek-centered-overlay/BrowserTabs"
)
