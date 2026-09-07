import assert from "node:assert/strict"
import test from "node:test"
import {
  emptyAttention,
  isVisibleNormalWindow,
  observeVisibleTab,
  removeTab
} from "../src/core/attention.ts"

test("previous means the distinct tab viewed before current", () => {
  const first = observeVisibleTab(emptyAttention, 10)
  const second = observeVisibleTab(first, 20)

  assert.deepEqual(second, { currentTabId: 20, previousTabId: 10 })
})

test("re-observing current is a no-op and retains previous", () => {
  const state = { currentTabId: 20, previousTabId: 10 }
  assert.strictEqual(observeVisibleTab(state, 20), state)
})

test("attention can move across window tab ids without inventing per-window history", () => {
  const state = observeVisibleTab(
    observeVisibleTab(observeVisibleTab(emptyAttention, 10), 20),
    31
  )
  assert.deepEqual(state, { currentTabId: 31, previousTabId: 20 })
})

test("activation in an unfocused normal window is not treated as viewed", () => {
  assert.equal(isVisibleNormalWindow({ focused: false, incognito: false, type: "normal" }), false)
  assert.equal(isVisibleNormalWindow({ focused: true, incognito: false, type: "normal" }), true)
  assert.equal(isVisibleNormalWindow({ focused: true, incognito: true, type: "normal" }), false)
})

test("removed current or previous ids are cleared, never substituted", () => {
  const state = { currentTabId: 20, previousTabId: 10 }
  assert.deepEqual(removeTab(state, 10), { currentTabId: 20, previousTabId: null })
  assert.deepEqual(removeTab(state, 20), { currentTabId: null, previousTabId: 10 })
})
