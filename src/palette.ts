import { isSafeFavicon } from "./shared/favicon";
import {
  enterSelectionMode,
  highlightedTab,
  initialInteraction,
  moveHighlight,
  navigationDeltaForKey,
  returnToTypingMode,
  selectionDigit,
  setQuery,
  type InteractionState,
  type TextSelection,
} from "./interaction/interaction";
import { meaningfulLocation, searchTabs } from "./search/search";
import type { InitMessage, PeekModel, PeekTab } from "./shared/model";
import { decodeDismissMessage, decodeInitMessage, decodeModelMessage } from "./shared/overlay-protocol";

const CONTROLLER_KEY = "__peekOverlayControllerV1";

const styles = `
  :host { all: initial; color-scheme: light dark; }
  * { box-sizing: border-box; }
  .backdrop {
    position: fixed; inset: 0; z-index: 2147483647;
    display: grid; place-items: center;
    padding: 24px 16px;
    background: color-mix(in srgb, #080a0f 18%, transparent);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .palette {
    width: min(680px, calc(100vw - 32px));
    height: min(240px, calc(100vh - 48px));
    overflow: hidden;
    border: 1px solid light-dark(rgba(20, 26, 38, .13), rgba(255, 255, 255, .12));
    border-radius: 14px;
    background: light-dark(rgba(250, 251, 253, .96), rgba(24, 25, 31, .96));
    color: light-dark(#151821, #f4f4f6);
    box-shadow: 0 26px 80px rgba(6, 9, 18, .28), 0 2px 8px rgba(6, 9, 18, .12);
    backdrop-filter: blur(22px) saturate(1.2);
  }
  .palette:focus-within {
    border-color: light-dark(rgba(54, 91, 231, .48), rgba(146, 165, 255, .52));
    box-shadow: 0 26px 80px rgba(6, 9, 18, .28), 0 2px 8px rgba(6, 9, 18, .12), 0 0 0 3px light-dark(rgba(54, 91, 231, .12), rgba(146, 165, 255, .14));
  }
  .search {
    display: flex; align-items: center; gap: 11px;
    min-height: 58px; padding: 0 18px;
    border-bottom: 1px solid light-dark(rgba(20, 26, 38, .09), rgba(255, 255, 255, .08));
  }
  .search svg { width: 18px; height: 18px; flex: none; color: light-dark(#6e7380, #9296a2); }
  input {
    all: unset; min-width: 0; flex: 1;
    font: 500 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: inherit; caret-color: light-dark(#365be7, #92a5ff);
  }
  input::placeholder { color: light-dark(#626876, #a4a8b2); font-weight: 430; }
  .mode, .count { flex: none; font-size: 11px; font-variant-numeric: tabular-nums; color: light-dark(#626876, #a4a8b2); }
  .mode { padding: 3px 7px; border-radius: 999px; background: light-dark(#edf0f7, #30323a); }
  .results { margin: 0; padding: 7px; height: calc(100% - 58px); overflow: auto; list-style: none; }
  .row {
    min-height: 56px; display: flex; align-items: center; gap: 12px;
    padding: 7px 10px; border-radius: 9px; cursor: default;
    outline: none; position: relative;
  }
  .row[aria-selected="true"] {
    background: light-dark(#e5eaff, #343a54);
    box-shadow: inset 0 0 0 1px light-dark(#c7d0fa, #596688);
  }
  .row[aria-selected="true"]::before {
    content: ""; position: absolute; left: 2px; top: 13px; bottom: 13px;
    width: 3px; border-radius: 3px; background: light-dark(#4264dd, #9aabff);
  }
  .favicon {
    width: 22px; height: 22px; flex: none; border-radius: 6px;
    display: grid; place-items: center; overflow: hidden;
    background: light-dark(#e2e5eb, #3b3d46); color: light-dark(#737986, #a9adb7);
    font-size: 10px; font-weight: 700;
  }
  .favicon img { width: 18px; height: 18px; object-fit: contain; }
  .stack { min-width: 0; flex: 1; display: grid; gap: 2px; }
  .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 19px; font-weight: 610; letter-spacing: -.01em; }
  .path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 11.5px/17px ui-monospace, "SFMono-Regular", Menlo, monospace; color: light-dark(#626876, #a4a8b2); }
  .digit { width: 20px; height: 20px; flex: none; display: grid; place-items: center; border-radius: 6px; font: 650 11px/1 ui-monospace, "SFMono-Regular", Menlo, monospace; color: light-dark(#3d56ad, #c4ceff); background: light-dark(#f4f6ff, #292e42); box-shadow: inset 0 0 0 1px light-dark(#d6ddfa, #4d587d); }
  .state { min-height: 100%; display: grid; place-items: center; padding: 26px; text-align: center; color: light-dark(#686e7a, #a4a8b2); font-size: 13px; line-height: 1.45; }
  .state strong { display: block; margin-bottom: 5px; color: light-dark(#303642, #e4e5e8); font-size: 14px; }
  @media (max-width: 520px) { .backdrop { padding-inline: 8px; } .palette { width: calc(100vw - 16px); } }
  @media (max-width: 360px) {
    .mode { display: none; }
    .search { padding-inline: 10px; gap: 8px; }
    .count { font-size: 10px; }
  }
  @media (max-width: 240px) {
    .search svg { display: none; }
    .count { max-width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
  @media (max-height: 180px) {
    .backdrop { padding-block: 4px; }
    .palette { height: calc(100vh - 8px); border-radius: 8px; }
    .search { min-height: 30px; padding-inline: 8px; gap: 7px; }
    .search svg { width: 14px; height: 14px; }
    input { font-size: 14px; line-height: 20px; }
    .mode { display: none; }
    .count { font-size: 10px; }
    .results { height: calc(100% - 30px); padding: 1px; }
    .row { min-height: 32px; padding: 3px 6px; gap: 7px; border-radius: 5px; }
    .row[aria-selected="true"]::before { top: 6px; bottom: 6px; }
    .stack { gap: 0; }
    .title { font-size: 12px; line-height: 14px; }
    .path { font-size: 10px; line-height: 12px; }
    .favicon, .digit { width: 16px; height: 16px; }
    .favicon img { width: 14px; height: 14px; }
    .state { padding: 4px; font-size: 0; }
    .state strong { margin-bottom: 1px; font-size: 12px; }
  }
`;

