import assert from "node:assert/strict"
import test from "node:test"
import { initialInteraction, reduceInteraction } from "../src/core/interaction.ts"

test("Tab mode round-trip preserves exact query and caret", () => {
  const queried = reduceInteraction(initialInteraction, { type: "query", value: "github 880" })
  const selection = reduceInteraction(queried, {
    type: "toggle-mode",
    caretStart: 6,
    caretEnd: 9
  })
  const typing = reduceInteraction(selection, { type: "toggle-mode" })

  assert.equal(selection.mode, "selection")
  assert.deepEqual(
    { query: typing.query, caretStart: typing.caretStart, caretEnd: typing.caretEnd },
    { query: "github 880", caretStart: 6, caretEnd: 9 }
  )
})

test("movement clamps to visible result bounds", () => {
  const atTop = reduceInteraction(initialInteraction, { type: "move", delta: -1, count: 3 })
  const one = reduceInteraction(atTop, { type: "move", delta: 1, count: 3 })
  const two = reduceInteraction(one, { type: "move", delta: 1, count: 3 })
  const stillTwo = reduceInteraction(two, { type: "move", delta: 1, count: 3 })

  assert.equal(atTop.selectedIndex, 0)
  assert.equal(stillTwo.selectedIndex, 2)
})

test("query changes reset highlight but do not activate anything", () => {
  const moved = reduceInteraction(initialInteraction, { type: "move", delta: 1, count: 3 })
  const queried = reduceInteraction(moved, { type: "query", value: "orion" })

  assert.equal(queried.selectedIndex, 0)
  assert.equal(queried.query, "orion")
})
