import type { PeekTab } from "../shared/model";

export type InteractionMode = "typing" | "selection";

export interface TextSelection {
  readonly start: number;
  readonly end: number;
  readonly direction: "forward" | "backward" | "none";
}

export interface InteractionState {
  readonly query: string;
  readonly highlightedTabId: number | undefined;
  readonly mode: InteractionMode;
  readonly typingSelection: TextSelection;
}

const collapsedSelection: TextSelection = { start: 0, end: 0, direction: "none" };

export function initialInteraction(results: readonly PeekTab[]): InteractionState {
  return {
    query: "",
    highlightedTabId: results[0]?.id,
    mode: "typing",
    typingSelection: collapsedSelection,
  };
}

export function enterSelectionMode(state: InteractionState, selection: TextSelection): InteractionState {
  return { ...state, mode: "selection", typingSelection: selection };
}

export function returnToTypingMode(state: InteractionState): InteractionState {
  return { ...state, mode: "typing" };
}

export function visibleChoiceForDigit<T>(visibleChoices: readonly T[], key: string): T | undefined {
  if (!/^[1-9]$/.test(key)) return undefined;
  return visibleChoices[Number(key) - 1];
}

export function setQuery(state: InteractionState, query: string, results: readonly PeekTab[]): InteractionState {
  const queryChanged = query !== state.query;
  const highlightedStillExists = results.some((tab) => tab.id === state.highlightedTabId);
  return {
    ...state,
    query,
    highlightedTabId: !queryChanged && highlightedStillExists ? state.highlightedTabId : results[0]?.id,
  };
}

export function moveHighlight(
  state: InteractionState,
  results: readonly PeekTab[],
  delta: -1 | 1,
): InteractionState {
  if (results.length === 0) return { ...state, highlightedTabId: undefined };
  const currentIndex = results.findIndex((tab) => tab.id === state.highlightedTabId);
  const start = currentIndex < 0 ? (delta > 0 ? -1 : 0) : currentIndex;
  const nextIndex = (start + delta + results.length) % results.length;
  return { ...state, highlightedTabId: results[nextIndex]?.id };
}

export function highlightedTab(state: InteractionState, results: readonly PeekTab[]): PeekTab | undefined {
  return results.find((tab) => tab.id === state.highlightedTabId);
}
