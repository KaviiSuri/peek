import assert from "node:assert/strict"
import test from "node:test"
import { idempotentTeardown, toggleSingleHost } from "../src/overlay/lifecycle.ts"

test("first invocation mounts exactly one host", () => {
  let mounts = 0
  let removals = 0
  const outcome = toggleSingleHost({
    hasExistingHost: () => false,
    signalExistingHostToRemove: () => { removals += 1 },
    mountNewHost: () => { mounts += 1 }
  })
  assert.equal(outcome, "mounted")
  assert.deepEqual({ mounts, removals }, { mounts: 1, removals: 0 })
})

test("repeat invocation removes existing host and never mounts a duplicate", () => {
  let mounts = 0
  let removals = 0
  const outcome = toggleSingleHost({
    hasExistingHost: () => true,
    signalExistingHostToRemove: () => { removals += 1 },
    mountNewHost: () => { mounts += 1 }
  })
  assert.equal(outcome, "removed-existing")
  assert.deepEqual({ mounts, removals }, { mounts: 0, removals: 1 })
})

test("teardown removes listeners/host only once", () => {
  const calls: string[] = []
  const teardown = idempotentTeardown([
    () => calls.push("listener"),
    () => calls.push("host"),
    () => calls.push("focus")
  ])
  teardown()
  teardown()
  assert.deepEqual(calls, ["listener", "host", "focus"])
})
