import assert from "node:assert/strict"
import test from "node:test"
import { filterTabs, orderForEmptyQuery } from "../src/core/filter.ts"
import type { TabRecord } from "../src/browser/tabs.ts"

const tabs: TabRecord[] = [
  { id: 1, windowId: 1, title: "Retry policy", url: "https://github.com/acme/orion/issues/8", active: false, lastAccessed: 10 },
  { id: 2, windowId: 1, title: "Orion home", url: "https://github.com/acme/orion", active: true, lastAccessed: 30 },
  { id: 3, windowId: 2, title: "Atlas", url: "https://example.test/retry", active: true, lastAccessed: 20 }
]

test("empty-query experiment ordering puts observed previous first", () => {
  assert.deepEqual(orderForEmptyQuery(tabs, 1).map((tab) => tab.id), [1, 2, 3])
})

test("transparent filter requires every literal token across title and URL", () => {
  assert.deepEqual(filterTabs(tabs, "orion retry").map((tab) => tab.id), [1])
  assert.deepEqual(filterTabs(tabs, "outage"), [])
})
