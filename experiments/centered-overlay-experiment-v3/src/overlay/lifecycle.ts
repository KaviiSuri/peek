export type ToggleOutcome = "mounted" | "removed-existing"

export interface SingleHostPort {
  readonly hasExistingHost: () => boolean
  readonly signalExistingHostToRemove: () => void
  readonly mountNewHost: () => void
}

export function toggleSingleHost(port: SingleHostPort): ToggleOutcome {
  if (port.hasExistingHost()) {
    port.signalExistingHostToRemove()
    return "removed-existing"
  }
  port.mountNewHost()
  return "mounted"
}

export function idempotentTeardown(steps: readonly (() => void)[]): () => void {
  let tornDown = false
  return () => {
    if (tornDown) return
    tornDown = true
    for (const step of steps) step()
  }
}
