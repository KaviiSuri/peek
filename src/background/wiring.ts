import type { BackgroundApp } from "./app";
import { CancelMessageSchema, CommitMessageSchema, decodeUnknown } from "../shared/model";

export interface BackgroundEvents {
  readonly onActionClicked: Pick<chrome.events.Event<(tab: chrome.tabs.Tab) => void>, "addListener">;
  readonly onMessage: Pick<typeof chrome.runtime.onMessage, "addListener">;
}

export function registerBackground(events: BackgroundEvents, app: BackgroundApp): void {
  events.onActionClicked.addListener((tab) => {
    if (tab.id === undefined || tab.windowId === undefined || tab.incognito) return;
    void app.invoke({ id: tab.id, windowId: tab.windowId }).catch((error: unknown) => {
      console.error("Peek invocation failed", error);
    });
  });

  events.onMessage.addListener((unknownMessage, sender, sendResponse) => {
    const commit = decodeUnknown(CommitMessageSchema, unknownMessage);
    if (commit) {
      void app.commit(commit, sender.tab?.id).then(sendResponse);
      return true;
    }

    const cancel = decodeUnknown(CancelMessageSchema, unknownMessage);
    if (cancel) app.cancel(cancel, sender.tab?.id);
    return false;
  });
}
