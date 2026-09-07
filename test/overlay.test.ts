// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { normalSearchFixture } from "./fixtures/search-fixtures";

let listener: ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean) | undefined;
const sent: unknown[] = [];
const sendMessage = vi.fn(async (message: unknown) => { sent.push(message); return { ok: true }; });

beforeAll(async () => {
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: { addListener(callback: typeof listener) { listener = callback; } },
      sendMessage,
    },
  });
  const nativeAttachShadow = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init) {
    return nativeAttachShadow.call(this, { ...init, mode: "open" });
  });
  await import("../src/overlay");
});

function keydown(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  input.dispatchEvent(event);
  return event;
}

function openOverlay(sessionId = "session-1") {
  listener?.({
    kind: "peek/init",
    sessionId,
    sourceTabId: 1,
    sourceWindowId: 1,
    model: {
      status: "ready",
      tabs: [
        { id: 2, windowId: 2, title: "Orion retry", url: "https://github.com/acme/orion/pull/2", lastAccessed: 20, current: false },
        { id: 1, windowId: 1, title: "Source", url: "https://source.test", lastAccessed: 30, current: true },
      ],
    },
  }, {}, () => undefined);
  const host = document.querySelector<HTMLElement>("#peek-extension-host")!;
  const root = host.shadowRoot!;
  return { host, root, input: root.querySelector<HTMLInputElement>("input")! };
}

