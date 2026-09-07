import type { OverlayModel, TabRecord } from "./browser/tabs.ts"
import { filterTabs, orderForEmptyQuery } from "./core/filter.ts"
import {
  initialInteraction,
  reduceInteraction,
  type InteractionState
} from "./core/interaction.ts"
import { idempotentTeardown, toggleSingleHost } from "./overlay/lifecycle.ts"
import type { OverlayResponse, WorkerRequest } from "./protocol.ts"

const hostId = "peek-centered-overlay-experiment-host"
const toggleEventName = "peek-centered-overlay-experiment:toggle"
let host: HTMLElement | null = null

const toggleOutcome = toggleSingleHost({
  hasExistingHost: () => document.getElementById(hostId) !== null,
  signalExistingHostToRemove: () =>
    document.dispatchEvent(new CustomEvent(toggleEventName)),
  mountNewHost: () => {
    host = document.createElement("div")
    host.id = hostId
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;display:block;"
    document.documentElement.append(host)
  }
})

if (toggleOutcome === "mounted" && host !== null) {
  const mountedHost: HTMLElement = host
  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  const shadow = mountedHost.attachShadow({ mode: "closed" })
  const style = document.createElement("style")
  style.textContent = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    .backdrop {
      position: fixed; inset: 0; display: grid; place-items: center;
      padding: 24px; background: rgb(8 10 14 / 26%);
      color-scheme: light dark;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .panel {
      width: min(680px, calc(100vw - 48px)); max-height: min(620px, calc(100vh - 48px));
      overflow: hidden; border: 1px solid rgb(128 128 128 / 25%); border-radius: 14px;
      background: #f9f9fa; color: #17181a; box-shadow: 0 24px 80px rgb(0 0 0 / 34%);
    }
    .head { display: flex; align-items: center; gap: 10px; padding: 13px 14px 8px; }
    .mark { font-size: 11px; font-weight: 720; letter-spacing: .08em; color: #777; }
    .hint { margin-left: auto; font-size: 11px; color: #777; }
    .hint:empty { display: none; }
    input {
      display: block; width: calc(100% - 28px); margin: 0 14px 8px; padding: 11px 12px;
      border: 1px solid rgb(80 80 90 / 24%); border-radius: 9px; outline: none;
      background: #fff; color: #17181a; font: 14px/1.35 inherit;
    }
    input:focus { border-color: #6c7ee1; box-shadow: 0 0 0 3px rgb(108 126 225 / 18%); }
    .note { margin: 0 16px 9px; color: #777; font-size: 10px; }
    ol { list-style: none; max-height: 430px; overflow: auto; margin: 0; padding: 0 10px 10px; }
    li { margin: 0; padding: 0; border-radius: 8px; }
    li.selected { background: #e8ebfb; outline: 1px solid rgb(108 126 225 / 34%); }
    button {
      appearance: none; display: grid; grid-template-columns: 24px minmax(0, 1fr) auto;
      gap: 10px; align-items: center; width: 100%; padding: 9px 10px; border: 0;
      background: transparent; color: inherit; text-align: left; font: inherit; cursor: default;
    }
    .icon { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 5px;
      background: #e2e4ea; color: #666; font-size: 9px; font-weight: 700; }
    .copy { min-width: 0; }
    .title, .url { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .title { font-size: 13px; font-weight: 640; }
    .url { margin-top: 2px; color: #76777c; font-size: 11px; }
    kbd { min-width: 22px; padding: 2px 5px; border: 1px solid rgb(100 100 110 / 25%);
      border-radius: 4px; color: #777; font: 10px/1.3 inherit; text-align: center; }
    kbd:empty { visibility: hidden; }
    .status { min-height: 18px; margin: 0; padding: 0 16px 11px; color: #777; font-size: 11px; }
    .status.error { color: #b52626; }
    @media (prefers-color-scheme: dark) {
      .backdrop { background: rgb(0 0 0 / 42%); }
      .panel { background: #202126; color: #f4f4f5; border-color: rgb(255 255 255 / 14%); }
      input { background: #292a30; color: #f4f4f5; border-color: rgb(255 255 255 / 16%); }
      li.selected { background: #343a59; }
      .icon { background: #393a42; color: #bbb; }
      .note, .hint, .mark, .url, .status, kbd { color: #aaa; }
    }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
  `

  const backdrop = document.createElement("div")
  backdrop.className = "backdrop"
  const panel = document.createElement("section")
  panel.className = "panel"
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-modal", "true")
  panel.setAttribute("aria-label", "Peek centred overlay experiment")

  const head = document.createElement("div")
  head.className = "head"
  const mark = document.createElement("span")
  mark.className = "mark"
  mark.textContent = "PEEK · TEST VEHICLE"
  const hint = document.createElement("span")
  hint.className = "hint"
  head.append(mark, hint)

  const input = document.createElement("input")
  input.type = "text"
  input.autocomplete = "off"
  input.spellcheck = false
  input.placeholder = "Filter title + URL"
  input.setAttribute("aria-label", "Filter open tabs")

  const note = document.createElement("p")
  note.className = "note"
  note.textContent = "Literal all-token filter for this test only — not final search."
  const results = document.createElement("ol")
  results.setAttribute("aria-label", "Open tabs")
  const status = document.createElement("p")
  status.className = "status"
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")
  status.textContent = "Reading eligible normal-window tab metadata…"

  panel.append(head, input, note, results, status)
  backdrop.append(panel)
  shadow.append(style, backdrop)

  let interaction: InteractionState = initialInteraction
  let model: OverlayModel | null = null
  let shownTabs: readonly TabRecord[] = []
  let restorePageFocus = true

  const setStatus = (message: string, error = false) => {
    status.textContent = message
    status.classList.toggle("error", error)
  }

  const onToggle = () => finish(true)
  const onPageHide = () => finish(false)
  const onWorkerMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean | undefined => {
    if (
      typeof message !== "object" ||
      message === null ||
      (message as WorkerRequest).type !== "peek-centered-overlay:teardown"
    ) return undefined
    sendResponse({ ok: true })
    finish(false)
    return false
  }

  const teardown = idempotentTeardown([
    () => document.removeEventListener(toggleEventName, onToggle),
    () => document.removeEventListener("keydown", onKeyDown, true),
    () => window.removeEventListener("pagehide", onPageHide),
    () => chrome.runtime.onMessage.removeListener(onWorkerMessage),
    () => mountedHost.remove(),
    () => {
      if (restorePageFocus && previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  ])

  function finish(restoreFocus: boolean): void {
    restorePageFocus = restoreFocus
    teardown()
    void chrome.runtime.sendMessage({ type: "peek-centered-overlay:removed" })
  }

  function describeUrl(raw: string): string {
    try {
      const url = new URL(raw)
      return `${url.hostname}${url.pathname}${url.search}`
    } catch {
      return raw
    }
  }

  function render(): void {
    if (model === null) return
    const source = interaction.query.trim()
      ? model.tabs
      : orderForEmptyQuery(model.tabs, model.previousTabId)
    shownTabs = filterTabs(source, interaction.query)
    interaction = reduceInteraction(interaction, {
      type: "reconcile",
      count: shownTabs.length
    })
    hint.textContent = interaction.mode === "selection" ? "selection · j/k · 1–9" : ""
    results.replaceChildren()

    shownTabs.forEach((tab, index) => {
      const row = document.createElement("li")
      row.classList.toggle("selected", index === interaction.selectedIndex)
      row.setAttribute("aria-current", index === interaction.selectedIndex ? "true" : "false")
      const button = document.createElement("button")
      button.type = "button"
      button.addEventListener("click", () => void commit(tab))

      const icon = document.createElement("span")
      icon.className = "icon"
      icon.textContent = (tab.title.trim()[0] || "•").toLocaleUpperCase()
      const copy = document.createElement("span")
      copy.className = "copy"
      const title = document.createElement("span")
      title.className = "title"
      title.textContent = tab.title
      const url = document.createElement("span")
      url.className = "url"
      url.textContent = describeUrl(tab.url)
      copy.append(title, url)
      const key = document.createElement("kbd")
      key.textContent = interaction.mode === "selection" && index < 9 ? String(index + 1) : ""
      button.append(icon, copy, key)
      row.append(button)
      results.append(row)
    })

    setStatus(
      `${shownTabs.length} eligible tab${shownTabs.length === 1 ? "" : "s"} · ${interaction.mode} mode`
    )
  }

  async function commit(tab: TabRecord): Promise<void> {
    setStatus("Selecting explicit target…")
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "peek-centered-overlay:commit",
        targetTabId: tab.id,
        targetWindowId: tab.windowId
      })) as OverlayResponse
      if (!response.ok) throw new Error(response.error)
      // The worker requests teardown before activation; a success response may arrive after removal.
    } catch (cause) {
      setStatus(
        `Selection failed without activating another tab: ${cause instanceof Error ? cause.message : String(cause)}`,
        true
      )
    }
  }

  function move(delta: -1 | 1): void {
    interaction = reduceInteraction(interaction, {
      type: "move",
      delta,
      count: shownTabs.length
    })
    render()
  }

  function toggleMode(): void {
    interaction = reduceInteraction(interaction, {
      type: "toggle-mode",
      caretStart: input.selectionStart ?? interaction.query.length,
      caretEnd: input.selectionEnd ?? interaction.query.length
    })
    if (interaction.mode === "selection") {
      input.blur()
    } else {
      input.focus({ preventScroll: true })
      input.setSelectionRange(interaction.caretStart, interaction.caretEnd)
    }
    render()
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      finish(true)
      return
    }
    if (event.isComposing) return
    const modified = event.altKey || event.ctrlKey || event.metaKey
    if (modified) return

    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      toggleMode()
      return
    }
    if (event.key === "ArrowDown" || (interaction.mode === "selection" && event.key === "j")) {
      event.preventDefault()
      event.stopPropagation()
      move(1)
      return
    }
    if (event.key === "ArrowUp" || (interaction.mode === "selection" && event.key === "k")) {
      event.preventDefault()
      event.stopPropagation()
      move(-1)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      const selected = shownTabs[interaction.selectedIndex]
      if (selected) void commit(selected)
      return
    }
    if (interaction.mode === "selection" && /^[1-9]$/u.test(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      const selected = shownTabs[Number(event.key) - 1]
      if (selected) void commit(selected)
    }
  }

  input.addEventListener("input", () => {
    interaction = reduceInteraction(interaction, { type: "query", value: input.value })
    render()
  })
  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) finish(true)
  })
  panel.addEventListener("pointerdown", (event) => event.stopPropagation())
  document.addEventListener(toggleEventName, onToggle)
  document.addEventListener("keydown", onKeyDown, true)
  window.addEventListener("pagehide", onPageHide)
  chrome.runtime.onMessage.addListener(onWorkerMessage)

  void (async () => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "peek-centered-overlay:get-model"
      })) as OverlayResponse
      if (!response.ok) throw new Error(response.error)
      if (!("model" in response)) throw new Error("Worker returned no tab model")
      model = response.model
      render()
      input.focus({ preventScroll: true })
      await chrome.runtime.sendMessage({ type: "peek-centered-overlay:mounted" })
      if (!model.historyAvailable) {
        setStatus("Previous unavailable until this test observes a distinct tab change.")
      }
    } catch (cause) {
      setStatus(`Overlay loaded but tab metadata failed: ${cause instanceof Error ? cause.message : String(cause)}`, true)
    }
  })()
}
