import { Effect, ManagedRuntime } from "effect"
import { selectTab } from "./application/select-tab.ts"
import { ChromeTabsLive } from "./browser/chrome-tabs-live.ts"
import { ChromeTabs, type AttentionSnapshot, type TabRecord } from "./browser/tabs.ts"
import { filterTabs, orderForEmptyQuery } from "./core/filter.ts"
import {
  initialInteraction,
  reduceInteraction,
  type InteractionState
} from "./core/interaction.ts"

const evaluatedAt = performance.now()
const runtime = ManagedRuntime.make(ChromeTabsLive)
const queryInput = document.querySelector<HTMLInputElement>("#query")!
const resultList = document.querySelector<HTMLOListElement>("#results")!
const status = document.querySelector<HTMLParagraphElement>("#status")!
const commandState = document.querySelector<HTMLParagraphElement>("#command-state")!
const observations = document.querySelector<HTMLPreElement>("#observations")!

let interaction: InteractionState = initialInteraction
let allTabs: readonly TabRecord[] = []
let shownTabs: readonly TabRecord[] = []
let attention: AttentionSnapshot = {
  currentTabId: null,
  previousTabId: null,
  historyAvailable: false
}
const eventLog: string[] = []

function record(event: string, fields: Record<string, unknown> = {}): void {
  const row = {
    event,
    atMsSincePopupScriptEvaluation: Number((performance.now() - evaluatedAt).toFixed(2)),
    ...fields
  }
  eventLog.push(JSON.stringify(row))
  observations.textContent = eventLog.join("\n")
}

function describeUrl(raw: string): string {
  try {
    const url = new URL(raw)
    return `${url.hostname}${url.pathname}${url.search}`
  } catch {
    return raw
  }
}

function setStatus(message: string, error = false): void {
  status.textContent = message
  status.classList.toggle("error", error)
}

function render(): void {
  const source = interaction.query.trim()
    ? allTabs
    : orderForEmptyQuery(allTabs, attention.previousTabId)
  shownTabs = filterTabs(source, interaction.query)
  interaction = reduceInteraction(interaction, {
    type: "reconcile",
    count: shownTabs.length
  })

  resultList.replaceChildren()
  shownTabs.forEach((tab, index) => {
    const row = document.createElement("li")
    row.classList.toggle("selected", index === interaction.selectedIndex)
    row.setAttribute("aria-current", index === interaction.selectedIndex ? "true" : "false")

    const button = document.createElement("button")
    button.type = "button"
    button.addEventListener("click", () => void commit(tab))

    if (tab.favIconUrl) {
      const image = document.createElement("img")
      image.className = "favicon"
      image.src = tab.favIconUrl
      image.alt = ""
      button.append(image)
    } else {
      const fallback = document.createElement("span")
      fallback.className = "fallback-icon"
      fallback.textContent = "●"
      button.append(fallback)
    }

    const copy = document.createElement("span")
    copy.className = "copy"
    const title = document.createElement("span")
    title.className = "title"
    title.textContent = tab.title
    const url = document.createElement("span")
    url.className = "url"
    url.textContent = describeUrl(tab.url)
    copy.append(title, url)
    button.append(copy)

    const key = document.createElement("kbd")
    key.textContent = interaction.mode === "selection" && index < 9 ? String(index + 1) : ""
    button.append(key)
    row.append(button)
    resultList.append(row)
  })

  setStatus(
    `${shownTabs.length} eligible normal-window tab${shownTabs.length === 1 ? "" : "s"} · ${interaction.mode} mode`
  )
}

async function refreshTabs(): Promise<void> {
  const started = performance.now()
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const tabs = yield* ChromeTabs
      return yield* tabs.list
    })
  )
  allTabs = result
  render()
  record("results-painted", {
    eligibleTabCount: result.length,
    durationMs: Number((performance.now() - started).toFixed(2)),
    filterKind: "literal-all-tokens"
  })
}

async function commit(tab: TabRecord): Promise<void> {
  record("commit-requested", { tabId: tab.id, windowId: tab.windowId })
  const started = performance.now()
  try {
    const outcome = await runtime.runPromise(selectTab(tab, attention.currentTabId))
    if (outcome === "current-no-op") {
      record("current-tab-no-op", { previousTabIdRetained: attention.previousTabId })
    } else {
      record("activation-resolved", {
        tabId: tab.id,
        durationMs: Number((performance.now() - started).toFixed(2))
      })
    }
    window.close()
  } catch (cause) {
    record("activation-failed", {
      tabId: tab.id,
      detail: cause instanceof Error ? cause.message : String(cause)
    })
    setStatus("Selected tab vanished or could not be focused; results refreshed.", true)
    await refreshTabs()
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
    caretStart: queryInput.selectionStart ?? interaction.query.length,
    caretEnd: queryInput.selectionEnd ?? interaction.query.length
  })

  if (interaction.mode === "selection") {
    queryInput.blur()
  } else {
    queryInput.focus()
    queryInput.setSelectionRange(interaction.caretStart, interaction.caretEnd)
  }
  record("mode-toggled", { mode: interaction.mode })
  render()
}

queryInput.addEventListener("input", () => {
  interaction = reduceInteraction(interaction, { type: "query", value: queryInput.value })
  record("input", { queryLength: interaction.query.length })
  render()
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault()
    record("cancelled")
    window.close()
    return
  }

  if (event.key === "Tab" && !event.shiftKey) {
    event.preventDefault()
    toggleMode()
    return
  }

  if (event.key === "ArrowDown" || (interaction.mode === "selection" && event.key === "j")) {
    event.preventDefault()
    move(1)
    return
  }

  if (event.key === "ArrowUp" || (interaction.mode === "selection" && event.key === "k")) {
    event.preventDefault()
    move(-1)
    return
  }

  if (event.key === "Enter") {
    event.preventDefault()
    const selected = shownTabs[interaction.selectedIndex]
    if (selected) void commit(selected)
    return
  }

  if (interaction.mode === "selection" && /^[1-9]$/u.test(event.key)) {
    event.preventDefault()
    const selected = shownTabs[Number(event.key) - 1]
    if (selected) void commit(selected)
  }
})

async function boot(): Promise<void> {
  record("popup-script-evaluated")
  try {
    const facts = await runtime.runPromise(
      Effect.gen(function* () {
        const tabs = yield* ChromeTabs
        const [attentionSnapshot, shortcut] = yield* Effect.all([
          tabs.attention,
          tabs.commandShortcut
        ])
        return { attentionSnapshot, shortcut }
      })
    )
    attention = facts.attentionSnapshot
    commandState.textContent = facts.shortcut
      ? `Chrome reports ${facts.shortcut}`
      : "Chrome reports command unassigned — open chrome://extensions/shortcuts"
    record("browser-facts-ready", {
      shortcut: facts.shortcut || "unassigned",
      historyAvailable: attention.historyAvailable,
      currentTabId: attention.currentTabId,
      previousTabId: attention.previousTabId
    })

    await refreshTabs()
    queryInput.focus()
    record("input-focused", { activeElementIsInput: document.activeElement === queryInput })
    if (!attention.historyAvailable) {
      setStatus("Previous unavailable until this test extension observes a distinct tab change.")
    }
  } catch (cause) {
    record("boot-failed", { detail: cause instanceof Error ? cause.message : String(cause) })
    setStatus("Could not read eligible tabs. Inspect the extension popup console.", true)
  }
}

void boot()
