import { describe, expect, it, vi } from "vitest";
import { registerBackground } from "../src/background/wiring";
import type { BackgroundApp } from "../src/background/app";

function setup() {
  let actionListener: ((tab: chrome.tabs.Tab) => void) | undefined;
  let messageListener: ((message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | undefined) | undefined;
  const app: BackgroundApp = {
    invoke: vi.fn(async () => ({ sessionId: "s", model: { status: "ready" as const, tabs: [] } })),
    commit: vi.fn(async () => ({ ok: true as const })),
    cancel: vi.fn(),
  };
  registerBackground({
    onActionClicked: { addListener(listener) { actionListener = listener; } },
    onMessage: { addListener(listener) { messageListener = listener as typeof messageListener; } },
  }, app);
  return { app, actionListener: () => actionListener!, messageListener: () => messageListener! };
}

describe("synchronous MV3 wiring", () => {
  it("registers action and message listeners before asynchronous work", () => {
    const wired = setup();
    expect(wired.actionListener()).toBeTypeOf("function");
    expect(wired.messageListener()).toBeTypeOf("function");
  });

  it("routes the action click used by both the icon and reserved _execute_action command", () => {
    const wired = setup();
    wired.actionListener()({ id: 7, windowId: 8, incognito: false } as chrome.tabs.Tab);
    expect(wired.app.invoke).toHaveBeenCalledWith({ id: 7, windowId: 8 });
  });

  it("decodes commit messages and keeps malformed messages outside the app", () => {
    const wired = setup();
    const sendResponse = vi.fn();
    expect(wired.messageListener()({ kind: "wrong" }, {}, sendResponse)).toBe(false);
    expect(wired.app.commit).not.toHaveBeenCalled();
    expect(wired.messageListener()({ kind: "peek/commit", sessionId: "s", targetTabId: 2, targetWindowId: 3 }, { tab: { id: 1 } as chrome.tabs.Tab }, sendResponse)).toBe(true);
    expect(wired.app.commit).toHaveBeenCalledWith(expect.objectContaining({ targetTabId: 2, targetWindowId: 3 }), 1);
  });
});
