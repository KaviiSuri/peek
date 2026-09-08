import { Effect } from "effect";
import { createAttentionTracker } from "../attention/attention";
import type { BrowserAdapter, FallbackSurface, InvocationResult, SourceTab } from "./browser-adapter";
import { presentationForUrl, type PresentationKind } from "./restricted-surface";
import type { CancelMessage, CommitMessage, InitMessage, PeekModel } from "../shared/model";

export class BrowserBoundaryError extends Error {
  readonly _tag = "BrowserBoundaryError";

  constructor(readonly operation: string, readonly cause: unknown) {
    super(`${operation} failed`);
  }
}

interface DeferredBoolean {
  readonly promise: Promise<boolean>;
  resolve(value: boolean): void;
}

function deferredBoolean(): DeferredBoolean {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  return { promise, resolve };
}

interface Session {
  readonly id: string;
  readonly source: SourceTab;
  readonly kind: PresentationKind;
  readonly init: InitMessage;
  readonly mounted: DeferredBoolean;
  creation?: Promise<FallbackSurface>;
  surface?: FallbackSurface;
  senderDocumentId?: string;
  closingForCommit?: boolean;
  readinessTimer?: ReturnType<typeof setTimeout>;
  closedWindows?: Set<number>;
}

function boundary<A>(operation: string, run: () => Promise<A>): Effect.Effect<A, BrowserBoundaryError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => new BrowserBoundaryError(operation, cause),
  });
}

export interface FallbackSender {
  readonly tabId?: number;
  readonly windowId?: number;
  readonly url?: string;
  readonly frameId?: number;
  readonly documentId?: string;
}

export interface BackgroundApp {
  start(): void;
  observeTabActivation(tabId: number, windowId: number): void;
  observeWindowFocus(windowId: number): void;
  removeTabFromAttention(tabId: number): void;
  observeWindowRemoved(windowId: number): void;
  invoke(source: SourceTab): Promise<InvocationResult>;
  fallbackReady(sessionId: string, sender: FallbackSender): Promise<InitMessage | undefined>;
  fallbackMounted(sessionId: string, sender: FallbackSender): void;
  commit(message: CommitMessage, sender: number | FallbackSender | undefined): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  cancel(message: CancelMessage, sender: number | FallbackSender | undefined): Promise<void>;
}

