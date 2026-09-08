import { afterEach, describe, expect, it, vi } from "vitest";
import { withBrowserFavicons } from "../src/background/favicons";
import { isSafeFavicon } from "../src/shared/favicon";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const tab = { id: 1, windowId: 2, title: "Orion", url: "https://github.com/acme/orion", favIconUrl: "https://unrelated.test/private.png", lastAccessed: 0, current: false };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const pngBytes = (length: number) => { const bytes = new Uint8Array(length); bytes.set(png); return bytes; };

describe("worker favicon request boundary", () => {
  it('enforces decoded renderer bytes including equal-length base64 padding boundaries', () => {
    const data = (length: number) => `data:image/png;base64,${Buffer.from(pngBytes(length)).toString('base64')}`;
    expect(data(32768).length).toBe(data(32769).length);
    expect(isSafeFavicon(data(32768))).toBe(true);
    expect(isSafeFavicon(data(32769))).toBe(false);
    expect(isSafeFavicon(data(33000))).toBe(false);
    expect(isSafeFavicon('data:image/png;base64,A')).toBe(false);
  });

  it.each([32768, 32769])('bounds PNG-signature-bearing worker bytes at 32KiB: %s', async size => {
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://peek/${path}` } });
    vi.stubGlobal('fetch', async () => new Response(pngBytes(size), { headers: { 'content-type': 'image/png' } }));
    const result = await withBrowserFavicons([tab]);
    expect(result[0]?.favIconUrl !== undefined).toBe(size === 32768);
  });

  it('retains all 101 candidates but reads only the first 100 icons', async () => {
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://peek/${path}` } });
    const fetcher = vi.fn(async () => new Response(png));
    vi.stubGlobal('fetch', fetcher);
    const tabs = Array.from({ length: 101 }, (_, id) => ({ ...tab, id, url: `${tab.url}?tab=${id}` }));
    const result = await withBrowserFavicons(tabs);
    expect(result.map(({ id, url, title }) => ({ id, url, title }))).toEqual(tabs.map(({ id, url, title }) => ({ id, url, title })));
    expect(fetcher).toHaveBeenCalledTimes(100);
    expect(isSafeFavicon(result[99]?.favIconUrl)).toBe(true);
    expect(result[100]?.favIconUrl).toBeUndefined();
  });

  it('never exceeds six in-flight reads and settles every read', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://peek/${path}` } });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let active = 0, maximum = 0;
    const fetcher = vi.fn(async () => { active++; maximum = Math.max(maximum, active); await gate; active--; return new Response(png); });
    vi.stubGlobal('fetch', fetcher);
    const work = withBrowserFavicons(Array.from({ length: 13 }, (_, id) => ({ ...tab, id })));
    release();
    await work;
    expect(maximum).toBeLessThanOrEqual(6);
    expect(fetcher).toHaveBeenCalledTimes(13);
    expect(active).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts outstanding reads at one second and settles cleanup without a test timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://peek/${path}` } });
    const signals: AbortSignal[] = [], rejectors: Array<(error: Error) => void> = [];
    vi.stubGlobal('fetch', (_url: URL, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = options.signal!;
      signals.push(signal); rejectors.push(reject);
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    let settled = false;
    const work = withBrowserFavicons(Array.from({ length: 6 }, (_, id) => ({ ...tab, id }))).then(value => { settled = true; return value; });
    let atDeadline: { aborted: boolean[]; settled: boolean } | undefined;
    try {
      await vi.advanceTimersByTimeAsync(999);
      expect(signals).toHaveLength(6);
      expect(signals.every(signal => !signal.aborted)).toBe(true);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      atDeadline = { aborted: signals.map(signal => signal.aborted), settled };
    } finally {
      // Mutated/missing deadlines must still release their deferred fetches.
      for (const reject of rejectors) reject(new Error('test cleanup'));
      await work;
    }
    expect(atDeadline).toEqual({ aborted: [true, true, true, true, true, true], settled: true });
    expect((await work).every(candidate => candidate.favIconUrl === undefined)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

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
      return new Response(kind === "oversize" ? pngBytes(33000) : kind === "not-png" ? new Uint8Array(10) : png,
        { headers: { "content-type": kind === "svg" ? "image/svg+xml" : "image/png" } });
    });
    expect((await withBrowserFavicons([tab]))[0]?.favIconUrl).toBeUndefined();
  });
});
