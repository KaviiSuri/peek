import { createBackgroundApp } from "./background/app";
import { chromeBrowserAdapter } from "./background/chrome-browser-adapter";
import { registerBackground } from "./background/wiring";

const app = createBackgroundApp(chromeBrowserAdapter);

// MV3 wake listeners must be attached during the service worker's first module evaluation.
registerBackground({
  onActionClicked: chrome.action.onClicked,
  onMessage: chrome.runtime.onMessage,
  onTabActivated: chrome.tabs.onActivated,
  onTabRemoved: chrome.tabs.onRemoved,
  onWindowFocusChanged: chrome.windows.onFocusChanged,
  onWindowRemoved: chrome.windows.onRemoved,
}, app, (_tabId, failed) => {
  void Promise.all([
    chrome.action.setBadgeText({ text: failed ? "!" : "" }),
    chrome.action.setTitle({ title: failed ? "Peek could not complete that action. Open Peek to try again." : "Open Peek" }),
  ]).catch((error: unknown) => console.error("Peek could not update its action status", error));
});
app.start();
