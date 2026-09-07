import { Either, Schema } from "effect";

export interface PeekTab {
  readonly id: number;
  readonly windowId: number;
  readonly title: string;
  readonly url: string;
  readonly favIconUrl?: string | undefined;
  readonly lastAccessed: number;
  readonly current: boolean;
}

export interface PeekModel {
  readonly status: "ready" | "error";
  readonly tabs: readonly PeekTab[];
  readonly message?: string | undefined;
}

const TabSchema = Schema.Struct({
  id: Schema.Number,
  windowId: Schema.Number,
  title: Schema.String,
  url: Schema.String,
  favIconUrl: Schema.optional(Schema.String),
  lastAccessed: Schema.Number,
  current: Schema.Boolean,
});

const ModelSchema = Schema.Struct({
  status: Schema.Literal("ready", "error"),
  tabs: Schema.Array(TabSchema),
  message: Schema.optional(Schema.String),
});

export const InitMessageSchema = Schema.Struct({
  kind: Schema.Literal("peek/init"),
  sessionId: Schema.String,
  sourceTabId: Schema.Number,
  sourceWindowId: Schema.Number,
  model: ModelSchema,
});

export const CommitMessageSchema = Schema.Struct({
  kind: Schema.Literal("peek/commit"),
  sessionId: Schema.String,
  targetTabId: Schema.Number,
  targetWindowId: Schema.Number,
});

export const CancelMessageSchema = Schema.Struct({
  kind: Schema.Literal("peek/cancel"),
  sessionId: Schema.String,
});

export type InitMessage = Schema.Schema.Type<typeof InitMessageSchema>;
export type CommitMessage = Schema.Schema.Type<typeof CommitMessageSchema>;
export type CancelMessage = Schema.Schema.Type<typeof CancelMessageSchema>;

export function decodeUnknown<A, I>(schema: Schema.Schema<A, I>, value: unknown): A | undefined {
  const result = Schema.decodeUnknownEither(schema)(value);
  return Either.isRight(result) ? result.right : undefined;
}
