import { describe, expect, it, vi } from 'vitest';
import { assertDrySchedule, earlyCharacterAttempt } from '../scripts/early-character.mjs';

const preconditions = { sourceFocused: true, sourceVisible: true, paletteAbsent: true, temperatureVerified: true };
const dispatch = { mode: '--post', profileVerified: true, existingPermission: true, foregroundBeforeShortcut: true,
  foregroundBeforeCharacter: true, shortcutPosted: true, characterPosted: true, plannedDelayMs: 50,
  actualDispatchOffsetMs: 53, shortcutPostedAtMs: 1000, characterPostedAtMs: 1053 };
const observation = (value: string) => ({ available: true, palette: { present: true, value }, sourceAfter: { activeValue: '' } });
const plan = [
  { event: 'shortcut-down', offsetMs: 0, keyCode: 49, flags: 'control' },
  { event: 'shortcut-up', offsetMs: 20, keyCode: 49, flags: 'none' },
  { event: 'character-down', offsetMs: 50, keyCode: 5, flags: 'none' },
  { event: 'character-up', offsetMs: 70, keyCode: 5, flags: 'none' },
];
const dry = () => ({ mode: 'dry-run', posted: false, character: 'g', plan: structuredClone(plan), observed: plan.map(event => ({ ...event, observedOffsetMs: event.offsetMs + 1 })) });

describe('fixed-delay native character evidence (no events posted by these tests)', () => {
  it('validates the shared dry schedule, macOS keycodes and cleared modifiers', () => {
    expect(() => assertDrySchedule(dry())).not.toThrow();
  });
  it.each(['delay', 'keycode', 'modifiers', 'early', 'omitted', 'posting', 'collapsed-release', 'character'])('rejects an invalid dry schedule: %s', defect => {
    const result = dry();
    if (defect === 'delay') result.plan[2]!.offsetMs = 0;
    if (defect === 'keycode') result.plan[2]!.keyCode = 71;
    if (defect === 'modifiers') result.plan[1]!.flags = 'control';
    if (defect === 'early') result.observed[2]!.observedOffsetMs = 49;
    if (defect === 'omitted') result.observed.pop();
    if (defect === 'posting') result.posted = true;
    if (defect === 'character') result.character = 'x';
    if (defect === 'collapsed-release') { result.observed[2]!.observedOffsetMs = 500; result.observed[3]!.observedOffsetMs = 501; }
    expect(() => assertDrySchedule(result)).toThrow();
  });
  it('dispatches the complete native schedule before any palette observation; no readiness/reattachment gate', async () => {
    let release!: (value: typeof dispatch) => void;
    const gate = new Promise<typeof dispatch>(resolve => { release = resolve; });
    const order: string[] = [];
    const observe = vi.fn(async () => { order.push('observe'); return observation('g'); });
    const work = earlyCharacterAttempt({ preconditions, post: () => { order.push('post'); return gate; }, observe });
    expect(order).toEqual(['post']);
    expect(observe).not.toHaveBeenCalled();
    release(dispatch);
    expect(await work).toMatchObject({ outcome: 'hit', dispatch: { actualDispatchOffsetMs: 53 } });
    expect(order).toEqual(['post', 'observe']);
  });
  it.each(['sourceFocused', 'sourceVisible', 'paletteAbsent', 'temperatureVerified'])('does not post with failed %s precondition', async field => {
    const post = vi.fn(), observe = vi.fn();
    expect(await earlyCharacterAttempt({ preconditions: { ...preconditions, [field]: false }, post, observe })).toMatchObject({ outcome: 'not-attempted' });
    expect(post).not.toHaveBeenCalled(); expect(observe).not.toHaveBeenCalled();
  });
  it.each(['profileVerified', 'existingPermission', 'foregroundBeforeShortcut', 'foregroundBeforeCharacter', 'characterPosted'])('cannot count a hit without native %s', async field => {
    const result = await earlyCharacterAttempt({ preconditions, post: () => ({ ...dispatch, [field]: false }), observe: async () => observation('g') });
    expect(result.outcome).toBe('not-attempted');
  });
  it('retains a miss separately from a later successful readiness-gated/recovery observation', async () => {
    const miss = await earlyCharacterAttempt({ preconditions, post: () => dispatch, observe: async () => ({ ...observation(''), sourceAfter: { activeValue: 'g' } }) });
    const later = observation('g');
    expect(later.palette.value).toBe('g');
    expect(miss).toMatchObject({ outcome: 'miss', observation: { palette: { value: '' }, sourceAfter: { activeValue: 'g' } } });
  });
  it('records late dispatch as a hit at its actual offset, not proof of a 50ms SLA', async () => {
    const result = await earlyCharacterAttempt({ preconditions, post: () => ({ ...dispatch, actualDispatchOffsetMs: 400 }), observe: async () => observation('g') });
    expect(result).toMatchObject({ outcome: 'hit', dispatch: { actualDispatchOffsetMs: 400 }, plannedDelayMs: 50 });
    expect(result.limit).toContain('Not paint evidence');
    expect(result.limit).toContain('universal 50ms SLA');
  });
  it('does not count a dry run, early dispatch or unavailable observation as a hit', async () => {
    expect((await earlyCharacterAttempt({ preconditions, post: () => undefined, observe: async () => observation('g') })).outcome).toBe('unmeasured');
    expect((await earlyCharacterAttempt({ preconditions, post: () => dry(), observe: async () => observation('g') })).outcome).toBe('not-attempted');
    expect((await earlyCharacterAttempt({ preconditions, post: () => ({ ...dispatch, actualDispatchOffsetMs: 49 }), observe: async () => observation('g') })).outcome).toBe('unmeasured');
    expect((await earlyCharacterAttempt({ preconditions, post: () => dispatch, observe: async () => { throw new Error('CDP unavailable'); } })).outcome).toBe('unmeasured');
  });
  it('retains unknown dispatch failure without pretending to recover or observe a hit', async () => {
    const observe = vi.fn();
    expect(await earlyCharacterAttempt({ preconditions, post: () => { throw new Error('helper failed'); }, observe })).toMatchObject({ outcome: 'unmeasured', reason: 'helper failed; dispatch unknown' });
    expect(observe).not.toHaveBeenCalled();
  });
});
