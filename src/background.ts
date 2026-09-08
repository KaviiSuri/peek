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
}, app, (tabId, failed) => {
  void Promise.all([
    chrome.action.setBadgeText({ tabId, text: failed ? "!" : "" }),
    chrome.action.setTitle({ tabId, title: failed ? "Peek could not open here. Try again." : "Open Peek" }),
  ]).catch((error: unknown) => console.error("Peek could not update its action status", error));
});
app.start();
