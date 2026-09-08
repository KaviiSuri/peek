import { afterEach, describe, expect, it, vi } from "vitest";
import { withBrowserFavicons } from "../src/background/favicons";
import { isSafeFavicon } from "../src/shared/favicon";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const tab = { id: 1, windowId: 2, title: "Orion", url: "https://github.com/acme/orion", favIconUrl: "https://unrelated.test/private.png", lastAccessed: 0, current: false };
afterEach(() => { vi.unstubAllGlobals(); });

describe("worker favicon request boundary", () => {
  it.each([true, false])("fetches only the extension-owned endpoint and verifies PNG bytes with Content-Type present=%s", async (hasContentType) => {
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://peek/${path}` } });
    const fetcher = vi.fn(async () => new Response(png, hasContentType ? { headers: { "content-type": "image/png" } } : {}));
    vi.stubGlobal("fetch", fetcher);
    const result = await withBrowserFavicons([tab]);
    const [url, options] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("null/_favicon/");
    expect(url.href.startsWith("chrome-extension://peek/_favicon/?")).toBe(true);
    expect(url.searchParams.get("pageUrl")).toBe(tab.url);
    expect(options).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("unrelated.test");
    expect(isSafeFavicon(result[0]?.favIconUrl)).toBe(true);
  });

  it.each(["missing", "svg", "oversize", "not-png"])("falls back without forwarding remote metadata on %s", async (kind) => {
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://peek/${path}` } });
    vi.stubGlobal("fetch", async () => {
      if (kind === "missing") throw new Error("missing");
      return new Response(kind === "oversize" ? new Uint8Array(33000) : kind === "not-png" ? new Uint8Array(10) : png,
        { headers: { "content-type": kind === "svg" ? "image/svg+xml" : "image/png" } });
    });
    expect((await withBrowserFavicons([tab]))[0]?.favIconUrl).toBeUndefined();
  });
});
