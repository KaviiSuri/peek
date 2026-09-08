import { describe, expect, it } from "vitest";
import { presentationForUrl } from "../src/background/restricted-surface";

describe("restricted surface classification", () => {
  it.each([
    "chrome://settings/",
    "chrome://newtab/",
    "chrome-untrusted://new-tab-page/",
    "devtools://devtools/bundled/inspector.html",
    "view-source:https://example.test/",
    "chrome-extension://other-extension/page.html",
    "https://chromewebstore.google.com/detail/example/id",
    "https://chrome.google.com/webstore/detail/example/id",
  ])("uses fallback for a known non-injectable surface: %s", (url) => {
    expect(presentationForUrl(url)).toBe("fallback");
  });

  it.each([
    "https://example.test/path",
    "http://127.0.0.1:8000/fixture",
    "https://github.com/acme/project",
    "https://chrome.google.com/enterprise/",
    "https://chrome.google.com/webstore-not-a-store/",
    "https://chromewebstore.google.com.unrelated.test/",
  ])("keeps ordinary pages on the overlay path: %s", (url) => {
    expect(presentationForUrl(url)).toBe("overlay");
  });

  it("keeps malformed or unclassified URLs on the visible-error path", () => {
    expect(presentationForUrl("https://example.test/chrome/settings")).toBe("overlay");
    expect(presentationForUrl("malformed metadata")).toBe("overlay");
    expect(presentationForUrl(undefined)).toBe("overlay");
    expect(presentationForUrl("file:///tmp/fixture.html")).toBe("overlay");
  });
});
