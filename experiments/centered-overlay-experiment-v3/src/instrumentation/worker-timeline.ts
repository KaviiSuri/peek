import {
  emptyTimelineStore,
  isTimelineStore,
  mergeBoundedRun,
  sampleTimelineMarker,
  sanitizeOverlayMarkers,
  timelineKey,
  type TimelineRun,
  type WorkerMarkerName
} from "./timeline-core.ts"

const workerInstanceId = crypto.randomUUID()
const workerModuleEntryNowMs = performance.now()
const workerModuleEntryEpochMs = performance.timeOrigin + workerModuleEntryNowMs
const activeRunByTab = new Map<number, TimelineRun>()
let workerSequence = 0
let persistence = Promise.resolve()

function persist(run: TimelineRun): void {
  const snapshot: TimelineRun = { ...run, markers: run.markers.map((marker) => ({ ...marker })) }
  persistence = persistence
    .then(async () => {
      const stored = await chrome.storage.session.get(timelineKey)
      const current: unknown = stored[timelineKey]
      const store = isTimelineStore(current) ? current : emptyTimelineStore
      await chrome.storage.session.set({ [timelineKey]: mergeBoundedRun(store, snapshot) })
    })
    .catch((cause: unknown) => console.warn("Peek timeline persistence failed", cause))
}

export function startTimelineRun(tabId: number): string {
  const runId = crypto.randomUUID()
  const run: TimelineRun = {
    schemaVersion: 1,
    runId,
    workerInstanceId,
    workerTimeOriginMs: performance.timeOrigin,
    workerModuleEntryEpochMs,
    markers: [sampleTimelineMarker("worker", "action-entry", workerSequence++)]
  }
  activeRunByTab.set(tabId, run)
  return runId
}

export function markWorkerForTab(
  tabId: number,
  marker: WorkerMarkerName,
  status?: "ok" | "error"
): void {
  const run = activeRunByTab.get(tabId)
  if (run === undefined) return
  const updated: TimelineRun = {
    ...run,
    markers: [...run.markers, sampleTimelineMarker("worker", marker, workerSequence++, status)]
  }
  activeRunByTab.set(tabId, updated)
  if (marker === "execute-script-end") persist(updated)
}

export function ingestOverlayMarkers(
  tabId: number,
  value: unknown,
  expectedRunId?: string | null
): string | null {
  const run = activeRunByTab.get(tabId)
  if (run === undefined || (expectedRunId != null && expectedRunId !== run.runId)) return null
  const markers = sanitizeOverlayMarkers(value)
  if (markers.length > 0) {
    const updated = { ...run, markers: [...run.markers, ...markers] }
    activeRunByTab.set(tabId, updated)
    persist(updated)
  }
  return run.runId
}

export function currentTimelineRunId(tabId: number): string | null {
  return activeRunByTab.get(tabId)?.runId ?? null
}
