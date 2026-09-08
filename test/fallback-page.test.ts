// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

it("uses the shipped palette/search/keyboard route in the actual fallback entry and rejects unrelated models", async () => {
  const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
  const attach = Element.prototype.attachShadow;
  const shadowSpy = vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, options) {
    return attach.call(this, { ...options, mode: "open" });
  });
  vi.stubGlobal("location", { hash: "#fallback-test" });
  let listener!: (message: unknown, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void) => boolean;
  let mounted!: () => void;
  const mountedPromise = new Promise<void>((resolve) => { mounted = resolve; });
  const tabs = [
    { id: 1, windowId: 10, title: "Atlas retry", url: "https://github.com/acme/atlas", current: false, previous: true, lastAccessed: 99 },
    { id: 2, windowId: 20, title: "Orion retry", url: "https://github.com/acme/orion", current: false, lastAccessed: 10 },
    { id: 3, windowId: 30, title: "Settings", url: "chrome://settings/", current: true, lastAccessed: 100 },
  ];
  const sendMessage = vi.fn(async (message: { kind: string }) => {
    if (message.kind === "peek/fallback-ready") return {
      kind: "peek/init", sessionId: "fallback-test", sourceTabId: 3, sourceWindowId: 30,
      model: { status: "ready", tabs },
    };
    if (message.kind === "peek/fallback-mounted") mounted();
    return { ok: true };
  });
  vi.stubGlobal("chrome", { runtime: {
    id: "peek", sendMessage, onMessage: { addListener(callback: typeof listener) { listener = callback; } },
  } });
  const key = (input: HTMLInputElement, value: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
    input.dispatchEvent(event);
    return event;
  };
  try {
    await import("../src/fallback");
    await mountedPromise;
    // The browser may deliver blur while the popup is still mounting unfocused.
    window.dispatchEvent(new Event("blur"));
    expect(close).not.toHaveBeenCalled();
    const root = document.querySelector<HTMLElement>("#peek-extension-host")!.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>("input")!;
    const selected = () => root.querySelector('[aria-selected="true"]')?.id;
    expect(selected()).toBe("peek-tab-1");
    input.value = "orion retry";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(selected()).toBe("peek-tab-2");
    input.setSelectionRange(1, 5, "backward");
    key(input, "Tab");
    input.setSelectionRange(0, 0);
    key(input, "Tab");
    expect([input.value, input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual(["orion retry", 1, 5, "backward"]);
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    expect(key(input, "Enter").defaultPrevented).toBe(false);
    expect(key(input, "Escape").defaultPrevented).toBe(false);
    input.dispatchEvent(new CompositionEvent("compositionend"));
    expect(key(input, "1", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(sendMessage.mock.calls.some(([m]) => m.kind === "peek/commit")).toBe(false);
    const ack = vi.fn();
    const stale = { kind: "peek/model", sessionId: "old-session", model: { status: "error", tabs: [], message: "stale" } };
    listener(stale, { id: "peek" }, ack);
    listener({ ...stale, sessionId: "fallback-test" }, { id: "peek", tab: { id: 999 } as chrome.tabs.Tab }, ack);
    expect(ack).not.toHaveBeenCalled();
    expect(selected()).toBe("peek-tab-2");
    key(input, "Enter");
    await Promise.resolve();
    expect(sendMessage).toHaveBeenCalledWith({ kind: "peek/commit", sessionId: "fallback-test", targetTabId: 2, targetWindowId: 20 });
    key(input, "Escape");
    expect(document.querySelector("#peek-extension-host")).toBeNull();
    expect(sendMessage).toHaveBeenCalledWith({ kind: "peek/cancel", sessionId: "fallback-test" });
    expect(close).toHaveBeenCalledOnce();
  } finally {
    close.mockRestore();
    shadowSpy.mockRestore();
    vi.unstubAllGlobals();
  }
});
