import type { OverlayModel, SelectionOutcome } from "./browser/tabs.ts"
import type { TimelineMarker } from "./instrumentation/timeline-core.ts"

export type OverlayRequest =
  | {
      readonly type: "peek-centered-overlay:get-model"
      readonly timeline?: readonly TimelineMarker[]
    }
  | {
      readonly type: "peek-centered-overlay:commit"
      readonly targetTabId: number
      readonly targetWindowId: number
    }
  | { readonly type: "peek-centered-overlay:mounted" }
  | { readonly type: "peek-centered-overlay:removed" }
  | {
      readonly type: "peek-centered-overlay:timeline"
      readonly runId: string | null
      readonly timeline: readonly TimelineMarker[]
    }

export type OverlayResponse =
  | { readonly ok: true; readonly model: OverlayModel; readonly instrumentationRunId: string | null }
  | { readonly ok: true; readonly outcome: SelectionOutcome }
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

export type WorkerRequest = { readonly type: "peek-centered-overlay:teardown" }

export function isOverlayRequest(value: unknown): value is OverlayRequest {
  if (typeof value !== "object" || value === null) return false
  const type = (value as { type?: unknown }).type
  if (
    type === "peek-centered-overlay:get-model" ||
    type === "peek-centered-overlay:mounted" ||
    type === "peek-centered-overlay:removed"
  ) return true
  if (type === "peek-centered-overlay:timeline") {
    const record = value as Record<string, unknown>
    return (typeof record.runId === "string" || record.runId === null) && Array.isArray(record.timeline)
  }
  if (type !== "peek-centered-overlay:commit") return false
  const record = value as Record<string, unknown>
  return Number.isInteger(record.targetTabId) && Number.isInteger(record.targetWindowId)
}
