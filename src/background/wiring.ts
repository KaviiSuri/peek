import type { BackgroundApp, FallbackSender } from "./app";
import {
  CancelMessageSchema,
  CommitMessageSchema,
  FallbackMountedMessageSchema,
  FallbackReadyMessageSchema,
  decodeUnknown,
} from "../shared/model";

export interface BackgroundEvents {
  readonly onActionClicked: Pick<chrome.events.Event<(tab: chrome.tabs.Tab) => void>, "addListener">;
  readonly onMessage: Pick<typeof chrome.runtime.onMessage, "addListener">;
  readonly onTabActivated: Pick<typeof chrome.tabs.onActivated, "addListener">;
  readonly onTabRemoved: Pick<typeof chrome.tabs.onRemoved, "addListener">;
  readonly onWindowFocusChanged: Pick<typeof chrome.windows.onFocusChanged, "addListener">;
  readonly onWindowRemoved: Pick<typeof chrome.windows.onRemoved, "addListener">;
}

function fallbackSender(sender: chrome.runtime.MessageSender): FallbackSender {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  const url = sender.url ?? sender.tab?.url;
  return {
    ...(tabId === undefined ? {} : { tabId }),
    ...(windowId === undefined ? {} : { windowId }),
    ...(url === undefined ? {} : { url }),
    ...(sender.frameId === undefined ? {} : { frameId: sender.frameId }),
    ...(sender.documentId === undefined ? {} : { documentId: sender.documentId }),
  };
}

export function registerBackground(
  events: BackgroundEvents,
  app: BackgroundApp,
  reportInvocation: (tabId: number, failed: boolean) => void = () => undefined,
): void {
  events.onActionClicked.addListener((tab) => {
    if (tab.id === undefined || tab.windowId === undefined || tab.incognito) return;
    const tabId = tab.id;
    void app.invoke({ id: tabId, windowId: tab.windowId, ...(tab.url === undefined ? {} : { url: tab.url }) }).then(() => {
      reportInvocation(tabId, false);
    }, (error: unknown) => {
      console.error("Peek invocation failed", error);
      reportInvocation(tabId, true);
    });
  });

  events.onTabActivated.addListener(({ tabId, windowId }) => {
    app.observeTabActivation(tabId, windowId);
  });

  events.onWindowFocusChanged.addListener((windowId) => {
    app.observeWindowFocus(windowId);
  });

  events.onWindowRemoved.addListener((windowId) => {
    app.observeWindowRemoved(windowId);
  });

  events.onTabRemoved.addListener((tabId) => {
    app.removeTabFromAttention(tabId);
  });

  events.onMessage.addListener((unknownMessage, sender, sendResponse) => {
    const ready = decodeUnknown(FallbackReadyMessageSchema, unknownMessage);
    if (ready) {
      void app.fallbackReady(ready.sessionId, fallbackSender(sender)).then(sendResponse);
      return true;
    }

    const mounted = decodeUnknown(FallbackMountedMessageSchema, unknownMessage);
    if (mounted) {
      app.fallbackMounted(mounted.sessionId, fallbackSender(sender));
      return false;
    }

    const commit = decodeUnknown(CommitMessageSchema, unknownMessage);
    if (commit) {
      void app.commit(commit, fallbackSender(sender)).then(sendResponse);
      return true;
    }

    const cancel = decodeUnknown(CancelMessageSchema, unknownMessage);
    if (cancel) void app.cancel(cancel, fallbackSender(sender)).catch((error: unknown) => console.error("Peek cancellation failed", error));
    return false;
  });
}
