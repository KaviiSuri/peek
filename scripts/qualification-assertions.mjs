// Pure evidence checks shared by the Chrome harness and code-only tests.
export function assertCommitChain(chain, target) {
  const exactUpdate = (event, id, option) => event?.args?.length === 2 && event.args[0] === id &&
    event.args[1] !== null && typeof event.args[1] === 'object' &&
    Object.keys(event.args[1]).length === 1 && event.args[1][option] === true;
  if (!exactUpdate(chain.activation, target.id, 'active')) throw new Error('First completed chain activated wrong tab/options');
  if (!exactUpdate(chain.focus, target.windowId, 'focused')) throw new Error('First completed chain focused wrong window/options');
}

export function cancellationReadiness(sourceWindowId, state, document, cancelAt) {
  const windowReady = state.lastFocusedWindowId === sourceWindowId &&
    state.windows.some(window => window.id === sourceWindowId && window.focused === true);
  const ready = windowReady && document.focused === true && document.visibility === 'visible';
  return {
    outcome: ready ? 'pass' : 'incomplete: cancellation source readiness not observed',
    cancelReadinessOutcome: ready ? 'ready' : windowReady ? 'source document unfocused or hidden' : 'source window not focused / external departure',
    // This is the first collected ready observation, not teardown or paint time.
    cancelSourceReadyObservedMs: ready ? document.at - cancelAt : null,
  };
}
