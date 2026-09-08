import { afterEach, expect, it, vi } from "vitest";
import { createAttentionTracker } from "../src/attention/attention";

afterEach(() => vi.useRealTimers());

it("does not discard newly delivered attention while an older save is pending", async () => {
  let release!: () => void;
  let started!: () => void;
  const saving = new Promise<void>(resolve => { started = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const saved: unknown[] = [];
  const tracker = createAttentionTracker({
    loadAttentionState: async () => ({ version: 1, current: { tabId: 1, windowId: 1 } }),
    async saveAttentionState(state) {
      saved.push(state);
      if (state.current?.tabId === 2) { started(); await blocked; }
    },
    resolveFocusedAttention: async (windowId, tabId) => ({ tabId: tabId!, windowId: windowId! }),
  });
  tracker.observeActivation(2, 2);
  await saving;
  tracker.observeActivation(3, 3);
  release();
  await tracker.prepareTabs({ id: 3, windowId: 3 }, [1, 2, 3].map(id => ({ id, windowId: id, title: String(id), url: 'https://fixture.test', lastAccessed: id, current: id === 3 })));
  expect(saved.at(-1)).toEqual({ version: 1, current: { tabId: 3, windowId: 3 }, previous: { tabId: 2, windowId: 2 } });
});

it("coalesces writes behind an outstanding save and restores the latest previous identity", async () => {
  let storage: unknown = { version: 1, current: { tabId: 1, windowId: 10 } };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let done!: () => void;
  const latestSaved = new Promise<void>(resolve => { done = resolve; });
  const adapter = {
    async loadAttentionState() { return storage; },
    async resolveFocusedAttention() { return undefined; },
    async saveAttentionState(state: import('../src/attention/attention').AttentionState) {
      if (state.current?.tabId === 2) await gate;
      storage = state;
      if (state.current?.tabId === 4) done();
    },
  };
  const tabs = [1, 2, 3, 4].map(id => ({ id, windowId: 10, title: String(id), url: 'https://fixture.test', lastAccessed: id, current: false }));
  const tracker = createAttentionTracker(adapter);
  for (const id of [2, 3, 4]) await tracker.prepareTabs({ id, windowId: 10 }, tabs);
  release();
  await latestSaved;
  const restored = await createAttentionTracker(adapter).prepareTabs({ id: 4, windowId: 10 }, tabs);
  expect(restored.find(tab => tab.previous)?.id).toBe(3);
  expect(storage).toEqual({ version: 1, current: { tabId: 4, windowId: 10 }, previous: { tabId: 3, windowId: 10 } });
});

it("retries failed persistence even when the in-memory state is unchanged", async () => {
  let failed = false;
  let stored: unknown;
  const adapter = {
    async loadAttentionState() { return undefined; },
    async resolveFocusedAttention() { return undefined; },
    async saveAttentionState(state: import('../src/attention/attention').AttentionState) {
      if (state.current && !failed) { failed = true; throw new Error('temporary storage failure'); }
      stored = state;
    },
  };
  const tracker = createAttentionTracker(adapter);
  const tabs = [{ id: 2, windowId: 10, title: 'Source', url: 'https://fixture.test', lastAccessed: 0, current: true }];
  await tracker.prepareTabs({ id: 2, windowId: 10 }, tabs);
  await tracker.prepareTabs({ id: 2, windowId: 10 }, tabs);
  expect(failed).toBe(true);
  expect(stored).toEqual({ version: 1, current: { tabId: 2, windowId: 10 } });
});

it("releases a hung observation and ignores its late answer instead of retaining pending history", async () => {
  vi.useFakeTimers();
  let release!: (identity: { tabId: number; windowId: number }) => void;
  const save = vi.fn(async () => undefined);
  const tracker = createAttentionTracker({
    loadAttentionState: async () => undefined,
    saveAttentionState: save,
    resolveFocusedAttention: () => new Promise(resolve => { release = resolve; }),
  });
  tracker.observeWindowFocus(9);
  const tabs = [{ id: 1, windowId: 4, title: "Source", url: "https://source.test", current: true, lastAccessed: 0 }];
  const prepared = tracker.prepareTabs({ id: 1, windowId: 4 }, tabs);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await prepared).toEqual([{ ...tabs[0], previous: false }]);
  const before = save.mock.calls.length;
  release({ tabId: 99, windowId: 9 });
  await Promise.resolve();
  await Promise.resolve();
  expect(save.mock.calls.length).toBe(before);
  expect(vi.getTimerCount()).toBe(0);
});
