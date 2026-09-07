export const timelineKey = "peek-centered-overlay:timeline-v3"
export const maxTimelineRuns = 4
export const maxMarkersPerRun = 16

export type TimelineContext = "worker" | "overlay"
export type WorkerMarkerName =
  | "action-entry"
  | "execute-script-start"
  | "execute-script-end"
export type OverlayMarkerName =
  | "overlay-entry"
  | "host-append"
  | "model-request"
  | "model-response"
  | "focus"
  | "raf-1"
  | "raf-2"
export type TimelineMarkerName = WorkerMarkerName | OverlayMarkerName

export interface TimelineMarker {
  readonly context: TimelineContext
  readonly marker: TimelineMarkerName
  readonly sequence: number
  readonly timeOriginMs: number
  readonly nowMs: number
  readonly comparableEpochMs: number
  readonly status?: "ok" | "error"
}

export interface TimelineRun {
  readonly schemaVersion: 1
  readonly runId: string
  readonly workerInstanceId: string
  readonly workerTimeOriginMs: number
  readonly workerModuleEntryEpochMs: number
  readonly markers: readonly TimelineMarker[]
}

export interface TimelineStore {
  readonly schemaVersion: 1
  readonly runs: readonly TimelineRun[]
}

export const emptyTimelineStore: TimelineStore = { schemaVersion: 1, runs: [] }

const workerMarkers = new Set<TimelineMarkerName>([
  "action-entry", "execute-script-start", "execute-script-end"
])
const overlayMarkers = new Set<TimelineMarkerName>([
  "overlay-entry", "host-append", "model-request", "model-response", "focus", "raf-1", "raf-2"
])

export function sampleTimelineMarker(
  context: TimelineContext,
  marker: TimelineMarkerName,
  sequence: number,
  status?: "ok" | "error",
  clock: Pick<Performance, "timeOrigin" | "now"> = performance
): TimelineMarker {
  const nowMs = clock.now()
  return {
    context,
    marker,
    sequence,
    timeOriginMs: clock.timeOrigin,
    nowMs,
    comparableEpochMs: clock.timeOrigin + nowMs,
    ...(status === undefined ? {} : { status })
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function sanitizeOverlayMarkers(value: unknown): readonly TimelineMarker[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).flatMap((candidate): readonly TimelineMarker[] => {
    if (typeof candidate !== "object" || candidate === null) return []
    const marker = candidate as Partial<TimelineMarker>
    if (
      marker.context !== "overlay" ||
      !overlayMarkers.has(marker.marker as TimelineMarkerName) ||
      !Number.isInteger(marker.sequence) ||
      !isFiniteNumber(marker.timeOriginMs) ||
      !isFiniteNumber(marker.nowMs) ||
      !isFiniteNumber(marker.comparableEpochMs)
    ) return []
    return [{
      context: "overlay",
      marker: marker.marker as OverlayMarkerName,
      sequence: marker.sequence as number,
      timeOriginMs: marker.timeOriginMs,
      nowMs: marker.nowMs,
      comparableEpochMs: marker.comparableEpochMs
    }]
  })
}

export function isWorkerMarker(marker: TimelineMarker): boolean {
  return marker.context === "worker" && workerMarkers.has(marker.marker)
}

export function mergeBoundedRun(store: TimelineStore, run: TimelineRun): TimelineStore {
  const boundedRun: TimelineRun = {
    schemaVersion: 1,
    runId: run.runId,
    workerInstanceId: run.workerInstanceId,
    workerTimeOriginMs: run.workerTimeOriginMs,
    workerModuleEntryEpochMs: run.workerModuleEntryEpochMs,
    markers: run.markers.slice(-maxMarkersPerRun)
  }
  return {
    schemaVersion: 1,
    runs: [...store.runs.filter((item) => item.runId !== run.runId), boundedRun]
      .slice(-maxTimelineRuns)
  }
}

export function isTimelineStore(value: unknown): value is TimelineStore {
  if (typeof value !== "object" || value === null) return false
  const store = value as Partial<TimelineStore>
  return store.schemaVersion === 1 && Array.isArray(store.runs)
}

export function diagnosticExport(store: TimelineStore) {
  return {
    schemaVersion: 1 as const,
    limitations: [
      "No marker exists before the extension worker receives the action event.",
      "comparableEpochMs uses context-local timeOrigin + performance.now; compare approximately across contexts.",
      "requestAnimationFrame markers are frame opportunities, not proof that pixels were painted."
    ],
    runs: store.runs.map((run) => ({
      schemaVersion: 1 as const,
      runId: run.runId,
      workerInstanceId: run.workerInstanceId,
      workerTimeOriginMs: run.workerTimeOriginMs,
      workerModuleEntryEpochMs: run.workerModuleEntryEpochMs,
      markers: run.markers.map((marker) => ({
        context: marker.context,
        marker: marker.marker,
        sequence: marker.sequence,
        timeOriginMs: marker.timeOriginMs,
        nowMs: marker.nowMs,
        comparableEpochMs: marker.comparableEpochMs,
        ...(marker.status === undefined ? {} : { status: marker.status })
      }))
    }))
  }
}
