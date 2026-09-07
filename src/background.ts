import { createBackgroundApp } from "./background/app";
import { chromeBrowserAdapter } from "./background/chrome-browser-adapter";
import { registerBackground } from "./background/wiring";

const app = createBackgroundApp(chromeBrowserAdapter);

// MV3 wake listeners must be attached during the service worker's first module evaluation.
registerBackground({
  onActionClicked: chrome.action.onClicked,
  onMessage: chrome.runtime.onMessage,
}, app);
