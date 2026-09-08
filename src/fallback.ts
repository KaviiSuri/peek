import { installPaletteRuntime } from "./palette";
import { decodeInitMessage } from "./shared/overlay-protocol";

const sessionId = decodeURIComponent(location.hash.slice(1));
const controller = installPaletteRuntime((message, sender) =>
  sender.id === chrome.runtime.id && sender.tab === undefined &&
  typeof message === "object" && message !== null && "sessionId" in message && message.sessionId === sessionId,
  () => window.close(),
  false, // This page owns focus only after presentation; see ownedFocus below.
);

async function start(): Promise<void> {
  if (!sessionId) {
    window.close();
    return;
  }
  const readinessDeadline = setTimeout(() => window.close(), 10_000);
  const response: unknown = await chrome.runtime.sendMessage({ kind: "peek/fallback-ready", sessionId }).catch(() => undefined);
  clearTimeout(readinessDeadline);
  const init = decodeInitMessage(response);
  if (!init || init.sessionId !== sessionId) {
    window.close();
    return;
  }
  controller.init(init);
  await chrome.runtime.sendMessage({ kind: "peek/fallback-mounted", sessionId }).catch(() => undefined);
}

let ownedFocus = false;
window.addEventListener("focus", () => { ownedFocus = true; });
window.addEventListener("blur", () => {
  if (ownedFocus) {
    void chrome.runtime.sendMessage({ kind: "peek/cancel", sessionId }).catch(() => undefined);
    window.close();
  }
});

void start();
