// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { createPaletteController } from "../src/palette";

it("keeps typing available below one-row height without hidden commits, then restores the same selection", async () => {
  const height = Object.getOwnPropertyDescriptor(window, "innerHeight")!;
  const attach = Element.prototype.attachShadow;
  const shadowSpy = vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, options) {
    return attach.call(this, { ...options, mode: "open" });
  });
  const sendMessage = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  const controller = createPaletteController();
  const resize = (value: number) => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value });
    window.dispatchEvent(new Event("resize"));
  };
  try {
    resize(74);
    controller.init({ kind: "peek/init", sessionId: "tiny", sourceTabId: 1, sourceWindowId: 10, model: { status: "ready", tabs: [
      { id: 1, windowId: 10, title: "Settings", url: "chrome://settings/", current: true, lastAccessed: 1 },
      { id: 2, windowId: 20, title: "Orion", url: "https://github.com/orion", current: false, lastAccessed: 2 },
    ] } });
    const root = document.querySelector("#peek-extension-host")!.shadowRoot!;
    const input = root.querySelector("input")!;
    const list = root.querySelector("ul")!;
    input.value = "orion";
    input.dispatchEvent(new Event("input"));
    input.setSelectionRange(1, 4, "backward");
    const key = (value: string) => input.dispatchEvent(new KeyboardEvent("keydown", { key: value, cancelable: true }));
    resize(60);
    expect(list.hidden).toBe(true);
    expect(input.readOnly).toBe(false);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    expect(root.querySelector(".count")?.textContent).toBe("Resize to select");
    key("Enter");
    key("Tab");
    key("1");
    root.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent("pointerdown", { cancelable: true }));
    expect(sendMessage).not.toHaveBeenCalled();
    key("Tab");
    resize(74);
    expect(list.hidden).toBe(false);
    expect(input.getAttribute("aria-activedescendant")).toBe("peek-tab-2");
    expect([input.value, input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual(["orion", 1, 4, "backward"]);
    key("Enter");
    await Promise.resolve();
    expect(sendMessage).toHaveBeenCalledWith({ kind: "peek/commit", sessionId: "tiny", targetTabId: 2, targetWindowId: 20 });
  } finally {
    controller.dismiss("tiny");
    Object.defineProperty(window, "innerHeight", height);
    shadowSpy.mockRestore();
    vi.unstubAllGlobals();
  }
});
