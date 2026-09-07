import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const manifest = JSON.parse(await readFile("dist/unpacked/manifest.json", "utf8"))
const commands = manifest.commands ?? {}

assert.ok(
  commands._execute_action,
  "keyboard invocation must use Chromium's reserved _execute_action path so it follows the same action event as the working icon click"
)
assert.equal(
  commands["toggle-overlay"],
  undefined,
  "do not keep a divergent custom onCommand injection path"
)
assert.equal(commands._execute_action.suggested_key.mac, "MacCtrl+Space")
assert.equal(manifest.action.default_popup, undefined)
console.log("PASS keyboard shortcut and icon click share the no-popup action invocation path")
