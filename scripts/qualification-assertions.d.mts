export function assertCommitChain(
  chain: { activation: { args: unknown[] }; focus: { args: unknown[] } },
  target: { id: number; windowId: number },
): void;
export function cancellationReadiness(
  sourceWindowId: number,
  state: { lastFocusedWindowId: number; windows: readonly { id: number; focused: boolean }[] },
  document: { focused: boolean; visibility: string; at: number },
  cancelAt: number,
): {
  outcome: string;
  cancelReadinessOutcome: string;
  cancelSourceReadyObservedMs: number | null;
};
