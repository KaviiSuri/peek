import {
  diagnosticExport,
  emptyTimelineStore,
  isTimelineStore,
  timelineKey
} from "./instrumentation/timeline-core.ts"

const output = document.querySelector<HTMLPreElement>("#output")
const download = document.querySelector<HTMLButtonElement>("#download")
if (output === null || download === null) throw new Error("Diagnostic page controls missing")

void (async () => {
  const stored = await chrome.storage.session.get(timelineKey)
  const value: unknown = stored[timelineKey]
  const timeline = diagnosticExport(isTimelineStore(value) ? value : emptyTimelineStore)
  const json = `${JSON.stringify(timeline, null, 2)}\n`
  output.textContent = json

  download.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "peek-v3-timeline.json"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  })
})()
