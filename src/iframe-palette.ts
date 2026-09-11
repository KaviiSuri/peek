import { createPaletteController, type PaletteController } from './palette';

/** An initial about:blank document is a DOM event boundary, unlike Shadow DOM.
 * No remote document, child script, web-accessible asset, or new permission.
 * This isolates existing parent handlers, not an actively hostile same-origin page.
 */
export function createIframePaletteController(onCancel: (restoreFocus: boolean) => void = () => undefined): PaletteController {
  type Surface = { id: string; host: HTMLElement; controller: PaletteController; priorFocus: HTMLElement | null; dispose: () => void };
  let surface: Surface | undefined;
  const closed = new Set<string>();
  const remember = (id: string) => {
    closed.add(id);
    if (closed.size > 128) closed.delete(closed.values().next().value!);
  };
  const teardown = (restoreFocus: boolean) => {
    const old = surface;
    if (!old) return;
    surface = undefined;
    remember(old.id);
    const mayRestore = restoreFocus && document.hasFocus() && document.activeElement === old.host;
    old.dispose();
    old.controller.dismiss(old.id);
    old.host.remove();
    if (mayRestore && old.priorFocus?.isConnected) old.priorFocus.focus({ preventScroll: true });
  };
  const depart = () => {
    if (!surface) return;
    const id = surface.id;
    teardown(false);
    void chrome.runtime.sendMessage({ kind: 'peek/cancel', sessionId: id }).catch(() => undefined);
    onCancel(false);
  };
  return {
    init(message) {
      if (closed.has(message.sessionId)) return;
      teardown(false);
      // The adapter validates the active tab/focused Chrome window. A visible
      // document can lack DOM focus after a commit or while the toolbar owns it.
      if (document.visibilityState === 'hidden') throw new Error('Peek source document is hidden');
      const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const host = document.createElement('div');
      host.id = 'peek-extension-host';
      host.style.setProperty('all', 'initial', 'important');
      host.style.setProperty('position', 'fixed', 'important');
      host.style.setProperty('inset', '0', 'important');
      host.style.setProperty('z-index', '2147483647', 'important');
      const root = host.attachShadow({ mode: 'closed' });
      const frame = document.createElement('iframe');
      frame.title = 'Peek tab switcher';
      frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;display:block;color-scheme:light dark';
      // Leave src unset: create only the synchronous initial about:blank document.
      document.documentElement.append(host);
      root.append(frame);
      const childDocument = frame.contentDocument;
      if (!childDocument) { host.remove(); throw new Error('Peek isolated document is unavailable'); }
      const controller = createPaletteController(restoreFocus => {
        teardown(restoreFocus);
        onCancel(restoreFocus);
      }, true, childDocument);
      const blur = () => { if (!document.hasFocus()) depart(); };
      const visibility = () => { if (document.visibilityState === 'hidden') depart(); };
      const focus = () => { if (surface && document.activeElement !== host) depart(); };
      const dispose = () => {
        window.removeEventListener('blur', blur);
        window.removeEventListener('pagehide', depart);
        document.removeEventListener('visibilitychange', visibility);
        document.removeEventListener('focusin', focus, true);
      };
      surface = { id: message.sessionId, host, controller, priorFocus, dispose };
      try {
        controller.init(message);
        if (surface?.controller !== controller) return;
        // Initial focus transfer into the child can blur the parent Window.
        // Install parent departure listeners after that synchronous transfer.
        window.addEventListener('blur', blur);
        window.addEventListener('pagehide', depart);
        document.addEventListener('visibilitychange', visibility);
        document.addEventListener('focusin', focus, true);
      } catch (error) { teardown(false); throw error; }
    },
    update(sessionId, model) { if (surface?.id === sessionId) surface.controller.update(sessionId, model); },
    dismiss(sessionId) {
      remember(sessionId);
      if (surface?.id === sessionId) teardown(false);
    },
  };
}
