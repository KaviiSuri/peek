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