describe("ordinary-page overlay", () => {
  it("appends a coherent populated composition and focuses the input on first reveal", () => {
    const { root, input } = openOverlay();
    expect(root.querySelector("style")?.textContent).toContain("place-items: center");
    expect(root.querySelector("style")?.textContent).not.toContain("place-items: start center");
    expect(root.querySelector("style")?.textContent).toContain("height: min(240px, calc(100vh - 48px))");
    expect(root.querySelector("style")?.textContent).toContain("height: calc(100% - 58px)");
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(root.textContent).toContain("Orion retry");
    expect(root.textContent).toContain("github.com/acme/orion/pull/2");
    expect(root.activeElement).toBe(input);
  });

  it("preserves a discriminating loading-state query, caret, focus, filtering and commit when the model arrives", async () => {
    listener?.({
      kind: "peek/init", sessionId: "session-loading", sourceTabId: 1, sourceWindowId: 1,
      model: { status: "loading", tabs: [] },
    }, {}, () => undefined);
    const host = document.querySelector<HTMLElement>("#peek-extension-host")!;
    const root = host.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>("input")!;
    expect(root.textContent).toContain("Loading open tabs");

    input.value = "github";
    input.setSelectionRange(6, 6);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    listener?.({
      kind: "peek/model", sessionId: "session-loading",
      model: {
        status: "ready",
        tabs: [
          { id: 2, windowId: 2, title: "Orion retry", url: "https://github.com/acme/orion/pull/2", lastAccessed: 20, current: false },
          { id: 1, windowId: 1, title: "Source", url: "https://source.test", lastAccessed: 30, current: true },
        ],
      },
    }, {}, () => undefined);

    expect(input.value).toBe("github");
    expect(input.selectionStart).toBe(6);
    expect(root.activeElement).toBe(input);
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(root.textContent).toContain("Orion retry");
    expect(root.textContent).not.toContain("Source");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(sent).toContainEqual({ kind: "peek/commit", sessionId: "session-loading", targetTabId: 2, targetWindowId: 2 });
  });

  it("selects the known previous tab when a loading model becomes ready", () => {
    listener?.({
      kind: "peek/init", sessionId: "session-previous", sourceTabId: 2, sourceWindowId: 20,
      model: { status: "loading", tabs: [] },
    }, {}, () => undefined);
    const host = document.querySelector<HTMLElement>("#peek-extension-host")!;
    const root = host.shadowRoot!;
    listener?.({
      kind: "peek/model", sessionId: "session-previous",
      model: {
        status: "ready",
        tabs: [
          { id: 2, windowId: 20, title: "Current B", url: "https://b.test", lastAccessed: 300, current: true, previous: false },
          { id: 3, windowId: 20, title: "Recent C", url: "https://c.test", lastAccessed: 400, current: false, previous: false },
          { id: 1, windowId: 10, title: "Previous A", url: "https://a.test", lastAccessed: 100, current: false, previous: true },
        ],
      },
    }, {}, () => undefined);

    const selected = root.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    expect(selected?.textContent).toContain("Previous A");
    expect(root.querySelector("input")?.getAttribute("aria-activedescendant")).toBe("peek-tab-1");
  });

  it("ignores model updates for another session through the runtime listener", () => {
    const { root, input } = openOverlay("session-current");
    input.value = "orion";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const before = root.textContent;
    const acknowledge = vi.fn();

    listener?.({
      kind: "peek/model", sessionId: "session-other",
      model: { status: "error", tabs: [], message: "Wrong session" },
    }, {}, acknowledge);

    expect(root.textContent).toBe(before);
    expect(root.textContent).not.toContain("Wrong session");
    expect(input.value).toBe("orion");
    expect(acknowledge).toHaveBeenCalledWith({ ok: true });
  });

  it("rejects a malformed model through the runtime listener without mutation or success acknowledgement", () => {
    const { root, input } = openOverlay("session-malformed");
    input.value = "orion";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const before = root.textContent;
    const acknowledge = vi.fn();

    expect(() => listener?.({
      kind: "peek/model", sessionId: "session-malformed",
      model: { status: "ready", tabs: [{ id: "not-a-number" }] },
    }, {}, acknowledge)).not.toThrow();

    expect(root.textContent).toBe(before);
    expect(input.value).toBe("orion");
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("routes imperfect-clue input through ordered rows, reconciles a missing highlight, and commits the exact visible target", async () => {
    const sessionId = "session-search-path";
    listener?.({
      kind: "peek/init", sessionId, sourceTabId: 30, sourceWindowId: 1,
      model: { status: "ready", tabs: normalSearchFixture },
    }, {}, () => undefined);
    const host = document.querySelector<HTMLElement>("#peek-extension-host")!;
    const root = host.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>("input")!;
    const visibleIds = () => Array.from(root.querySelectorAll<HTMLElement>('[role="option"]')).map((row) => Number(row.id.replace("peek-tab-", "")));

    input.value = "sched rtry";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(visibleIds().slice(0, 2)).toEqual([4, 1]);
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-4");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-1");

    input.value = "postmortem";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-23");

    input.value = "github auth 880";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(visibleIds()[0]).toBe(11);
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-11");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(sent).toContainEqual({ kind: "peek/commit", sessionId, targetTabId: 11, targetWindowId: 2 });
  });

  it("refreshes a misleading partial highlight for pasted and character-by-character stronger queries before Enter", async () => {
    const rankedTabs = [
      { id: 401, windowId: 1, title: "Orion retry fix", url: "https://github.com/acme/orion/pull/41", lastAccessed: 1, current: false },
      { id: 402, windowId: 1, title: "Atlas retry notes", url: "https://github.com/acme/atlas/pull/42", lastAccessed: 20, current: false, previous: true },
      { id: 499, windowId: 1, title: "Current notes", url: "https://fixture.test/source", lastAccessed: 99, current: true },
    ];

    for (const [query, incremental] of [["orion retry", false], ["github orion retry", true]] as const) {
      const sessionId = `query-refresh-${incremental ? "incremental" : "paste"}`;
      listener?.({ kind: "peek/init", sessionId, sourceTabId: 499, sourceWindowId: 1, model: { status: "ready", tabs: rankedTabs } }, {}, () => undefined);
      const root = document.querySelector<HTMLElement>("#peek-extension-host")!.shadowRoot!;
      const input = root.querySelector<HTMLInputElement>("input")!;
      expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-402");

      const values = incremental ? Array.from({ length: query.length }, (_, index) => query.slice(0, index + 1)) : [query];
      for (const value of values) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }

      const orderedIds = Array.from(root.querySelectorAll<HTMLElement>('[role="option"]')).map((row) => row.id);
      expect(orderedIds[0]).toBe("peek-tab-401");
      expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-401");
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
      expect(sent).toContainEqual({ kind: "peek/commit", sessionId, targetTabId: 401, targetWindowId: 1 });
    }
  });

  it("preserves a manual highlight on same-query model delivery and reconciles it when removed", () => {
    const sessionId = "same-query-reconciliation";
    const rankedTabs = [
      { id: 401, windowId: 1, title: "Orion retry fix", url: "https://github.com/acme/orion/pull/41", lastAccessed: 30, current: false },
      { id: 402, windowId: 1, title: "Orion retry notes", url: "https://github.com/acme/orion/pull/42", lastAccessed: 20, current: false },
    ];
    listener?.({ kind: "peek/init", sessionId, sourceTabId: 499, sourceWindowId: 1, model: { status: "ready", tabs: rankedTabs } }, {}, () => undefined);
    const root = document.querySelector<HTMLElement>("#peek-extension-host")!.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.value = "orion retry";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-402");

    listener?.({ kind: "peek/model", sessionId, model: { status: "ready", tabs: rankedTabs } }, {}, () => undefined);
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-402");
    listener?.({ kind: "peek/model", sessionId, model: { status: "ready", tabs: rankedTabs.slice(0, 1) } }, {}, () => undefined);
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-401");
  });

  it("filters, moves highlight, and commits only on Enter", async () => {
    const before = sent.length;
    const { root, input } = openOverlay("session-2");
    input.value = "orion";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(sent.slice(before)).toEqual([]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(sent.slice(before)).toEqual([]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(sent).toContainEqual({ kind: "peek/commit", sessionId: "session-2", targetTabId: 2, targetWindowId: 2 });
  });

  it("keeps digits as query text in typing mode and supports a lossless Tab selection-mode round trip", () => {
    const { root, input } = openOverlay("session-mode-roundtrip");
    input.value = "orion 2481";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.setSelectionRange(2, 9, "backward");

    expect(keydown(input, "Tab").defaultPrevented).toBe(true);
    expect(root.querySelector<HTMLElement>(".palette")?.dataset.mode).toBe("selection");
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe("orion 2481");
    expect(root.querySelector(".mode")?.textContent).toContain("Select");

    expect(keydown(input, "Tab").defaultPrevented).toBe(true);
    expect(root.querySelector<HTMLElement>(".palette")?.dataset.mode).toBe("typing");
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe("orion 2481");
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(9);
    expect(input.selectionDirection).toBe("backward");
    expect(root.activeElement).toBe(input);
  });

  it("routes j/k, arrows and visible numeric choices through real DOM events without activating on highlight", async () => {
    const before = sent.length;
    const { root, input } = openOverlay("session-selection-keys");
    const geometry = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("results")) return { top: 0, bottom: 120, height: 120 } as DOMRect;
      if (this.getAttribute("role") === "option") {
        const index = this.id === "peek-tab-2" ? 0 : 1;
        return { top: index * 56, bottom: (index + 1) * 56, height: 56 } as DOMRect;
      }
      return { top: 0, bottom: 0, height: 0 } as DOMRect;
    });
    keydown(input, "Tab");
    expect(root.querySelectorAll(".digit")).toHaveLength(2);

    keydown(input, "j");
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-1");
    expect(sent.slice(before)).toEqual([]);
    keydown(input, "k");
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-2");
    keydown(input, "ArrowDown");
    expect(root.querySelector<HTMLElement>('[aria-selected="true"]')?.id).toBe("peek-tab-1");

    keydown(input, "2");
    await Promise.resolve();
    expect(sent.slice(before)).toEqual([{ kind: "peek/commit", sessionId: "session-selection-keys", targetTabId: 1, targetWindowId: 1 }]);
    geometry.mockRestore();
  });

  it("commits the row reached by Tab, j and Enter through the production event route", async () => {
    const before = sent.length;
    const { input } = openOverlay("session-tab-j-enter");
    keydown(input, "Tab");
    keydown(input, "j");
    keydown(input, "Enter");
    await Promise.resolve();

    expect(sent.slice(before)).toEqual([{ kind: "peek/commit", sessionId: "session-tab-j-enter", targetTabId: 1, targetWindowId: 1 }]);
  });

  it("maps digits to the rows visible now and never retains stale or missing numeric targets", async () => {
    const before = sent.length;
    const { root, input } = openOverlay("session-visible-digits");
    keydown(input, "Tab");
    const list = root.querySelector<HTMLElement>(".results")!;
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(root.querySelectorAll(".digit")).toHaveLength(0);
    keydown(input, "1");
    await Promise.resolve();
    expect(sent.slice(before)).toEqual([]);
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 56, height: 56 } as DOMRect);
    vi.spyOn(rows[0]!, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 56, height: 56 } as DOMRect);
    vi.spyOn(rows[1]!, "getBoundingClientRect").mockReturnValue({ top: 56, bottom: 112, height: 56 } as DOMRect);
    list.dispatchEvent(new Event("scroll"));
    expect(rows[0]?.querySelector(".digit")?.textContent).toBe("1");
    expect(rows[1]?.querySelector(".digit")).toBeNull();

    keydown(input, "2");
    await Promise.resolve();
    expect(sent.slice(before)).toEqual([]);

    vi.mocked(rows[0]!.getBoundingClientRect).mockReturnValue({ top: -55, bottom: 1, height: 56 } as DOMRect);
    vi.mocked(rows[1]!.getBoundingClientRect).mockReturnValue({ top: 0, bottom: 56, height: 56 } as DOMRect);
    list.dispatchEvent(new Event("scroll"));
    expect(rows[0]?.querySelector(".digit")).toBeNull();
    expect(rows[1]?.querySelector(".digit")?.textContent).toBe("1");
    keydown(input, "1");
    await Promise.resolve();
    expect(sent.slice(before)).toEqual([{ kind: "peek/commit", sessionId: "session-visible-digits", targetTabId: 1, targetWindowId: 1 }]);
  });

  it("leaves modified chords unowned instead of treating them as selection commands", () => {
    const before = sent.length;
    const { input } = openOverlay("session-modified-keys");
    keydown(input, "Tab");
    for (const [key, init] of [
      ["1", { ctrlKey: true }],
      ["j", { metaKey: true }],
      ["ArrowDown", { altKey: true }],
      ["Enter", { ctrlKey: true }],
    ] as const) {
      expect(keydown(input, key, init).defaultPrevented).toBe(false);
    }
    expect(sent.slice(before)).toEqual([]);
  });

  it("does not intercept composing keys and leaves Shift+Tab as a non-trapping focus path", () => {
    const before = sent.length;
    const { host, root, input } = openOverlay("session-ime-focus");
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "に" }));
    for (const key of ["Tab", "j", "2", "Enter", "Escape"]) {
      expect(keydown(input, key).defaultPrevented).toBe(false);
    }
    expect(host.isConnected).toBe(true);
    expect(sent.slice(before)).toEqual([]);
    input.value = "に";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "に" }));
    expect(input.value).toBe("に");

    input.setSelectionRange(1, 1);
    keydown(input, "Tab");
    const shiftTab = keydown(input, "Tab", { shiftKey: true });
    expect(shiftTab.defaultPrevented).toBe(false);
    expect(root.querySelector<HTMLElement>(".palette")?.dataset.mode).toBe("selection");
    input.blur();
    expect(root.activeElement).not.toBe(input);
    input.focus();
    keydown(input, "Tab");
    expect(root.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);
  });

  it("clears selectable results after a commit error so hidden rows cannot navigate or recommit", async () => {
    sendMessage.mockImplementationOnce(async (message: unknown) => {
      sent.push(message);
      return { ok: false, error: "Synthetic target failure" };
    });
    const before = sent.length;
    const { root, input } = openOverlay("session-commit-error-keys");
    keydown(input, "Enter");
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toContain("Synthetic target failure");
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(0);

    keydown(input, "ArrowDown");
    keydown(input, "Enter");
    await Promise.resolve();
    expect(sent.slice(before)).toEqual([{ kind: "peek/commit", sessionId: "session-commit-error-keys", targetTabId: 2, targetWindowId: 2 }]);
  });

  it("keeps Escape operable while a commit response is pending and prevents duplicate commits", async () => {
    let resolveCommit!: (response: { ok: true }) => void;
    sendMessage.mockImplementationOnce((message: unknown) => {
      sent.push(message);
      return new Promise((resolve) => { resolveCommit = resolve; });
    });
    const before = sent.length;
    const { host, root, input } = openOverlay("session-pending");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(root.activeElement).toBe(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(sent.slice(before)).toHaveLength(1);

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(host.isConnected).toBe(false);
    expect(sent.slice(before)).toHaveLength(2);
    expect(sent.at(-1)).toEqual({ kind: "peek/cancel", sessionId: "session-pending" });
    resolveCommit({ ok: true });
    await Promise.resolve();
  });

  it("tears down on Escape without a commit and restores prior connected focus", async () => {
    const prior = document.createElement("button");
    document.body.append(prior);
    prior.focus();
    const before = sent.length;
    const { host, input } = openOverlay("session-3");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await Promise.resolve();
    expect(host.isConnected).toBe(false);
    expect(document.activeElement).toBe(prior);
    expect(sent.slice(before)).toEqual([{ kind: "peek/cancel", sessionId: "session-3" }]);
  });

  it("cancels on backdrop pointerdown without sending a commit or activating a target", async () => {
    const before = sent.length;
    const { host, root } = openOverlay("session-backdrop");
    const backdrop = root.querySelector<HTMLElement>(".backdrop")!;
    backdrop.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await Promise.resolve();

    expect(host.isConnected).toBe(false);
    expect(sent.slice(before)).toEqual([{ kind: "peek/cancel", sessionId: "session-backdrop" }]);
    expect(sent.slice(before).some((message) => typeof message === "object" && message !== null && "kind" in message && message.kind === "peek/commit")).toBe(false);
  });

  it("keeps a deliberate error state focused and cancellable", () => {
    listener?.({
      kind: "peek/init", sessionId: "session-error", sourceTabId: 1, sourceWindowId: 1,
      model: { status: "error", tabs: [], message: "Tab metadata unavailable." },
    }, {}, () => undefined);
    const host = document.querySelector<HTMLElement>("#peek-extension-host")!;
    const root = host.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>("input")!;
    expect(root.textContent).toContain("Tab metadata unavailable.");
    expect(root.activeElement).toBe(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(host.isConnected).toBe(false);
  });

  it("does not reopen a session after dismissal", () => {
    const { host } = openOverlay("session-4");
    listener?.({ kind: "peek/dismiss", sessionId: "session-4" }, {}, () => undefined);
    expect(host.isConnected).toBe(false);
    listener?.({
      kind: "peek/init", sessionId: "session-4", sourceTabId: 1, sourceWindowId: 1,
      model: { status: "ready", tabs: [] },
    }, {}, () => undefined);
    expect(document.querySelector("#peek-extension-host")).toBeNull();
  });
});
