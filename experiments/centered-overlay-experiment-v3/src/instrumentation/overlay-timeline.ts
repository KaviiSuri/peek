import {
  sampleTimelineMarker,
  type OverlayMarkerName,
  type TimelineMarker
} from "./timeline-core.ts"

export interface OverlayTimeline {
  readonly mark: (marker: OverlayMarkerName) => void
  readonly drain: () => readonly TimelineMarker[]
}

export function makeOverlayTimeline(): OverlayTimeline {
  let sequence = 0
  let pending: TimelineMarker[] = []
  return {
    mark: (marker) => {
      pending.push(sampleTimelineMarker("overlay", marker, sequence++))
    },
    drain: () => {
      const batch = pending
      pending = []
      return batch
    }
  }
}
