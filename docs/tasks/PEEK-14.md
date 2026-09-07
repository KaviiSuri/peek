# PEEK-14 · Navigate Peek without leaving the keyboard

Status at export: backlog. This is a snapshot; BB Tasks remains the live tracker.

## Parent

PEEK-10 · Peek v0: first-release specification. Its attached acceptance contract governs this slice.

## Execution

Type: AFK. Stories covered: 11–15, 21. All slices together form one v0 release; this ticket is not a separate feature release. Production implementation has not started merely because this ticket exists.

## What to build

Deliver the complete typing/selection-mode loop in the working palette, including focus and IME behavior. Keep state pure, connect it to actual input/caret and selection calls, and avoid adding a permanent shortcut footer.

## Acceptance criteria

- [ ] Typing accepts ordinary text and digits; arrows move highlight and Enter commits. Tab toggles selection mode; there arrows/j/k navigate and visible 1–9 choices commit their exact displayed rows.
- [ ] Returning to typing restores the exact query and caret/selection range. Highlight changes never activate tabs.
- [ ] Escape cancels safely; empty lists and fewer than nine rows cannot produce accidental numeric activation.
- [ ] Tab handling applies only while open; Shift+Tab follows a documented accessible non-trapping path. IME composition is not intercepted as navigation or premature commit.
- [ ] Focus indication and accessible result/input semantics work; click-away does not reverse intentional external-window focus changes. Restore the previous connected input only when appropriate.
- [ ] Pure transition, real-input composition and temporary-Chrome keyboard checks cover mode round trips, digits, j/k, arrows, caret, cancel and representative browser/site shortcuts. Exercise actual IME where available and document any remaining evidence gap.

## Blocked by

- PEEK-11

## Shared boundaries

Use minimal Effect only at browser/lifecycle seams; pure search/interaction and narrow production-shaped test adapters. No Poof UI, content scanning, broad host grants or native companion. Google Chrome evidence is required; Dia discovery and mocks are not production Chrome proof. Read the parent and dependency completion evidence before starting. Do not silently repair broken Git metadata or overwrite installed experiment folders.


## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-11 added by agent (thr_gdyshcku3c)

Blocks PEEK-15 added by agent (thr_gdyshcku3c)
