import assert from "node:assert/strict"
import test from "node:test"
import { Effect } from "effect"
import {
  makeBrowserTabsService,
  type ChromeApi
} from "../src/browser/chrome-tabs-live.ts"

function fakeApi(overrides: Partial<ChromeApi> = {}): { api: ChromeApi; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    api: {
      getAllNormalWindows: async () => [],
      getTab: async (tabId) => ({ id: tabId, windowId: 4, incognito: false } as chrome.tabs.Tab),
      getWindow: async (windowId) =>
        ({ id: windowId, type: "normal", incognito: false } as chrome.windows.Window),
      activateTab: async (tabId) => { calls.push(`activate:${tabId}`) },
      focusWindow: async (windowId) => { calls.push(`focus:${windowId}`) },
      injectOverlay: async (tabId) => { calls.push(`inject:${tabId}`) },
      requestTeardown: async (tabId) => { calls.push(`teardown:${tabId}`) },
      ...overrides
    }
  }
}

test("overlay injection is explicit and targets one top-level tab adapter call", async () => {
  const fake = fakeApi()
  await Effect.runPromise(makeBrowserTabsService(fake.api).injectOverlay(12))
  assert.deepEqual(fake.calls, ["inject:12"])
})

test("explicit commit validates, tears down, activates tab, then focuses window", async () => {
  const fake = fakeApi()
  const outcome = await Effect.runPromise(
    makeBrowserTabsService(fake.api).commit(11, 22, 4)
  )
  assert.equal(outcome, "activated")
  assert.deepEqual(fake.calls, ["teardown:11", "activate:22", "focus:4"])
})

test("current-tab no-op tears down but retains history by making no activation call", async () => {
  const fake = fakeApi({
    getTab: async () => ({ id: 11, windowId: 4, incognito: false } as chrome.tabs.Tab)
  })
  const outcome = await Effect.runPromise(
    makeBrowserTabsService(fake.api).commit(11, 11, 4)
  )
  assert.equal(outcome, "current-no-op")
  assert.deepEqual(fake.calls, ["teardown:11"])
})

test("vanished target fails before teardown and cannot activate another tab", async () => {
  const fake = fakeApi({ getTab: async () => { throw new Error("No tab with id 22") } })
  const exit = await Effect.runPromiseExit(
    makeBrowserTabsService(fake.api).commit(11, 22, 4)
  )
  assert.equal(exit._tag, "Failure")
  assert.deepEqual(fake.calls, [])
})

test("listing excludes incognito windows", async () => {
  const normalTab = {
    id: 1,
    windowId: 1,
    title: "Orion",
    url: "https://github.com/acme/orion",
    active: true,
    incognito: false
  } as chrome.tabs.Tab
  const privateTab = {
    id: 2,
    windowId: 2,
    title: "Private",
    url: "https://example.test/private",
    active: true,
    incognito: true
  } as chrome.tabs.Tab
  const fake = fakeApi({
    getAllNormalWindows: async () => [
      { id: 1, type: "normal", incognito: false, tabs: [normalTab] } as chrome.windows.Window,
      { id: 2, type: "normal", incognito: true, tabs: [privateTab] } as chrome.windows.Window
    ]
  })
  const tabs = await Effect.runPromise(makeBrowserTabsService(fake.api).list)
  assert.deepEqual(tabs.map((tab) => tab.id), [1])
})
