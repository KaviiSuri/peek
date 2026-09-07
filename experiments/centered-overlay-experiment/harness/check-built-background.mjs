import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import path from "node:path"

class FakeEvent {
  listeners = []
  addListener(listener) { this.listeners.push(listener) }
  removeListener(listener) {
    this.listeners = this.listeners.filter((candidate) => candidate !== listener)
  }
}

const events = {
  action: new FakeEvent(),
  activated: new FakeEvent(),
  focused: new FakeEvent(),
  removed: new FakeEvent(),
  message: new FakeEvent()
}
const calls = []
const session = {}
const activeTab = {
  id: 41,
  windowId: 7,
  title: "Fixture page",
  url: "https://fixture.test/",
  active: true,
  incognito: false
}

globalThis.chrome = {
  commands: { onCommand: new FakeEvent() },
  action: {
    onClicked: events.action,
    setBadgeText: async (value) => { calls.push(["badge", value]) },
    setBadgeBackgroundColor: async (value) => { calls.push(["badge-color", value]) },
    setTitle: async (value) => { calls.push(["title", value]) }
  },
  scripting: {
    executeScript: async (value) => { calls.push(["inject", value]); return [] }
  },
  storage: {
    session: {
      get: async (key) => ({ [key]: session[key] }),
      set: async (value) => { Object.assign(session, value) }
    }
  },
  tabs: {
    onActivated: events.activated,
    onRemoved: events.removed,
    query: async () => [activeTab],
    get: async () => activeTab,
    update: async (tabId, value) => { calls.push(["activate", { tabId, value }]); return activeTab },
    sendMessage: async (tabId, value) => { calls.push(["teardown", { tabId, value }]); return { ok: true } }
  },
  windows: {
    WINDOW_ID_NONE: -1,
    onFocusChanged: events.focused,
    get: async () => ({ id: 7, type: "normal", focused: true, incognito: false }),
    getAll: async () => [{ id: 7, type: "normal", focused: true, incognito: false, tabs: [activeTab] }],
    getLastFocused: async () => ({ id: 7, type: "normal", focused: true, incognito: false }),
    update: async (windowId, value) => { calls.push(["focus-window", { windowId, value }]); return {} }
  },
  runtime: { onMessage: events.message }
}

const builtWorker = path.resolve("dist/unpacked/background.js")
await import(`${pathToFileURL(builtWorker).href}?harness=${Date.now()}`)

assert.deepEqual(
  Object.values(events).map((event) => event.listeners.length),
  [1, 1, 1, 1, 1],
  "built worker must synchronously register all five listener families"
)

events.action.listeners[0](activeTab)
const deadline = Date.now() + 1500
while (!calls.some(([name]) => name === "inject") && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 10))
}

const injection = calls.find(([name]) => name === "inject")
assert.ok(injection, "built command path must reach chrome.scripting.executeScript")
assert.deepEqual(injection[1], {
  target: { tabId: 41 },
  files: ["overlay.js"],
  world: "ISOLATED",
  injectImmediately: true
})
assert.equal(calls.some(([name]) => name === "activate"), false)
console.log("PASS built worker loaded, wired synchronously, and action path reached one top-frame overlay injection")