export function createBackgroundApp(browser: BrowserAdapter): BackgroundApp {
  const sessions = new Map<string, Session>();
  const attention = createAttentionTracker(browser);

  const acceptsSender = (session: Session, sender: number | FallbackSender | undefined): boolean => {
    const identity = typeof sender === "number" ? { tabId: sender } : sender;
    if (!identity || (identity.frameId !== undefined && identity.frameId !== 0)) return false;
    return session.kind === "overlay"
      ? identity.tabId === session.source.id
      : !!session.surface && validFallbackSender(session, identity, session.surface);
  };

  const removeSession = (session: Session): void => {
    if (sessions.get(session.id) !== session) return;
    sessions.delete(session.id);
    clearTimeout(session.readinessTimer);
    session.mounted.resolve(false);
  };

  const dismissSession = async (session: Session): Promise<void> => {
    removeSession(session);
    if (session.kind === "overlay") return;
    if (session.surface) {
      await browser.dismissFallback(session.surface.windowId);
      return;
    }
  };

  const validFallbackUrl = (session: Session, sender: FallbackSender): boolean => {
    if (!sender.url) return false;
    try {
      const senderUrl = new URL(sender.url);
      const expected = new URL(browser.fallbackPageUrl());
      return senderUrl.protocol === expected.protocol && senderUrl.host === expected.host &&
        senderUrl.pathname === expected.pathname && senderUrl.search === "" &&
        senderUrl.hash === `#${encodeURIComponent(session.id)}` && (sender.frameId === undefined || sender.frameId === 0);
    } catch {
      return false;
    }
  };

  const validFallbackSender = (session: Session, sender: FallbackSender, surface: FallbackSurface): boolean =>
    sender.tabId === surface.tabId && sender.windowId === surface.windowId && validFallbackUrl(session, sender) &&
    (session.senderDocumentId === undefined || sender.documentId === session.senderDocumentId);

  return {
    start() {
      attention.start();
    },
    observeTabActivation(tabId, windowId) {
      attention.observeActivation(tabId, windowId);
    },
    observeWindowFocus(windowId) {
      attention.observeWindowFocus(windowId);
    },
    removeTabFromAttention(tabId) {
      attention.removeTab(tabId);
      for (const session of sessions.values()) {
        if (session.kind === "fallback" && session.source.id === tabId) {
          void dismissSession(session).catch((error: unknown) => console.error("Peek source-close cleanup failed", error));
        }
      }
    },
    observeWindowRemoved(windowId) {
      for (const session of sessions.values()) {
        session.closedWindows?.add(windowId);
        if (session.surface?.windowId === windowId && !session.closingForCommit) removeSession(session);
      }
    },
    async invoke(source) {
      const invokedFallback = [...sessions.values()].find((session) => session.surface?.tabId === source.id);
      if (invokedFallback) {
        await dismissSession(invokedFallback);
        return { sessionId: invokedFallback.id, model: invokedFallback.init.model };
      }
      if (source.url?.startsWith(new URL(".", browser.fallbackPageUrl()).href)) {
        throw new Error("Peek UI is not a user source tab.");
      }
      for (const session of [...sessions.values()]) {
        if (session.source.id === source.id) await dismissSession(session);
      }

      const sessionId = crypto.randomUUID();
      const kind = presentationForUrl(source.url);
      const init: InitMessage = {
        kind: "peek/init",
        sessionId,
        sourceTabId: source.id,
        sourceWindowId: source.windowId,
        model: { status: "loading", tabs: [] },
      };
      const session: Session = { id: sessionId, source, kind, init, mounted: deferredBoolean() };
      sessions.set(sessionId, session);

      try {
        if (kind === "overlay") {
          await Effect.runPromise(boundary("open overlay", () => browser.openOverlay(source, init)));
          session.mounted.resolve(true);
        } else {
          session.closedWindows = new Set();
          session.readinessTimer = setTimeout(() => {
            void dismissSession(session).catch((error: unknown) => console.error("Peek fallback cleanup failed", error));
          }, 10_000);
          const creation = Effect.runPromise(boundary("create fallback", () => browser.createFallback(source, sessionId)));
          session.creation = creation;
          const surface = await creation;
          session.surface = surface;
          if (session.closedWindows.has(surface.windowId)) removeSession(session);
          delete session.closedWindows;
          if (sessions.get(sessionId) !== session) {
            await browser.dismissFallback(surface.windowId);
            return { sessionId, model: init.model };
          }
          if (!await session.mounted.promise || sessions.get(sessionId) !== session) {
            if (sessions.get(sessionId) === session) await dismissSession(session);
            return { sessionId, model: init.model };
          }
          clearTimeout(session.readinessTimer);
          const presented = await browser.presentFallback(source, surface, () => sessions.get(sessionId) === session);
          if (!presented || sessions.get(sessionId) !== session) {
            await dismissSession(session);
            return { sessionId, model: init.model };
          }
        }
      } catch (error) {
        await dismissSession(session);
        throw error;
      }

      let model: PeekModel;
      try {
        const tabs = await Effect.runPromise(boundary("list tabs", () => browser.listEligibleTabs(source)));
        if (kind === "fallback" && sessions.get(sessionId) !== session) return { sessionId, model: init.model };
        const preparedTabs = await Effect.runPromise(boundary("prepare attention", () => attention.prepareTabs(source, tabs)));
        model = { status: "ready", tabs: preparedTabs };
      } catch {
        model = {
          status: "error",
          tabs: [],
          message: "Peek could not read open tabs. Close it and try again.",
        };
      }

      if (sessions.get(sessionId) === session) {
        try {
          const message = { kind: "peek/model" as const, sessionId, model };
          await Effect.runPromise(boundary(`update ${kind}`, () => kind === "overlay"
            ? browser.updateOverlay(source.id, message)
            : browser.updateFallback(message)));
        } catch (error) {
          await dismissSession(session);
          throw error;
        }
      }
      return { sessionId, model };
    },

    async fallbackReady(sessionId, sender) {
      const session = sessions.get(sessionId);
      if (!session || session.kind !== "fallback" || !session.creation || !validFallbackUrl(session, sender)) return undefined;
      const surface = await session.creation.catch(() => undefined);
      if (!surface || sessions.get(sessionId) !== session || !validFallbackSender(session, sender, surface)) return undefined;
      session.surface = surface;
      if (sender.documentId !== undefined) session.senderDocumentId = sender.documentId;
      return session.init;
    },

    fallbackMounted(sessionId, sender) {
      const session = sessions.get(sessionId);
      if (!session || session.kind !== "fallback" || !session.surface) return;
      if (validFallbackSender(session, sender, session.surface)) session.mounted.resolve(true);
    },

    async commit(message, senderTabId) {
      const session = sessions.get(message.sessionId);
      if (!session || !acceptsSender(session, senderTabId)) return { ok: false, error: "Peek session expired." };

      let target;
      try {
        target = await Effect.runPromise(boundary("revalidate tab", () =>
          browser.revalidateTarget(message.targetTabId, message.targetWindowId),
        ));
      } catch {
        return { ok: false, error: "Peek could not verify that tab." };
      }
      if (!target) return { ok: false, error: "That tab is no longer open." };
      if (sessions.get(message.sessionId) !== session) return { ok: false, error: "Peek session expired." };

      try {
        if (session.kind === "overlay") {
          await Effect.runPromise(boundary("dismiss overlay", () => browser.dismissOverlay(session.source.id, message.sessionId)));
        } else {
          session.closingForCommit = true;
          await Effect.runPromise(boundary("dismiss fallback", () => browser.dismissFallback(session.surface!.windowId)));
        }
        if (sessions.get(message.sessionId) !== session) return { ok: false, error: "Peek session expired." };
        removeSession(session);
        const sourceStillCurrent = target.id === session.source.id &&
          (session.kind === "overlay" || (target.current && target.windowId === session.source.windowId));
        if (!sourceStillCurrent) {
          await Effect.runPromise(boundary("activate tab", () => browser.activateTarget(target)));
        }
        return { ok: true };
      } catch {
        session.closingForCommit = false;
        return { ok: false, error: "Peek could not switch to that tab." };
      }
    },

    async cancel(message, senderTabId) {
      const session = sessions.get(message.sessionId);
      if (session && acceptsSender(session, senderTabId)) await dismissSession(session);
    },
  };
}
