import { describe, expect, it } from "vitest";
import {
  createAttentionTracker,
  decodeAttentionState,
  decorateAttentionTabs,
  observeAttention,
  removeAttentionTab,
  type AttentionIdentity,
  type AttentionState,
} from "../src/attention/attention";
import type { PeekTab } from "../src/shared/model";

const A = { tabId: 1, windowId: 10 };
const B = { tabId: 2, windowId: 20 };
const X = { tabId: 3, windowId: 30 };
const tabs: PeekTab[] = [
  { id: 1, windowId: 10, title: "A", url: "https://a.test", lastAccessed: 10, current: false },
  { id: 2, windowId: 20, title: "B", url: "https://b.test", lastAccessed: 20, current: true },
  { id: 3, windowId: 30, title: "X", url: "https://x.test", lastAccessed: 30, current: false },
];

function deferred<A>() {
  let resolve!: (value: A) => void;
  const promise = new Promise<A>((done) => { resolve = done; });
  return { promise, resolve };
}

async function settle() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("attention state", () => {
  it("tracks the previously viewed distinct tab without turning the current tab into previous", () => {
    let state: AttentionState = { version: 1 };
    state = observeAttention(state, A);
    state = observeAttention(state, B);
    expect(state).toEqual({ version: 1, current: B, previous: A });
    expect(observeAttention(state, B)).toBe(state);
  });

  it("validates persisted unknown data and removes stale identities", () => {
    expect(decodeAttentionState({ version: 1, current: { tabId: "1", windowId: 10 } })).toEqual({ version: 1 });
    expect(decodeAttentionState({ version: 1, current: A, previous: A })).toEqual({ version: 1, current: A });
    expect(removeAttentionTab({ version: 1, current: B, previous: A }, 1)).toEqual({ version: 1, current: B });
  });

  it("marks only an eligible distinct previous tab and purges removed candidates", () => {
    const decorated = decorateAttentionTabs({ version: 1, current: B, previous: A }, tabs);
    expect(decorated.tabs.map((tab) => [tab.id, tab.previous])).toEqual([[1, true], [2, false], [3, false]]);
    const removed = decorateAttentionTabs({ version: 1, current: B, previous: A }, tabs.slice(1));
    expect(removed.state).toEqual({ version: 1, current: B });
    expect(removed.tabs.every((tab) => tab.previous === false)).toBe(true);
  });
});

describe("attention tracker races", () => {
  it("replays early A to B events after delayed restoration instead of overwriting them", async () => {
    const restored = deferred<unknown>();
    const saved: AttentionState[] = [];
    const candidates = new Map<string, AttentionIdentity>([["10:1", A], ["20:2", B]]);
    const tracker = createAttentionTracker({
      loadAttentionState: () => restored.promise,
      async saveAttentionState(state) { saved.push(state); },
      async resolveFocusedAttention(windowId, tabId) { return candidates.get(`${windowId}:${tabId}`); },
    });
    tracker.start();
    tracker.observeActivation(1, 10);
    tracker.observeActivation(2, 20);
    restored.resolve({ version: 1, current: X });
    await tracker.prepareTabs({ id: 2, windowId: 20 }, tabs);

    expect(saved.at(-1)).toEqual({ version: 1, current: B, previous: A });
  });

  it("does not let an ignored background activation invalidate a pending valid focus", async () => {
    const focusedB = deferred<AttentionIdentity | undefined>();
    const saved: AttentionState[] = [];
    const tracker = createAttentionTracker({
      async loadAttentionState() { return { version: 1, current: A }; },
      async saveAttentionState(state) { saved.push(state); },
      async resolveFocusedAttention(windowId, tabId) {
        if (windowId === 20 && tabId === undefined) return focusedB.promise;
        if (windowId === 10 && tabId === 9) return undefined;
        if (windowId === 30 && tabId === undefined) return X;
        return undefined;
      },
    });
    tracker.start();
    tracker.observeWindowFocus(20);
    tracker.observeActivation(9, 10);
    focusedB.resolve(B);
    await settle();
    tracker.observeWindowFocus(30);
    await tracker.prepareTabs({ id: 3, windowId: 30 }, tabs);

    expect(saved.at(-1)).toEqual({ version: 1, current: X, previous: B });
  });

  it("does not let a late older focus snapshot win over a newer activation", async () => {
    const staleFocus = deferred<AttentionIdentity | undefined>();
    const saved: AttentionState[] = [];
    const tracker = createAttentionTracker({
      async loadAttentionState() { return { version: 1, current: A }; },
      async saveAttentionState(state) { saved.push(state); },
      async resolveFocusedAttention(windowId, tabId) {
        if (windowId === 30 && tabId === undefined) return staleFocus.promise;
        if (windowId === 20 && tabId === 2) return B;
        return undefined;
      },
    });
    tracker.start();
    tracker.observeWindowFocus(30);
    tracker.observeActivation(2, 20);
    staleFocus.resolve(X);
    await tracker.prepareTabs({ id: 2, windowId: 20 }, tabs);

    expect(saved.at(-1)).toEqual({ version: 1, current: B, previous: A });
  });

  it("ignores Chrome losing focus and ineligible/internal focus resolutions", async () => {
    const saved: AttentionState[] = [];
    const tracker = createAttentionTracker({
      async loadAttentionState() { return { version: 1, current: B, previous: A }; },
      async saveAttentionState(state) { saved.push(state); },
      async resolveFocusedAttention() { return undefined; },
    });
    tracker.start();
    tracker.observeWindowFocus(-1);
    tracker.observeWindowFocus(99);
    await settle();
    await tracker.prepareTabs({ id: 2, windowId: 20 }, tabs);
    expect(saved.at(-1)).toEqual({ version: 1, current: B, previous: A });
  });
});
