import type { InitMessage, ModelMessage, PeekModel, PeekTab } from "./model";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tab(value: unknown): value is PeekTab {
  return record(value)
    && typeof value.id === "number"
    && typeof value.windowId === "number"
    && typeof value.title === "string"
    && typeof value.url === "string"
    && (value.favIconUrl === undefined || typeof value.favIconUrl === "string")
    && typeof value.lastAccessed === "number"
    && typeof value.current === "boolean";
}

function model(value: unknown): value is PeekModel {
  return record(value)
    && (value.status === "loading" || value.status === "ready" || value.status === "error")
    && Array.isArray(value.tabs)
    && value.tabs.every(tab)
    && (value.message === undefined || typeof value.message === "string");
}

export function decodeInitMessage(value: unknown): InitMessage | undefined {
  return record(value)
    && value.kind === "peek/init"
    && typeof value.sessionId === "string"
    && typeof value.sourceTabId === "number"
    && typeof value.sourceWindowId === "number"
    && model(value.model)
    ? value as unknown as InitMessage
    : undefined;
}

export function decodeModelMessage(value: unknown): ModelMessage | undefined {
  return record(value)
    && value.kind === "peek/model"
    && typeof value.sessionId === "string"
    && model(value.model)
    ? value as unknown as ModelMessage
    : undefined;
}

export function decodeDismissMessage(value: unknown): { readonly kind: "peek/dismiss"; readonly sessionId: string } | undefined {
  return record(value) && value.kind === "peek/dismiss" && typeof value.sessionId === "string"
    ? { kind: "peek/dismiss", sessionId: value.sessionId }
    : undefined;
}
