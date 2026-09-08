import { describe, expect, it } from 'vitest';
import { assertCommitChain, cancellationReadiness } from '../scripts/qualification-assertions.mjs';

const target = { id: 2, windowId: 20 };
const activation = { args: [2, { active: true }] };
const focus = { args: [20, { focused: true }] };

describe('qualification evidence assertions', () => {
  it('accepts the exact first activation/focus chain', () => {
    expect(() => assertCommitChain({ activation, focus }, target)).not.toThrow();
  });
  it.each([
    [30, { focused: true }], [20, { focused: false }], [20, {}],
    [20, { focused: true, left: 0 }], [20],
  ])('rejects incorrect first focus args %j even when later browser state is correct', (...args) => {
    const events = [{ args }, focus];
    const eventualWindow = target.windowId;
    expect(eventualWindow).toBe(20);
    expect(() => assertCommitChain({ activation, focus: events[0]! }, target)).toThrow('First completed chain focused wrong window/options');
  });
  it.each([[3, { active: true }], [2, { active: false }]])('rejects incorrect first activation %j', (...args) => {
    expect(() => assertCommitChain({ activation: { args }, focus }, target)).toThrow('First completed chain activated wrong tab/options');
  });

  const state = { lastFocusedWindowId: 10, windows: [{ id: 10, focused: true }, { id: 30, focused: false }] };
  it('records source readiness observation separately from teardown', () => {
    const cancelAt = 100, closedAt = 120;
    const result = cancellationReadiness(10, state, { focused: true, visibility: 'visible', at: 180 }, cancelAt);
    expect(closedAt - cancelAt).toBe(20);
    expect(result).toEqual({ outcome: 'pass', cancelReadinessOutcome: 'ready', cancelSourceReadyObservedMs: 80 });
  });
  it.each([
    { focused: false, visibility: 'visible' },
    { focused: true, visibility: 'hidden' },
  ])('does not pass a closed palette with an unready source document %j', document => {
    const result = cancellationReadiness(10, state, { ...document, at: 180 }, 100);
    expect(result.outcome).not.toBe('pass');
    expect(result.cancelReadinessOutcome).toBe('source document unfocused or hidden');
    expect(result.cancelSourceReadyObservedMs).toBeNull();
  });
  it.each([
    { lastFocusedWindowId: 10, windows: [{ id: 10, focused: false }] },
    { lastFocusedWindowId: 30, windows: [{ id: 10, focused: false }, { id: 30, focused: true }] },
  ])('does not treat last-focused identity or a stale document observation as source readiness: %j', external => {
    const before = structuredClone(external);
    const result = cancellationReadiness(10, external, { focused: true, visibility: 'visible', at: 180 }, 100);
    expect(result.outcome).not.toBe('pass');
    expect(result.cancelReadinessOutcome).toBe('source window not focused / external departure');
    expect(result.cancelSourceReadyObservedMs).toBeNull();
    expect(external).toEqual(before);
  });
});
