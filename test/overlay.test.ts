// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";

let listener: ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean) | undefined;
const sent: unknown[] = [];

beforeAll(async () => {
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: { addListener(callback: typeof listener) { listener = callback; } },
      sendMessage: vi.fn(async (message: unknown) => { sent.push(message); return { ok: true }; }),
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
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(root.textContent).toContain("Orion retry");
    expect(root.textContent).toContain("github.com/acme/orion/pull/2");
    expect(root.activeElement).toBe(input);
  });

  it("filters, moves highlight, and commits only on Enter", async () => {
    const { root, input } = openOverlay("session-2");
    input.value = "orion";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(sent).toEqual([]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(sent).toEqual([]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(sent).toContainEqual({ kind: "peek/commit", sessionId: "session-2", targetTabId: 2, targetWindowId: 2 });
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
