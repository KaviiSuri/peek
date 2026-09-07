import { Either, Schema } from "effect";
import type { PeekTab } from "../shared/model";
import type { SourceTab } from "../background/browser-adapter";

export interface AttentionIdentity {
  readonly tabId: number;
  readonly windowId: number;
}

export interface AttentionState {
  readonly version: 1;
  readonly current?: AttentionIdentity;
  readonly previous?: AttentionIdentity;
}

const IdentitySchema = Schema.Struct({
  tabId: Schema.Number,
  windowId: Schema.Number,
});

const AttentionStateSchema = Schema.Struct({
  version: Schema.Literal(1),
  current: Schema.optional(IdentitySchema),
  previous: Schema.optional(IdentitySchema),
});

const emptyState: AttentionState = { version: 1 };

function sameIdentity(left: AttentionIdentity | undefined, right: AttentionIdentity | undefined): boolean {
  return left?.tabId === right?.tabId && left?.windowId === right?.windowId;
}

export function decodeAttentionState(value: unknown): AttentionState {
  const decoded = Schema.decodeUnknownEither(AttentionStateSchema)(value);
  if (Either.isLeft(decoded)) return emptyState;
  const state = decoded.right;
  if (sameIdentity(state.current, state.previous)) return { version: 1, ...(state.current ? { current: state.current } : {}) };
  return { version: 1, ...(state.current ? { current: state.current } : {}), ...(state.previous ? { previous: state.previous } : {}) };
}

export function observeAttention(state: AttentionState, next: AttentionIdentity): AttentionState {
  if (sameIdentity(state.current, next)) return state;
  return {
    version: 1,
    current: next,
    ...(state.current ? { previous: state.current } : state.previous ? { previous: state.previous } : {}),
  };
}

export function removeAttentionTab(state: AttentionState, tabId: number): AttentionState {
  const current = state.current?.tabId === tabId ? undefined : state.current;
  const previous = state.previous?.tabId === tabId ? undefined : state.previous;
  if (current === state.current && previous === state.previous) return state;
  return { version: 1, ...(current ? { current } : {}), ...(previous ? { previous } : {}) };
}

export function decorateAttentionTabs(state: AttentionState, tabs: readonly PeekTab[]): { readonly state: AttentionState; readonly tabs: readonly PeekTab[] } {
  const eligible = new Map(tabs.map((tab) => [tab.id, tab.windowId]));
  const current = state.current && eligible.get(state.current.tabId) === state.current.windowId ? state.current : undefined;
  const previous = state.previous && eligible.get(state.previous.tabId) === state.previous.windowId && !sameIdentity(state.previous, current)
    ? state.previous
    : undefined;
  const reconciled: AttentionState = { version: 1, ...(current ? { current } : {}), ...(previous ? { previous } : {}) };
  return {
    state: reconciled,
    tabs: tabs.map((tab) => ({ ...tab, previous: previous?.tabId === tab.id && previous.windowId === tab.windowId })),
  };
}

export interface AttentionAdapter {
  loadAttentionState(): Promise<unknown>;
  saveAttentionState(state: AttentionState): Promise<void>;
  resolveFocusedAttention(windowId?: number, tabId?: number): Promise<AttentionIdentity | undefined>;
}

const WINDOW_ID_NONE = -1;

export interface AttentionTracker {
  start(): void;
  observeActivation(tabId: number, windowId: number): void;
  observeWindowFocus(windowId: number): void;
  removeTab(tabId: number): void;
  prepareTabs(source: SourceTab, tabs: readonly PeekTab[]): Promise<readonly PeekTab[]>;
}

