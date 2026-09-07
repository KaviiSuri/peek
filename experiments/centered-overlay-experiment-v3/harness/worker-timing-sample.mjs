import { performance } from "node:perf_hooks"
import { pathToFileURL } from "node:url"
import path from "node:path"

class FakeEvent {
  listeners = []
  addListener(listener) { this.listeners.push(listener) }
  removeListener(listener) { this.listeners = this.listeners.filter((item) => item !== listener) }
}
const events = {
  action: new FakeEvent(), activated: new FakeEvent(), focused: new FakeEvent(),
  removed: new FakeEvent(), message: new FakeEvent()
}
const activeTab = { id: 41, windowId: 7, title: "Fixture", url: "https://fixture.test/", active: true, incognito: false }
let injectionResolver
let dispatchAt = 0
const latencies = []
const modelRoundtrips = []
globalThis.chrome = {
  action: {
    onClicked: events.action,
    setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {}
  },
  scripting: {
    executeScript: async () => {
      latencies.push(performance.now() - dispatchAt)
      injectionResolver?.()
      return []
    }
  },
  storage: { session: { get: async () => ({}), set: async () => {} } },
  tabs: {
    onActivated: events.activated, onRemoved: events.removed,
    query: async () => [activeTab], get: async () => activeTab,
    update: async () => activeTab, sendMessage: async () => ({ ok: true })
  },
  windows: {
    WINDOW_ID_NONE: -1, onFocusChanged: events.focused,
    get: async () => ({ id: 7, type: "normal", focused: true, incognito: false }),
    getAll: async () => [{ id: 7, type: "normal", focused: true, incognito: false, tabs: [activeTab] }],
    getLastFocused: async () => ({ id: 7, type: "normal", focused: true, incognito: false }),
    update: async () => ({})
  },
  runtime: { onMessage: events.message }
}
const importStart = performance.now()
await import(`${pathToFileURL(path.resolve("dist/unpacked/background.js")).href}?sample=${process.pid}`)
const importMs = performance.now() - importStart
async function invoke() {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("injection timeout")), 1500)
    injectionResolver = () => { clearTimeout(timeout); resolve() }
    dispatchAt = performance.now()
    events.action.listeners[0](activeTab)
  })
}
async function getModel() {
  const start = performance.now()
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("model timeout")), 1500)
    events.message.listeners[0](
      { type: "peek-centered-overlay:get-model" },
      { tab: activeTab },
      () => { clearTimeout(timeout); resolve() }
    )
  })
  modelRoundtrips.push(performance.now() - start)
}
await invoke()
await getModel()
await invoke()
await getModel()
process.stdout.write(JSON.stringify({
  importMs,
  firstActionToExecuteScriptMs: latencies[0],
  secondActionToExecuteScriptMs: latencies[1],
  firstModelRoundtripMs: modelRoundtrips[0],
  secondModelRoundtripMs: modelRoundtrips[1]
}))
