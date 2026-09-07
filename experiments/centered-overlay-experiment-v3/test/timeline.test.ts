import assert from "node:assert/strict"
import test from "node:test"
import {
  diagnosticExport,
  emptyTimelineStore,
  maxMarkersPerRun,
  maxTimelineRuns,
  mergeBoundedRun,
  sampleTimelineMarker,
  sanitizeOverlayMarkers,
  type TimelineRun
} from "../src/instrumentation/timeline-core.ts"

const clock = (timeOrigin: number, now: number) => ({ timeOrigin, now: () => now })
const run = (index: number, markerCount = 1): TimelineRun => ({
  schemaVersion: 1,
  runId: `run-${index}`,
  workerInstanceId: `worker-${index}`,
  workerTimeOriginMs: 1000,
  workerModuleEntryEpochMs: 1001,
  markers: Array.from({ length: markerCount }, (_, sequence) =>
    sampleTimelineMarker("worker", "action-entry", sequence, undefined, clock(1000, sequence))
  )
})

test("context-local clocks retain origins and expose only approximate comparable epoch", () => {
  const worker = sampleTimelineMarker("worker", "action-entry", 0, undefined, clock(1000, 10))
  const overlay = sampleTimelineMarker("overlay", "overlay-entry", 0, undefined, clock(900, 110))
  assert.notEqual(worker.timeOriginMs, overlay.timeOriginMs)
  assert.equal(worker.comparableEpochMs, overlay.comparableEpochMs)
  assert.match(diagnosticExport(emptyTimelineStore).limitations.join(" "), /approximately across contexts/u)
  assert.match(diagnosticExport(emptyTimelineStore).limitations.join(" "), /not proof.*painted/u)
})

test("timeline storage retains only bounded recent runs and markers", () => {
  let store = emptyTimelineStore
  for (let index = 0; index < maxTimelineRuns + 3; index += 1) {
    store = mergeBoundedRun(store, run(index, maxMarkersPerRun + 5))
  }
  assert.equal(store.runs.length, maxTimelineRuns)
  assert.deepEqual(store.runs.map((item) => item.runId), ["run-3", "run-4", "run-5", "run-6"])
  assert.ok(store.runs.every((item) => item.markers.length === maxMarkersPerRun))
})

test("overlay marker ingestion reconstructs allow-listed timing fields only", () => {
  const markers = sanitizeOverlayMarkers([{
    context: "overlay",
    marker: "host-append",
    sequence: 1,
    timeOriginMs: 100,
    nowMs: 5,
    comparableEpochMs: 105,
    url: "https://secret.test/",
    title: "Secret title",
    content: "Secret content",
    status: "error"
  }])
  assert.deepEqual(markers, [{
    context: "overlay",
    marker: "host-append",
    sequence: 1,
    timeOriginMs: 100,
    nowMs: 5,
    comparableEpochMs: 105
  }])
  const json = JSON.stringify(diagnosticExport(mergeBoundedRun(emptyTimelineStore, {
    ...run(1), markers
  })))
  assert.doesNotMatch(json, /secret\.test|Secret title|Secret content|"url"|"title"|"content"/u)
})

test("invalid and excessive overlay markers are rejected or capped", () => {
  const candidate = {
    context: "overlay",
    marker: "raf-1",
    sequence: 1,
    timeOriginMs: 100,
    nowMs: 2,
    comparableEpochMs: 102
  }
  assert.equal(sanitizeOverlayMarkers(Array.from({ length: 20 }, () => candidate)).length, 8)
  assert.deepEqual(sanitizeOverlayMarkers([{ ...candidate, marker: "page-content" }]), [])
  assert.deepEqual(sanitizeOverlayMarkers([{ ...candidate, comparableEpochMs: Number.NaN }]), [])
})
