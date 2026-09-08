export function assertDrySchedule(result) {
  const expected = [['shortcut-down', 0, 49, 'control'], ['shortcut-up', 20, 49, 'none'], ['character-down', 50, 5, 'none'], ['character-up', 70, 5, 'none']];
  const plan = result.plan?.map(event => [event.event, event.offsetMs, event.keyCode, event.flags]);
  if (result.mode !== 'dry-run' || result.posted !== false || result.character !== 'g' || JSON.stringify(plan) !== JSON.stringify(expected)) throw new Error('Invalid dry native schedule');
  if (result.observed?.length !== 4 || result.observed.some((event, i) => event.event !== expected[i][0] || !Number.isFinite(event.observedOffsetMs) || event.observedOffsetMs < expected[i][1])) throw new Error('Dry scheduler ran early or omitted an event');
  if (result.observed[3].observedOffsetMs - result.observed[2].observedOffsetMs < 20) throw new Error('Dry scheduler collapsed character release after a late dispatch');
}

// Native helper owns the fixed-delay schedule. No palette/worker readiness
// callback is available to gate dispatch; observation happens only afterwards.
export async function earlyCharacterAttempt({ preconditions, post, observe }) {
  if (!preconditions.sourceFocused || !preconditions.sourceVisible || !preconditions.paletteAbsent || !preconditions.temperatureVerified) {
    return { preconditions, outcome: 'not-attempted', reason: 'source/palette/temperature preconditions failed' };
  }
  let dispatch;
  try { dispatch = await post(); }
  catch (error) { return { preconditions, outcome: 'unmeasured', reason: 'helper failed; dispatch unknown', error: String(error) }; }
  if (!dispatch || typeof dispatch !== 'object') return { preconditions, outcome: 'unmeasured', reason: 'invalid helper evidence; dispatch unknown' };
  const observation = await observe().catch(error => ({ available: false, error: String(error) }));
  const evidence = { preconditions, dispatch, observation, plannedDelayMs: 50 };
  if (dispatch.mode !== '--post' || !dispatch.profileVerified || !dispatch.existingPermission || !dispatch.foregroundBeforeShortcut || !dispatch.foregroundBeforeCharacter || !dispatch.shortcutPosted || !dispatch.characterPosted) {
    return { ...evidence, outcome: 'not-attempted', reason: 'native character not safely posted' };
  }
  if (!Number.isFinite(dispatch.actualDispatchOffsetMs) || dispatch.actualDispatchOffsetMs < 50) return { ...evidence, outcome: 'unmeasured', reason: 'invalid actual dispatch offset' };
  if (!observation.available) return { ...evidence, outcome: 'unmeasured', reason: 'observation unavailable' };
  return { ...evidence, outcome: observation.palette?.present && observation.palette.value === 'g' ? 'hit' : 'miss',
    limit: 'One fixed-delay attempt at the recorded actual offset, observed afterwards. Not paint evidence, IME evidence or a universal 50ms SLA.' };
}
