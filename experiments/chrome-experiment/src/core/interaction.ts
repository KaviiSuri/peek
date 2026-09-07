export type Mode = "typing" | "selection"

export interface InteractionState {
  readonly mode: Mode
  readonly query: string
  readonly selectedIndex: number
  readonly caretStart: number
  readonly caretEnd: number
}

export type InteractionEvent =
  | { readonly type: "query"; readonly value: string }
  | { readonly type: "move"; readonly delta: -1 | 1; readonly count: number }
  | {
      readonly type: "toggle-mode"
      readonly caretStart?: number
      readonly caretEnd?: number
    }
  | { readonly type: "reconcile"; readonly count: number }

export const initialInteraction: InteractionState = {
  mode: "typing",
  query: "",
  selectedIndex: 0,
  caretStart: 0,
  caretEnd: 0
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.max(0, Math.min(index, count - 1))
}

export function reduceInteraction(
  state: InteractionState,
  event: InteractionEvent
): InteractionState {
  switch (event.type) {
    case "query":
      return { ...state, query: event.value, selectedIndex: 0 }
    case "move":
      return {
        ...state,
        selectedIndex: clampIndex(state.selectedIndex + event.delta, event.count)
      }
    case "toggle-mode":
      return state.mode === "typing"
        ? {
            ...state,
            mode: "selection",
            caretStart: event.caretStart ?? state.query.length,
            caretEnd: event.caretEnd ?? state.query.length
          }
        : { ...state, mode: "typing" }
    case "reconcile":
      return { ...state, selectedIndex: clampIndex(state.selectedIndex, event.count) }
  }
}
