import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const unpacked = path.join(root, "dist", "unpacked")
const manifest = JSON.parse(await readFile(path.join(unpacked, "manifest.json"), "utf8"))

assert.equal(manifest.manifest_version, 3)
assert.equal(manifest.incognito, "not_allowed")
assert.deepEqual(manifest.permissions, ["tabs", "storage"])
assert.equal(manifest.host_permissions, undefined)
assert.equal(manifest.content_scripts, undefined)
assert.equal(manifest.options_page, undefined)
assert.equal(manifest.options_ui, undefined)
assert.equal(manifest.background.service_worker, "background.js")
assert.equal(manifest.action.default_popup, "popup.html")
assert.equal(manifest.commands._execute_action.suggested_key.mac, "Alt+Space")

for (const file of ["background.js", "popup.js", "popup.html", "popup.css"]) {
  await access(path.join(unpacked, file))
}

const scripts = `${await readFile(path.join(unpacked, "background.js"), "utf8")}\n${await readFile(path.join(unpacked, "popup.js"), "utf8")}`
assert.doesNotMatch(scripts, /new Function\s*\(|globalThis\.eval\s*\(|\(0,\s*eval\)\s*\(/u)
assert.equal(manifest.content_security_policy, undefined)
console.log("Manifest and unpacked output match the bounded experiment contract.")
