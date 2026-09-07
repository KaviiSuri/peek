import assert from "node:assert/strict"
import test from "node:test"
import { isOverlayRequest } from "../src/protocol.ts"

test("commit messages require integer tab and window identity", () => {
  assert.equal(isOverlayRequest({
    type: "peek-centered-overlay:commit",
    targetTabId: 3,
    targetWindowId: 2
  }), true)
  assert.equal(isOverlayRequest({
    type: "peek-centered-overlay:commit",
    targetTabId: "3",
    targetWindowId: 2
  }), false)
  assert.equal(isOverlayRequest({ type: "peek-centered-overlay:commit" }), false)
})
