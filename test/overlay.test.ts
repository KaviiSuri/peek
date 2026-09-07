// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";

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