export interface PaletteController {
  init(message: InitMessage): void;
  update(sessionId: string, model: PeekModel): void;
  dismiss(sessionId: string): void;
}

export function createPaletteController(onCancel: () => void = () => undefined, watchSourceDeparture = true): PaletteController {
  let activeSessionId: string | undefined;
  let host: HTMLElement | undefined;
  let priorFocus: HTMLElement | null = null;
  let applyModel: ((model: PeekModel) => void) | undefined;
  let disposeSessionListeners: (() => void) | undefined;
  const closedSessions = new Set<string>();
  const rememberClosed = (id: string) => {
    closedSessions.add(id);
    if (closedSessions.size > 128) closedSessions.delete(closedSessions.values().next().value!);
  };

  function teardown(restoreFocus: boolean): void {
    disposeSessionListeners?.();
    disposeSessionListeners = undefined;
    host?.remove();
    host = undefined;
    activeSessionId = undefined;
    applyModel = undefined;
    if (restoreFocus && document.hasFocus() && priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
    priorFocus = null;
  }

  function cancel(restoreFocus = true): void {
    const sessionId = activeSessionId;
    if (!sessionId) return;
    rememberClosed(sessionId);
    teardown(restoreFocus);
    void chrome.runtime.sendMessage({ kind: "peek/cancel", sessionId }).catch(() => undefined);
    onCancel();
  }

  return {
    init(message) {
      if (closedSessions.has(message.sessionId)) return;
      if (host) teardown(false);
      activeSessionId = message.sessionId;
      priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      let model = message.model;

      const nextHost = document.createElement("div");
      nextHost.id = "peek-extension-host";
      const shadow = nextHost.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = styles;
      const backdrop = document.createElement("div");
      backdrop.className = "backdrop";
      const palette = document.createElement("section");
      palette.className = "palette";
      palette.setAttribute("role", "dialog");
      palette.setAttribute("aria-label", "Find an open tab");

      const search = document.createElement("div");
      search.className = "search";
      search.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
      const input = document.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.placeholder = model.status === "error" ? "Tabs unavailable" : "Find a tab by title or URL";
      input.setAttribute("aria-label", "Find a tab by title or URL");
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-controls", "peek-results");
      input.setAttribute("aria-describedby", "peek-mode-hint");
      if (model.status === "error") input.readOnly = true;
      const modeHint = document.createElement("span");
      modeHint.id = "peek-mode-hint";
      modeHint.className = "mode";
      modeHint.setAttribute("role", "status");
      modeHint.setAttribute("aria-live", "polite");
      const count = document.createElement("span");
      count.className = "count";
      search.append(input, modeHint, count);

      const list = document.createElement("ul");
      list.className = "results";
      list.id = "peek-results";
      list.setAttribute("role", "listbox");
      palette.append(search, list);
      backdrop.append(palette);
      shadow.append(style, backdrop);

      let results = searchTabs(model.tabs, "");
      let state: InteractionState = initialInteraction(results);
      let committing = false;
      let composing = false;
      let focusExitTimer: ReturnType<typeof setTimeout> | undefined;

      function stateItem(titleText: string, detailText: string): HTMLLIElement {
        const item = document.createElement("li");
        item.className = "state";
        const content = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = titleText;
        content.append(title, detailText);
        item.append(content);
        return item;
      }

      // 74px = 8px margins + 2px border + 30px input + 2px list padding + 32px row.
      // Below it, keep typing/cancellation usable without offering hidden targets.
      const canShowResults = () => window.innerHeight >= 74;

      function syncAvailableSpace(): void {
        const available = canShowResults();
        list.hidden = !available;
        input.setAttribute("aria-expanded", String(available));
        count.textContent = !available ? "Resize to select" : model.status === "ready" ? `${results.length} ${results.length === 1 ? "tab" : "tabs"}` : "";
        const selected = list.querySelector<HTMLElement>('[aria-selected="true"]');
        if (available && selected) input.setAttribute("aria-activedescendant", selected.id);
        else input.removeAttribute("aria-activedescendant");
      }

      function visibleRows(): HTMLElement[] {
        const rows = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
        const listBounds = list.getBoundingClientRect();
        if (!canShowResults() || listBounds.height <= 0) return [];
        return rows.filter((row) => {
          const bounds = row.getBoundingClientRect();
          return bounds.height > 0 && bounds.top >= Math.max(0, listBounds.top) && bounds.bottom <= Math.min(window.innerHeight, listBounds.bottom);
        }).slice(0, 9);
      }

      function refreshVisibleDigits(): void {
        for (const badge of list.querySelectorAll(".digit")) badge.remove();
        if (state.mode !== "selection") return;
        for (const [index, row] of visibleRows().entries()) {
          const badge = document.createElement("span");
          badge.className = "digit";
          badge.setAttribute("aria-hidden", "true");
          badge.textContent = String(index + 1);
          row.append(badge);
        }
      }

      function syncMode(): void {
        const selecting = state.mode === "selection";
        input.readOnly = selecting || committing || model.status === "error";
        input.setAttribute("aria-readonly", String(input.readOnly));
        input.setAttribute("aria-keyshortcuts", selecting
          ? "Tab ArrowUp ArrowDown J K Enter 1 2 3 4 5 6 7 8 9 Escape"
          : "Tab ArrowUp ArrowDown Enter Escape");
        modeHint.textContent = !canShowResults() ? "Resize window to select" : selecting ? "Select · 1–9 visible" : "Type · Tab to select";
        palette.dataset.mode = state.mode;
      }

      function restoreTypingSelection(): void {
        const selection = state.typingSelection;
        input.focus({ preventScroll: true });
        input.setSelectionRange(selection.start, selection.end, selection.direction);
      }

      function render(): void {
        list.replaceChildren();
        input.removeAttribute("aria-activedescendant");
        syncMode();
        syncAvailableSpace();
        if (model.status === "loading") {
          list.append(stateItem("Loading open tabs", "You can start typing."));
          return;
        }
        if (model.status === "error") {
          list.append(stateItem("Could not load tabs", model.message ?? "Close Peek and try again."));
          return;
        }
        if (results.length === 0) {
          list.append(state.query
            ? stateItem("No matching tabs", "Try a title, site, or URL fragment.")
            : stateItem("No tabs to show", "Press Escape to close Peek."));
          input.removeAttribute("aria-activedescendant");
          return;
        }

        for (const tab of results) {
          const item = document.createElement("li");
          item.className = "row";
          item.id = `peek-tab-${tab.id}`;
          item.setAttribute("role", "option");
          const selected = tab.id === state.highlightedTabId;
          item.setAttribute("aria-selected", String(selected));
          if (selected && canShowResults()) input.setAttribute("aria-activedescendant", item.id);

          const favicon = document.createElement("span");
          favicon.className = "favicon";
          favicon.setAttribute("aria-hidden", "true");
          favicon.textContent = tab.title.slice(0, 1).toLocaleUpperCase() || "•";
          if (isSafeFavicon(tab.favIconUrl)) {
            const image = document.createElement("img");
            image.src = tab.favIconUrl;
            image.alt = "";
            image.addEventListener("load", () => { favicon.textContent = ""; favicon.append(image); }, { once: true });
          }
          const stack = document.createElement("span");
          stack.className = "stack";
          const title = document.createElement("span");
          title.className = "title";
          title.textContent = tab.title;
          const path = document.createElement("span");
          path.className = "path";
          path.textContent = meaningfulLocation(tab.url);
          stack.append(title, path);
          item.append(favicon, stack);
          item.addEventListener("pointermove", () => {
            if (state.highlightedTabId !== tab.id) {
              state = { ...state, highlightedTabId: tab.id };
              render();
            }
          });
          item.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            void commit(tab);
          });
          list.append(item);
        }
        const selectedRow = list.querySelector<HTMLElement>('[aria-selected="true"]');
        if (typeof selectedRow?.scrollIntoView === "function") selectedRow.scrollIntoView({ block: "nearest" });
        refreshVisibleDigits();
        requestAnimationFrame(refreshVisibleDigits);
      }

      const ownsSession = () => activeSessionId === message.sessionId && host === nextHost;
      async function commit(tab: PeekTab | undefined): Promise<void> {
        if (!tab || committing || !activeSessionId || !canShowResults()) return;
        committing = true;
        input.readOnly = true;
        const response: unknown = await chrome.runtime.sendMessage({
          kind: "peek/commit",
          sessionId: activeSessionId,
          targetTabId: tab.id,
          targetWindowId: tab.windowId,
        }).catch(() => ({ ok: false, error: "Peek could not reach its background worker." }));
        if (typeof response === "object" && response !== null && "ok" in response && response.ok === false && ownsSession()) {
          committing = false;
          model = { status: "error", tabs: [], message: "error" in response && typeof response.error === "string" ? response.error : "Peek could not switch tabs." };
          results = [];
          state = setQuery(state, state.query, results);
          render();
          input.focus({ preventScroll: true });
        }
      }

      input.addEventListener("compositionstart", () => { composing = true; });
      input.addEventListener("compositionend", () => { composing = false; });
      input.addEventListener("input", () => {
        if (state.mode !== "typing") return;
        results = searchTabs(model.tabs, input.value);
        state = setQuery(state, input.value, results);
        render();
      });
      input.addEventListener("keydown", (event) => {
        if (composing || event.isComposing || event.keyCode === 229) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
          return;
        }
        const modified = event.altKey || event.ctrlKey || event.metaKey;
        if (event.key === "Tab") {
          if (event.shiftKey || modified) return;
          event.preventDefault();
          event.stopPropagation();
          if (state.mode === "typing") {
            const selection: TextSelection = {
              start: input.selectionStart ?? input.value.length,
              end: input.selectionEnd ?? input.value.length,
              direction: input.selectionDirection ?? "none",
            };
            state = enterSelectionMode(state, selection);
            render();
          } else {
            state = returnToTypingMode(state);
            render();
            restoreTypingSelection();
          }
          return;
        }
        if (model.status !== "ready" || modified) return;
        const navigationDelta = navigationDeltaForKey(state, event.key);
        if (navigationDelta !== undefined) {
          event.preventDefault();
          state = moveHighlight(state, results, navigationDelta);
          render();
          return;
        }
        const digit = selectionDigit(state, event.key);
        if (digit !== undefined) {
          const currentlyVisible = new Set(visibleRows());
          const labelledRows = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')).filter((row) => {
            const badge = row.querySelector<HTMLElement>(".digit");
            return badge !== null && currentlyVisible.has(row);
          });
          const visibleTabs = labelledRows.map((row) => results.find((tab) => row.id === `peek-tab-${tab.id}`)).filter((tab): tab is PeekTab => tab !== undefined);
          const displayedDigits = labelledRows.map((row) => row.querySelector<HTMLElement>(".digit")?.textContent ?? "");
          const choiceIndex = displayedDigits.indexOf(digit);
          const choice = choiceIndex < 0 ? undefined : visibleTabs[choiceIndex];
          if (choice) {
            event.preventDefault();
            void commit(choice);
            return;
          }
        }
        if (event.key === "Enter") {
          event.preventDefault();
          void commit(highlightedTab(state, results));
        }
      });
      list.addEventListener("scroll", refreshVisibleDigits, { passive: true });
      const clearFocusExit = () => {
        if (focusExitTimer !== undefined) clearTimeout(focusExitTimer);
        focusExitTimer = undefined;
      };
      const handleFocusIn = () => { clearFocusExit(); };
      const handleFocusOut = () => {
        clearFocusExit();
        focusExitTimer = setTimeout(() => {
          focusExitTimer = undefined;
          if (host && shadow.activeElement === null) cancel(false);
        }, 0);
      };
      const handleResize = () => {
        syncMode();
        syncAvailableSpace();
        if (canShowResults()) list.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
        refreshVisibleDigits();
      };
      const handleDeparture = () => { if (ownsSession()) cancel(false); };
      const handleVisibility = () => { if (document.visibilityState === "hidden") handleDeparture(); };
      if (watchSourceDeparture) {
        window.addEventListener("blur", handleDeparture);
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pagehide", handleDeparture);
      }
      window.addEventListener("resize", handleResize);
      input.addEventListener("focusin", handleFocusIn);
      input.addEventListener("focusout", handleFocusOut);
      disposeSessionListeners = () => {
        window.removeEventListener("blur", handleDeparture);
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("pagehide", handleDeparture);
        window.removeEventListener("resize", handleResize);
        input.removeEventListener("focusin", handleFocusIn);
        input.removeEventListener("focusout", handleFocusOut);
        clearFocusExit();
      };
      backdrop.addEventListener("pointerdown", (event) => {
        if (event.target === backdrop) cancel();
      });

      applyModel = (nextModel) => {
        model = nextModel;
        input.readOnly = model.status === "error";
        results = searchTabs(model.tabs, state.query);
        state = setQuery(state, state.query, results);
        render();
      };

      render();
      host = nextHost;
      document.documentElement.append(nextHost);
      input.focus({ preventScroll: true });
    },

    update(sessionId, model) {
      if (activeSessionId !== sessionId || closedSessions.has(sessionId)) return;
      applyModel?.(model);
    },

    dismiss(sessionId) {
      if (activeSessionId !== sessionId) return;
      rememberClosed(sessionId);
      teardown(false);
    },
  };
}

export function installPaletteRuntime(
  acceptMessage: (message: unknown, sender: chrome.runtime.MessageSender) => boolean = () => true,
  onCancel: () => void = () => undefined,
  watchSourceDeparture = true,
): PaletteController {
  const globalWindow = window as Window & { [CONTROLLER_KEY]?: PaletteController };
  if (globalWindow[CONTROLLER_KEY]) return globalWindow[CONTROLLER_KEY];

  const controller = createPaletteController(onCancel, watchSourceDeparture);
  globalWindow[CONTROLLER_KEY] = controller;
  chrome.runtime.onMessage.addListener((unknownMessage, sender, sendResponse) => {
    if (!acceptMessage(unknownMessage, sender)) return false;
    const init = decodeInitMessage(unknownMessage);
    if (init) {
      controller.init(init);
      sendResponse({ ok: true });
      return false;
    }
    const model = decodeModelMessage(unknownMessage);
    if (model) {
      controller.update(model.sessionId, model.model);
      sendResponse({ ok: true });
      return false;
    }
    const dismiss = decodeDismissMessage(unknownMessage);
    if (dismiss) {
      controller.dismiss(dismiss.sessionId);
      sendResponse({ ok: true });
    }
    return false;
  });
  return controller;
}
