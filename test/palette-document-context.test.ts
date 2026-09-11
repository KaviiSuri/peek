// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createPaletteController } from '../src/palette';

const dispose: (() => void)[] = [];
afterEach(() => { for (const fn of dispose.splice(0).reverse()) fn(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('renders and retains loading input in its supplied iframe document, not the parent', () => {
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(async () => ({ ok: true })) } });
  // jsdom supports real light-DOM iframe documents, but not shadow-contained
  // iframes. qa:keyboard covers that exact production boundary in Chrome.
  const frame = document.createElement('iframe'); document.body.append(frame);
  dispose.push(() => frame.remove());
  const child = frame.contentWindow as Window & typeof globalThis;
  const doc = frame.contentDocument!;
  let shadow: ShadowRoot;
  const attach = child.Element.prototype.attachShadow;
  vi.spyOn(child.Element.prototype, 'attachShadow').mockImplementation(function (this: Element, options) {
    shadow = attach.call(this, options); return shadow;
  });
  const parentKeys = vi.fn(); document.addEventListener('keydown', parentKeys, true);
  dispose.push(() => document.removeEventListener('keydown', parentKeys, true));
  const cancelled = vi.fn();
  const controller = createPaletteController(cancelled, true, doc);
  dispose.push(() => controller.dismiss('child'));
  controller.init({ kind: 'peek/init', sessionId: 'child', sourceTabId: 1, sourceWindowId: 1, model: { status: 'loading', tabs: [] } });
  expect(document.getElementById('peek-extension-host')).toBeNull();
  expect(doc.getElementById('peek-extension-host')!.shadowRoot).toBeNull();
  const input = shadow!.querySelector<HTMLInputElement>('input')!;
  expect(shadow!.activeElement).toBe(input);
  input.value = 's'; input.dispatchEvent(new child.Event('input', { bubbles: true }));
  input.dispatchEvent(new child.KeyboardEvent('keydown', { key: 's', bubbles: true, composed: true }));
  controller.update('child', { status: 'ready', tabs: [] });
  expect(input.value).toBe('s');
  expect(parentKeys).not.toHaveBeenCalled();
  child.dispatchEvent(new child.Event('blur'));
  expect(doc.getElementById('peek-extension-host')).toBeNull();
  expect(cancelled).toHaveBeenCalledWith(false);
});
