import { Effect } from "effect"
import {
  ChromeTabs,
  type ChromeBoundaryError,
  type ChromeTabsService,
  type TabRecord
} from "../browser/tabs.ts"

export type SelectionOutcome = "activated" | "current-no-op"

/** Highlighting never calls this. Only an explicit Enter, number, or click does. */
export function selectTab(
  tab: TabRecord,
  currentTabId: number | null
): Effect.Effect<SelectionOutcome, ChromeBoundaryError, ChromeTabsService> {
  if (tab.id === currentTabId) return Effect.succeed("current-no-op")

  return Effect.gen(function* () {
    const chromeTabs = yield* ChromeTabs
    yield* chromeTabs.activate(tab.id, tab.windowId)
    return "activated" as const
  })
}
