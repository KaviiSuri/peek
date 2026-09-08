export function assertDrySchedule(result: unknown): void;
export function earlyCharacterAttempt(options: {
  preconditions: { sourceFocused: boolean; sourceVisible: boolean; paletteAbsent: boolean; temperatureVerified: boolean; [key: string]: unknown };
  post: () => unknown | Promise<unknown>;
  observe: () => Promise<{ available: boolean; palette?: { present: boolean; value?: string }; [key: string]: unknown }>;
}): Promise<{ outcome: string; [key: string]: unknown }>;
