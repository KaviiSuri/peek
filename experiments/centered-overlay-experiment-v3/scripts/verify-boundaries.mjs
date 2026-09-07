import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const unpacked = path.join(root, "dist", "unpacked")
const manifest = JSON.parse(await readFile(path.join(unpacked, "manifest.json"), "utf8"))
const overlaySource = await readFile(path.join(root, "src", "overlay.ts"), "utf8")
const backgroundSource = await readFile(path.join(root, "src", "background.ts"), "utf8")
const browserSource = await readFile(path.join(root, "src", "browser", "chrome-tabs-live.ts"), "utf8")

assert.equal(manifest.manifest_version, 3)
assert.equal(manifest.incognito, "not_allowed")
assert.deepEqual(manifest.permissions, ["tabs", "activeTab", "scripting", "storage"])
assert.equal(manifest.host_permissions, undefined)
assert.equal(manifest.content_scripts, undefined)
assert.equal(manifest.action.default_popup, undefined)
assert.equal(manifest.options_page, "diagnostics.html")
assert.equal(manifest.options_ui, undefined)
assert.equal(manifest.commands._execute_action.suggested_key.default, "Ctrl+Space")
assert.equal(manifest.commands._execute_action.suggested_key.mac, "MacCtrl+Space")
assert.equal(manifest.commands["toggle-overlay"], undefined)
assert.equal(manifest.background.service_worker, "background.js")

for (const file of ["manifest.json", "background.js", "overlay.js", "diagnostics.html", "diagnostics.js"]) {
  await access(path.join(unpacked, file))
}

for (const forbidden of [
  /host_permissions/u,
  /innerHTML/u,
  /outerHTML/u,
  /innerText/u,
  /document\.title/u,
  /document\.body/u,
  /querySelector(?:All)?\s*\(/u,
  /getSelection\s*\(/u,
  /MutationObserver/u,
  /createTreeWalker/u,
  /createNodeIterator/u,
  /XPathEvaluator/u,
  /\bfetch\s*\(/u,
  /XMLHttpRequest/u,
  /WebSocket/u
]) {
  assert.doesNotMatch(overlaySource, forbidden)
}
assert.match(overlaySource, /attachShadow\(\{ mode: "closed" \}\)/u)
assert.match(overlaySource, /\.textContent = tab\.title/u)
assert.match(browserSource, /world: "ISOLATED"/u)
assert.match(browserSource, /files: \["overlay\.js"\]/u)
assert.doesNotMatch(browserSource, /allFrames/u)
assert.doesNotMatch(backgroundSource, /chrome\.scripting\.executeScript/u)
assert.doesNotMatch(backgroundSource, /chrome\.commands\.onCommand/u)
const invokeSource = backgroundSource.slice(
  backgroundSource.indexOf("function invoke"),
  backgroundSource.indexOf("async function modelFor")
)
assert.doesNotMatch(invokeSource, /await clearDiagnostic|chrome\.tabs\.query/u)

const builtScripts = ["background.js", "overlay.js", "diagnostics.js"]
  .map(async (file) => readFile(path.join(unpacked, file), "utf8"))
const joinedBuiltScripts = (await Promise.all(builtScripts)).join("\n")
assert.doesNotMatch(joinedBuiltScripts, /new Function\s*\(|globalThis\.eval\s*\(|\(0,\s*eval\)\s*\(/u)
assert.doesNotMatch(`${backgroundSource}\n${overlaySource}`, /setInterval\s*\(|chrome\.alarms|onStartup|onInstalled/u)
assert.equal(manifest.permissions.includes("alarms"), false)
console.log("Manifest, physical Mac Control mapping, injection scope, bounded diagnostics, and no-content-read boundaries verified.")
