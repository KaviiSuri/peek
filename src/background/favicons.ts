import type { PeekTab } from "../shared/model";
import { MAX_ICON_BYTES } from "../shared/favicon";

// Read Chrome's extension-owned endpoint, not tab.favIconUrl. No host grant or
// web-accessible resource is needed because only the worker fetches it.
export async function withBrowserFavicons(tabs: readonly PeekTab[]): Promise<readonly PeekTab[]> {
  const output = tabs.map(({ favIconUrl: _remote, ...tab }) => tab as PeekTab);
  const candidates = tabs.map((tab, index) => ({ tab, index }))
    .filter(({ tab }) => tab.favIconUrl && /^https?:/i.test(tab.url)).slice(0, 100);
  if (!candidates.length) return output;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(6, candidates.length) }, async () => {
      while (next < candidates.length && !controller.signal.aborted) {
        const { tab, index } = candidates[next++]!;
        try {
          const url = new URL(chrome.runtime.getURL("_favicon/"));
          url.searchParams.set("pageUrl", tab.url);
          url.searchParams.set("size", "32");
          const response = await fetch(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
          if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/png") continue;
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length > MAX_ICON_BYTES || bytes.length < 8 ||
            ![137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) continue;
          output[index] = { ...output[index]!, favIconUrl: `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}` };
        } catch {
          // Missing/cache-denied/timed-out icons retain the recognisable initial.
        }
      }
    }));
  } finally {
    clearTimeout(timeout);
  }
  return output;
}
