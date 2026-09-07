import { Effect } from "effect";
import type { BrowserAdapter, InvocationResult, SourceTab } from "./browser-adapter";
import type { CancelMessage, CommitMessage, PeekModel } from "../shared/model";

export class BrowserBoundaryError extends Error {
  readonly _tag = "BrowserBoundaryError";

  constructor(readonly operation: string, readonly cause: unknown) {
    super(`${operation} failed`);
  }
}

interface Session {
  readonly source: SourceTab;
}

function boundary<A>(operation: string, run: () => Promise<A>): Effect.Effect<A, BrowserBoundaryError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => new BrowserBoundaryError(operation, cause),
  });
}

export interface BackgroundApp {
  invoke(source: SourceTab): Promise<InvocationResult>;
  commit(message: CommitMessage, senderTabId: number | undefined): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  cancel(message: CancelMessage, senderTabId: number | undefined): void;
}

export function createBackgroundApp(browser: BrowserAdapter): BackgroundApp {
  const sessions = new Map<string, Session>();

  return {
    async invoke(source) {
      for (const [id, session] of sessions) {
        if (session.source.id === source.id) sessions.delete(id);
      }

      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { source });
      try {
        await Effect.runPromise(boundary("open overlay", () => browser.openOverlay(source, {
          kind: "peek/init",
          sessionId,
          sourceTabId: source.id,
          sourceWindowId: source.windowId,
          model: { status: "loading", tabs: [] },
        })));
      } catch (error) {
        sessions.delete(sessionId);
        throw error;
      }

      let model: PeekModel;
      try {
        const tabs = await Effect.runPromise(boundary("list tabs", () => browser.listEligibleTabs(source)));
        model = { status: "ready", tabs };
      } catch {
        model = {
          status: "error",
          tabs: [],
          message: "Peek could not read open tabs. Close it and try again.",
        };
      }

      if (sessions.has(sessionId)) {
        try {
          await Effect.runPromise(boundary("update overlay", () => browser.updateOverlay(source.id, {
            kind: "peek/model",
            sessionId,
            model,
          })));
        } catch (error) {
          sessions.delete(sessionId);
          throw error;
        }
      }
      return { sessionId, model };
    },

    async commit(message, senderTabId) {
      const session = sessions.get(message.sessionId);
      if (!session || senderTabId !== session.source.id) return { ok: false, error: "Peek session expired." };

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
        await Effect.runPromise(boundary("dismiss overlay", () =>
          browser.dismissOverlay(session.source.id, message.sessionId),
        ));
        if (sessions.get(message.sessionId) !== session) return { ok: false, error: "Peek session expired." };
        sessions.delete(message.sessionId);
        if (target.id !== session.source.id) {
          await Effect.runPromise(boundary("activate tab", () => browser.activateTarget(target)));
        }
        return { ok: true };
      } catch {
        return { ok: false, error: "Peek could not switch to that tab." };
      }
    },

    cancel(message, senderTabId) {
      const session = sessions.get(message.sessionId);
      if (session && senderTabId === session.source.id) sessions.delete(message.sessionId);
    },
  };
}
