import { Context, Effect } from "effect"

export interface TabRecord {
  readonly id: number
  readonly windowId: number
  readonly title: string
  readonly url: string
  readonly favIconUrl?: string
  readonly active: boolean
  readonly lastAccessed?: number
}

export interface AttentionSnapshot {
  readonly currentTabId: number | null
  readonly previousTabId: number | null
  readonly historyAvailable: boolean
}

export class ChromeBoundaryError extends Error {
  readonly _tag = "ChromeBoundaryError"
  readonly operation: string
  readonly detail: string

  constructor(operation: string, detail: string, options?: ErrorOptions) {
    super(`${operation}: ${detail}`, options)
    this.name = "ChromeBoundaryError"
    this.operation = operation
    this.detail = detail
  }
}

export interface ChromeTabsService {
  readonly list: Effect.Effect<readonly TabRecord[], ChromeBoundaryError>
  readonly attention: Effect.Effect<AttentionSnapshot, ChromeBoundaryError>
  readonly commandShortcut: Effect.Effect<string, ChromeBoundaryError>
  readonly activate: (
    tabId: number,
    windowId: number
  ) => Effect.Effect<void, ChromeBoundaryError>
}

export const ChromeTabs = Context.GenericTag<ChromeTabsService>(
  "peek-experiment/ChromeTabs"
)
