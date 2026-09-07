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

const sendOverlayMessage = (message) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`message timeout: ${message.type}`)), 1500)
  events.message.listeners[0](message, { tab: activeTab }, (response) => {
    clearTimeout(timeout)
    resolve(response)
  })
})
const overlayMarker = (marker, sequence, nowMs) => ({
  context: "overlay",
  marker,
  sequence,
  timeOriginMs: 1000,
  nowMs,
  comparableEpochMs: 1000 + nowMs,
  secretUrl: "https://must-not-persist.test/"
})
const modelResponse = await sendOverlayMessage({
  type: "peek-centered-overlay:get-model",
  timeline: [
    overlayMarker("overlay-entry", 0, 1),
    overlayMarker("host-append", 1, 2),
    overlayMarker("model-request", 2, 3)
  ]
})
assert.equal(modelResponse.ok, true)
assert.equal(typeof modelResponse.instrumentationRunId, "string")
await sendOverlayMessage({
  type: "peek-centered-overlay:timeline",
  runId: modelResponse.instrumentationRunId,
  timeline: [
    overlayMarker("model-response", 3, 4),
    overlayMarker("focus", 4, 5),
    overlayMarker("raf-1", 5, 6),
    overlayMarker("raf-2", 6, 7)
  ]
})
const timelineDeadline = Date.now() + 1500
while (
  (session["peek-centered-overlay:timeline-v3"]?.runs.at(-1)?.markers.length ?? 0) < 10 &&
  Date.now() < timelineDeadline
) {
  await new Promise((resolve) => setTimeout(resolve, 10))
}
const timeline = session["peek-centered-overlay:timeline-v3"]
assert.ok(timeline, "bounded session timeline must persist")
const run = timeline.runs.at(-1)
assert.deepEqual(run.markers.filter(({ context }) => context === "worker").map(({ marker }) => marker), [
  "action-entry", "execute-script-start", "execute-script-end"
])
assert.deepEqual(run.markers.filter(({ context }) => context === "overlay").map(({ marker }) => marker), [
  "overlay-entry", "host-append", "model-request", "model-response", "focus", "raf-1", "raf-2"
])
assert.doesNotMatch(JSON.stringify(timeline), /must-not-persist|secretUrl/u)
console.log("PASS built worker action path, bounded timeline, correlation, and privacy allow-list")
