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
  kind: PresentationKind | "pending-file-access";
  readonly init: InitMessage;
  readonly mounted: DeferredBoolean;
  creation?: Promise<FallbackSurface>;
  surface?: FallbackSurface;
  senderDocumentId?: string;
  presentationPhase: "pending" | "visible";
  closingForCommit?: boolean;
  committing?: boolean;
  activatingTarget?: { id: number; windowId: number };
  sourceReturnObserved?: boolean;
  closingTargetWindowId?: number;
  expectedReturnWindowId?: number;
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

  const dismissSession = async (session: Session, closeOverlay = true): Promise<void> => {
    removeSession(session);
    if (session.kind === "overlay") {
      if (closeOverlay) await browser.dismissOverlay(session.source.id, session.id);
      return;
    }
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
      for (const session of sessions.values()) {
        if ((session.kind === "overlay" || session.presentationPhase === "pending" || session.committing) &&
          windowId === session.source.windowId && tabId !== session.source.id &&
          tabId !== session.activatingTarget?.id) {
          void dismissSession(session).catch((error: unknown) => console.error("Peek source-departure cleanup failed", error));
        }
      }
    },
    observeWindowFocus(windowId) {
      attention.observeWindowFocus(windowId);
      for (const session of sessions.values()) {
        if (windowId !== session.expectedReturnWindowId) delete session.expectedReturnWindowId;
        if (windowId === session.surface?.windowId || windowId === session.activatingTarget?.windowId) continue;
        if (session.kind === "overlay" && windowId === session.source.windowId) continue;
        if (session.kind === "fallback" && session.closingForCommit && (windowId === session.source.windowId || windowId === session.closingTargetWindowId)) {
          session.sourceReturnObserved = true;
          continue;
        }
        if (windowId === session.expectedReturnWindowId) {
          delete session.expectedReturnWindowId;
          continue;
        }
        if (session.presentationPhase === "pending" && windowId === session.source.windowId) continue;
        // A newer observed focus departure invalidates even a previously captured
        // focused:true API snapshot. The popup's own focus and commit teardown are
        // expected transitions, but external windows (including NONE) are not.
        void dismissSession(session).catch((error: unknown) => console.error("Peek focus-departure cleanup failed", error));
      }
    },
    removeTabFromAttention(tabId) {
      attention.removeTab(tabId);
      for (const session of sessions.values()) {
        if (session.source.id === tabId) {
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
      const replaced = [...sessions.values()];
      // Register the new owner before awaiting teardown. A concurrent invocation
      // can now expire this one rather than letting an older caller register last.
      const sessionId = crypto.randomUUID();
      let kind = presentationForUrl(source.url);
      const needsFileAccessCheck = /^file:/i.test(source.url ?? "");
      const init: InitMessage = {
        kind: "peek/init",
        sessionId,
        sourceTabId: source.id,
        sourceWindowId: source.windowId,
        model: { status: "loading", tabs: [] },
      };
      const session: Session = { id: sessionId, source, kind: needsFileAccessCheck ? "pending-file-access" : kind, init, mounted: deferredBoolean(), presentationPhase: "pending" };
      sessions.set(sessionId, session);

      try {
        for (const prior of replaced) await dismissSession(prior, prior.source.id !== source.id);
        if (sessions.get(sessionId) !== session) return { sessionId, model: init.model };
        if (needsFileAccessCheck) {
          const allowed = await Effect.runPromise(boundary("read file access capability", () => browser.fileSchemeAccessAllowed()));
          if (sessions.get(sessionId) !== session) return { sessionId, model: init.model };
          kind = presentationForUrl(source.url, allowed);
          session.kind = kind;
        }
        if (kind === "overlay") {
          await Effect.runPromise(boundary("open overlay", () => browser.openOverlay(source, init, () => sessions.get(sessionId) === session)));
          if (sessions.get(sessionId) !== session) return { sessionId, model: init.model };
          session.mounted.resolve(true);
          session.presentationPhase = "visible";
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
          session.presentationPhase = "visible";
        }
      } catch (error) {
        await dismissSession(session, false);
        throw error;
      }

      let model: PeekModel;
      try {
        const tabs = await Effect.runPromise(boundary("list tabs", () => browser.listEligibleTabs(source)));
        if (sessions.get(sessionId) !== session) return { sessionId, model: init.model };
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

      if (session.committing) return { ok: false, error: "Peek is already switching tabs." };
      session.committing = true;
      let target;
      try {
        target = await Effect.runPromise(boundary("revalidate tab", () =>
          browser.revalidateTarget(message.targetTabId, message.targetWindowId),
        ));
      } catch {
        session.committing = false;
        return { ok: false, error: "Peek could not verify that tab." };
      }
      if (!target) {
        session.committing = false;
        return { ok: false, error: "That tab is no longer open." };
      }
      if (sessions.get(message.sessionId) !== session) return { ok: false, error: "Peek session expired." };

      try {
        session.closingForCommit = true;
        session.sourceReturnObserved = false;
        session.closingTargetWindowId = target.windowId;
        delete session.expectedReturnWindowId;
        if (session.kind === "overlay") {
          await Effect.runPromise(boundary("dismiss overlay", () => browser.dismissOverlay(session.source.id, message.sessionId)));
        } else {
          session.closingForCommit = true;
          const returned = await Effect.runPromise(boundary("dismiss fallback", () => browser.dismissFallback(session.surface!.windowId)));
          if (!returned || !returned.focused || (returned.windowId !== session.source.windowId && returned.windowId !== target.windowId)) removeSession(session);
          else if (!session.sourceReturnObserved) session.expectedReturnWindowId = returned.windowId;
        }
        if (sessions.get(message.sessionId) !== session) return { ok: false, error: "Peek session expired." };
        const sourceStillCurrent = target.id === session.source.id &&
          (session.kind === "overlay" || (target.current && target.windowId === session.source.windowId));
        if (!sourceStillCurrent) {
          session.activatingTarget = target;
          session.closingForCommit = false;
          await Effect.runPromise(boundary("activate tab", () => browser.activateTarget(target, () => sessions.get(session.id) === session)));
        }
        if (sessions.get(session.id) !== session) return { ok: false, error: "Peek session expired." };
        removeSession(session);
        return { ok: true };
      } catch {
        if (session.activatingTarget) removeSession(session);
        else {
          session.closingForCommit = false;
          session.committing = false;
        }
        return { ok: false, error: "Peek could not switch to that tab." };
      }
    },

    async cancel(message, senderTabId) {
      const session = sessions.get(message.sessionId);
      if (session && acceptsSender(session, senderTabId)) await dismissSession(session, false);
    },
  };
}
