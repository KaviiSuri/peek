import type { AttentionAdapter } from "../attention/attention";
import type { InitMessage, ModelMessage, PeekModel, PeekTab } from "../shared/model";

export interface SourceTab {
  readonly id: number;
  readonly windowId: number;
  readonly url?: string;
}

export interface TargetTab {
  readonly id: number;
  readonly windowId: number;
  readonly current: boolean;
}

export interface FallbackSurface {
  readonly tabId: number;
  readonly windowId: number;
}

export interface BrowserAdapter extends AttentionAdapter {
  listEligibleTabs(source: SourceTab): Promise<readonly PeekTab[]>;
  openOverlay(source: SourceTab, message: InitMessage): Promise<void>;
  updateOverlay(sourceTabId: number, message: ModelMessage): Promise<void>;
  dismissOverlay(sourceTabId: number, sessionId: string): Promise<void>;
  createFallback(source: SourceTab, sessionId: string): Promise<FallbackSurface>;
  presentFallback(source: SourceTab, surface: FallbackSurface, isCurrent: () => boolean): Promise<boolean>;
  updateFallback(message: ModelMessage): Promise<void>;
  dismissFallback(windowId: number): Promise<void>;
  fallbackPageUrl(): string;
  fileSchemeAccessAllowed(): Promise<boolean>;
  revalidateTarget(tabId: number, windowId: number): Promise<TargetTab | undefined>;
  activateTarget(target: TargetTab): Promise<void>;
}

export interface InvocationResult {
  readonly sessionId: string;
  readonly model: PeekModel;
}
