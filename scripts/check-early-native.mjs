// CODE-ONLY: compiles the helper and exercises its shared scheduler with a
// recording sink. This script never supplies --post or --check, nor opens Chrome.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertDrySchedule } from './early-character.mjs';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/check-early-native.mjs <artifact-directory>');
await mkdir(output, { recursive: true });
const original = await readFile(new URL('./native-early-character.swift', import.meta.url), 'utf8');
const cases = [
  ['control', null, null],
  ['delay', 'Step(name: "character-down", offsetMs: 50', 'Step(name: "character-down", offsetMs: 0'],
  ['keycode', 'offsetMs: 50, keyCode: 5, down: true', 'offsetMs: 50, keyCode: 71, down: true'],
  ['modifiers', 'name == "shortcut-down" ? [.maskControl] : []', '[.maskControl]'],
];
const results = [];
for (const [name, oldText, newText] of cases) {
  if (oldText && original.split(oldText).length !== 2) throw new Error(`Nonunique mutation ${name}`);
  const source = resolve(output, `${name}.swift`), binary = resolve(output, name);
  await writeFile(source, oldText ? original.replace(oldText, newText) : original);
  execFileSync('/usr/bin/swiftc', [source, '-o', binary]);
  const result = JSON.parse(execFileSync(binary, ['--dry-run'], { encoding: 'utf8' }));
  await writeFile(resolve(output, `${name}.json`), JSON.stringify(result, null, 2));
  let assertionFailure;
  try { assertDrySchedule(result); } catch (error) { assertionFailure = String(error); }
  if (name === 'control' ? assertionFailure !== undefined : assertionFailure === undefined) throw new Error(`Unexpected schedule assertion result: ${name}`);
  results.push({ name, compiled: true, mode: result.mode, posted: result.posted, assertionFailure: assertionFailure ?? null });
}
const summary = { mode: 'compile-and-dry-run only', nativeEventsPosted: false,
  sourceSha256: createHash('sha256').update(original).digest('hex'), results };
await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