export function createAttentionTracker(adapter: AttentionAdapter): AttentionTracker {
  interface ObservationEvent {
    readonly sequence: number;
    readonly kind: "activation" | "focus";
    status: "pending" | "resolved";
    resolvedOrder?: number;
    candidate?: AttentionIdentity;
    promise: Promise<void>;
  }
  type PendingEvent =
    | ObservationEvent
    | { readonly sequence: number; readonly kind: "remove"; readonly tabId: number; readonly status: "resolved"; readonly resolvedOrder: number; readonly promise: Promise<void> }
    | { readonly sequence: number; readonly kind: "barrier"; readonly status: "resolved"; readonly resolvedOrder: number; readonly promise: Promise<void> };

  let state: AttentionState = emptyState;
  let baseState: AttentionState = emptyState;
  let started = false;
  let sequence = 0;
  let resolutionOrder = 0;
  let events: PendingEvent[] = [];
  let ready = Promise.resolve();
  let updates = Promise.resolve();

  const scheduleUpdate = <A>(operation: () => Promise<A> | A): Promise<A> => {
    const result = updates.then(operation);
    updates = result.then(() => undefined, () => undefined);
    return result;
  };

  const persist = async (next: AttentionState): Promise<void> => {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    await adapter.saveAttentionState(state);
  };

  const recalculate = (): Promise<void> => scheduleUpdate(async () => {
    await ready;
    let next = baseState;
    for (const event of events) {
      if (event.kind === "remove") {
        next = removeAttentionTab(next, event.tabId);
        continue;
      }
      if (event.kind === "barrier" || event.status === "pending" || !event.candidate) continue;
      const supersededFocus = event.kind === "focus" && events.some((later) =>
        later.sequence > event.sequence && later.status === "resolved" && later.resolvedOrder !== undefined &&
        event.resolvedOrder !== undefined && later.resolvedOrder < event.resolvedOrder &&
        (later.kind === "barrier" || ((later.kind === "activation" || later.kind === "focus") && later.candidate !== undefined)),
      );
      if (!supersededFocus) next = observeAttention(next, event.candidate);
    }
    await persist(next);
    if (events.every((event) => event.status === "resolved")) {
      baseState = next;
      events = [];
    }
  });

  const addObservation = (kind: "activation" | "focus", windowId: number, tabId?: number): void => {
    if (!started) start();
    const event: ObservationEvent = { sequence: ++sequence, kind, status: "pending", promise: Promise.resolve() };
    events.push(event);
    event.promise = adapter.resolveFocusedAttention(windowId, tabId)
      .then((candidate) => {
        event.status = "resolved";
        event.resolvedOrder = ++resolutionOrder;
        if (candidate) event.candidate = candidate;
      }, () => {
        event.status = "resolved";
        event.resolvedOrder = ++resolutionOrder;
      })
      .then(() => recalculate());
  };

  function start(): void {
    if (started) return;
    started = true;
    ready = (async () => {
      const stored = await adapter.loadAttentionState().catch(() => undefined);
      state = decodeAttentionState(stored);
      baseState = state;
      await adapter.saveAttentionState(state).catch(() => undefined);
    })();
  }

  return {
    start,
    observeActivation(tabId, windowId) {
      addObservation("activation", windowId, tabId);
    },
    observeWindowFocus(windowId) {
      if (!started) start();
      if (windowId === WINDOW_ID_NONE) {
        events.push({ sequence: ++sequence, kind: "barrier", status: "resolved", resolvedOrder: ++resolutionOrder, promise: Promise.resolve() });
        void recalculate();
        return;
      }
      addObservation("focus", windowId);
    },
    removeTab(tabId) {
      if (!started) start();
      events.push({ sequence: ++sequence, kind: "remove", tabId, status: "resolved", resolvedOrder: ++resolutionOrder, promise: Promise.resolve() });
      void recalculate();
    },
    async prepareTabs(source, tabs) {
      if (!started) start();
      const sourceEvent: PendingEvent = {
        sequence: ++sequence,
        kind: "activation",
        status: "resolved",
        resolvedOrder: ++resolutionOrder,
        candidate: { tabId: source.id, windowId: source.windowId },
        promise: Promise.resolve(),
      };
      events.push(sourceEvent);
      await Promise.all(events.filter((event) => event.sequence < sourceEvent.sequence).map((event) => event.promise));
      await recalculate();
      return scheduleUpdate(async () => {
        const decorated = decorateAttentionTabs(state, tabs);
        await persist(decorated.state);
        baseState = decorated.state;
        return decorated.tabs;
      });
    },
  };
}
