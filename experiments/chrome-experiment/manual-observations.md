# Manual Chrome observations

Temporary profile only. Leave rows `pending` until directly observed; automated fake tests are not substitutes.

| Check | Option+Space | Cmd+Shift+Space | Cmd+Shift+E | Notes/evidence |
|---|---|---|---|---|
| Chrome reports command assigned | pending | not tried | not tried | |
| Opens over ordinary test page | pending | not tried | not tried | |
| GitHub Cmd+K unaffected | pending | not tried | not tried | |
| Linear Cmd+K unaffected | pending | not tried | not tried | |
| BB Cmd+K unaffected | pending | not tried | not tried | |
| First character reaches input | pending | not tried | not tried | |
| Tab/j/k/arrows/1–9/Enter work | pending | not tried | not tried | |
| Escape and focus-loss dismiss cleanly | pending | not tried | not tried | |
| Cancel does not activate highlight | pending | not tried | not tried | |
| Same-window explicit selection exact | pending | not tried | not tried | |
| Cross-window selection focuses window | pending | not tried | not tried | |
| Previous distinct tab across windows | pending | not tried | not tried | |
| Current-tab no-op retains previous | pending | not tried | not tried | |
| Incognito/second-profile excluded | pending | not tried | not tried | |
| Comfortable versus manual tab strip | pending | not tried | not tried | |

## Timing observations

Copy exact popup log rows where useful. Chrome does not expose `_execute_action` keypress time, so do not relabel script-evaluation timing as shortcut-to-ready.

| Run | Assumed cold/warm and why | Eligible tabs | Script → facts ready | List call/render | Commit → activation resolved | Notes |
|---|---|---:|---:|---:|---:|---|
| 1 | pending | | | | | |
| 2 | pending | | | | | |
| 3 | pending | | | | | |

## Comfort verdict

- Candidate accepted/rejected:
- Faster or easier than manual tab-strip finding:
- Missed keys, interruptions, corrections, or surprises:
- Evidence still missing:
