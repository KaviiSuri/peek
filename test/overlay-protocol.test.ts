import { describe, expect, it } from "vitest";
import { decodeDismissMessage, decodeInitMessage, decodeModelMessage } from "../src/shared/overlay-protocol";

const model = {
  status: "ready" as const,
  tabs: [{ id: 1, windowId: 2, title: "Atlas", url: "https://example.test/atlas", lastAccessed: 3, current: false, previous: true }],
};

describe("overlay protocol decoding", () => {
  it("accepts valid init, model and dismiss messages", () => {
    expect(decodeInitMessage({ kind: "peek/init", sessionId: "s", sourceTabId: 1, sourceWindowId: 2, model })).toBeDefined();
    expect(decodeModelMessage({ kind: "peek/model", sessionId: "s", model })?.model.tabs[0]?.previous).toBe(true);
    expect(decodeDismissMessage({ kind: "peek/dismiss", sessionId: "s" })).toEqual({ kind: "peek/dismiss", sessionId: "s" });
  });

  it("rejects malformed tab models at the runtime boundary", () => {
    expect(decodeModelMessage({ kind: "peek/model", sessionId: "s", model: { ...model, tabs: [{ ...model.tabs[0], id: "1" }] } })).toBeUndefined();
    expect(decodeModelMessage({ kind: "peek/model", sessionId: "s", model: { ...model, tabs: [{ ...model.tabs[0], previous: "yes" }] } })).toBeUndefined();
    expect(decodeInitMessage({ kind: "peek/init", sessionId: "s", sourceTabId: 1, sourceWindowId: 2, model: { status: "unknown", tabs: [] } })).toBeUndefined();
    expect(decodeDismissMessage({ kind: "peek/dismiss", sessionId: 1 })).toBeUndefined();
  });
});
