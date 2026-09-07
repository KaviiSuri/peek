# PEEK-5 · Which result-navigation interaction feels fastest without getting in the way?

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Question
Through a later explicitly scoped hands-on comparison with Kavii, which invocation and result-navigation interaction is comfortable, quick and conflict-resistant? Compare direct navigation while typing against optional selection mode or numbered selection. Prefer two-key invocation but test three keys; do not transplant Neovim leader sequences. Highlighting never activates a tab; explicit selection does. Use realistic overlapping tabs and compare the current manual workflow. Prototype is evidence for a decision, not production UI. Do not start during charting. Resolve only from Kavii’s actual reactions, recording mistakes, interruptions and trade-offs.

## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-3 added by agent (thr_gdyshcku3c)

Blocked by PEEK-4 added by agent (thr_gdyshcku3c)

Blocks PEEK-6 added by agent (thr_gdyshcku3c)

Blocks PEEK-7 added by agent (thr_gdyshcku3c)

Blocking state changed to Not blocked after PEEK-4 moved to Done by agent (thr_gdyshcku3c)

Status changed to In Progress by agent (thr_gdyshcku3c)

**Keyboard-feel discovery prototype (evidence only; no keymap chosen, no decision).**

Attached: `prototype-keyboard-modes.html` (self-contained, no deps/network) + 6 screenshots. Previous layout prototype (`prototype-result-layouts.html`) left unchanged. Marked **DISCOVERY PROTOTYPE**: simulated tabs, external launch button (**not** a Chrome hotkey), fixed precomputed result order derived from the PEEK-3 acceptance examples (**not** a live matcher/ranking), keystroke counts are a neutral record (**not** speed proof). No extension, framework, stack choice, real tab access, or global shortcut capture.

**What it compares** — two switchable experiment variants over the chosen **B layout** + identical 30-tab fixture, ranking constant across both:
- **Direct (type & arrow):** input always ready; ↑/↓ highlight while typing; Enter opens highlighted; Esc cancels; numbers type into the query. No separate mode.
- **Selection mode:** type first; **Esc** leaves typing → selection (Esc again cancels); **j/k** or ↑/↓ move; **1–9** open a numbered visible result; **Enter** opens highlighted; **i** returns to typing. Number badges + a contextual hint appear only in selection mode — no permanent footer.

**Simulated Chrome contract (per PEEK-4 note):** two states CURRENT (Active) and PREVIOUS, initially different. Opening **preselects Previous, not Active** (the "visible immediately before invocation" reading — not the current tab). Highlighting never switches; commit sets Active←chosen and Previous←old Active, then dismisses; cancel/click-outside keeps Active. Real browser never changes. 2–3 guided tasks + Reset live outside the palette; a neutral trial log records variant/keys/committed-or-canceled/=target (no speed or quality verdict).

**Verification performed in an isolated browser (file://), visually + via DOM reads:**
- Launch focuses the input; opening preselects **Previous** (`kbd-open-preselect-dark`).
- **Identical query→result data across both modes** (same resolver); scenarios match acceptance examples: `orion retry`→Fix flaky retry in scheduler top (`kbd-scenario-orionretry-dark`); `orion`→`acme-labs/orion` repo home first; `github auth 880`→PR #880 top; `sched rtry`→issue #2460 before PR #2481 (`kbd-scenario-schedrtry-light`).
- **Arrows move highlight without mutating the query or committing** (verified: query intact, palette stays open).
- **Numeric query typing works** in typing mode (`github auth 880` entered fully).
- **Selection mode numbers commit the intended visible row** (`1`→"Refactor auth middleware (part 2)"), no digit leak into the read-only query (`kbd-selectionmode-badges-dark`).
- **Mode transitions**: Esc typing→selection (pill + badges + hint shown), `i`→typing (editable, refocused, no `i` leak), Esc→Esc cancels; **cancel preserves Active**.
- **Commit** updates Active and pushes old Active→Previous; **reopen preselects Previous ≠ Active**.
- **Light + dark** and **narrow (600px)** render cleanly — single palette, no cramming, full input string + long titles/URLs readable (`kbd-narrow-dark`). No console/page errors.
- Handler ignores Cmd/Ctrl/Alt chords and respects IME composition, so it never hijacks browser/OS shortcuts.

**Limits / gaps (not hidden):** favicons are illustrative monograms; result order is scripted scenarios (free-play uses an approximate substring filter, explicitly labelled, NOT ranking); keystroke counts don't measure speed; this can't validate real Chrome shortcut registration, website conflicts, popup/side-panel focus, permissions, or cross-window "previous" — those need the later authorized extension test (per PEEK-4). Numbered selection covers the first 9 visible rows only.

**Recommended first hands-on task for Kavii (parent to run; I did not ask him):** Task 1 — open Peek and immediately Enter to return to the tab he just left — first in **Direct**, then in **Selection** mode, on the overlapping GitHub set; then Task 2 (`orion retry`). React to which flow feels quicker and less error-prone; mode choice, invocation shortcut, and ranking remain separate open decisions.

Task left **in_progress**; not choosing a mode or resolving the decision.


**Fix: simulated-history no-op activation bug (verified).** Same artifact path; attachment + evidence updated. Other verified behaviors preserved.

**Bug (as reported):** committing the already-Active result overwrote Previous with the same tab, collapsing Active==Previous and breaking return-to-previous on the next open.

**Fix:** `commit()` now detects a no-op activation — if the chosen tab equals Active (title+domain+path), it opens without changing history (Previous is left as the distinct earlier tab). Different-tab commits still swap as before.

**Re-ran the exact repro + extras (isolated browser, DOM-verified):**
1. Direct · type `orion retry` · Enter → Active **Fix flaky retry in scheduler**, Previous **Refactor auth middleware**. ✓
2. Switch to Selection · open · type `orion retry` · Esc · **1** → Active **Fix flaky retry in scheduler**, Previous **Refactor auth middleware** (distinct — previously both collapsed to the same tab). Last-action: "already Active; history unchanged." ✓ **bug gone**
3. Next open preselects Previous (**Refactor auth middleware**) · Enter → Active **Refactor auth middleware**, Previous **Fix flaky retry in scheduler** — return-to-distinct-tab restored. ✓
4. Rapid repeated selection of the Active tab (4× across Direct Enter and Selection number-select) → Active/Previous never collapse; history stays intact. ✓
5. Regression check — non-no-op commits still swap correctly in **both** modes; direct-commit and Escape→number-select still commit the intended result (preserved). ✓

**Caption fix:** the sim disclaimer no longer says "the tab visible immediately before invocation"; it now reads *"'Previous' = the previous **distinct** tab viewed before the current one … opening the already-Active tab is a no-op that keeps history."* Evidence: `kbd-noop-fix-dark.png` (Active ≠ Previous after selecting Active; no-op message + trial log show no collapse).

No page/console errors. Task left **in_progress**; no decision made.


Live reaction: Kavii likes both direct and selection navigation, finds Esc entering selection awkward, and explicitly wants to retain j/k. No final keymap chosen. Next experiment proposed by owner: temporary modifier-held selection layer supporting j/k and numbered choices, release returns to typing; arrows remain available and Escape always cancels. Modifier is an experimental candidate, not a conflict-free Chrome binding.

Kavii explicitly prefers a toggle setup and chose Tab as the mode-toggle candidate. Redirect the experiment away from modifier-hold: Tab toggles typing/selection, selection supports j/k and numbered choices, Escape always closes, direct arrows remain available. Validate this tangible keymap before final resolution. Tab focus navigation/accessibility implications must remain visible, not silently ignored.

**New sibling prototype: TAB-TOGGLE selection** (`prototype-keyboard-tab.html`). Supersedes the modifier-hold direction per Kavii ("i do want to use a toggle setup. tab is nice"). Evidence only; no keymap chosen. Prior siblings preserved unchanged: `prototype-keyboard-modes.html` (Esc-into-mode) and `prototype-keyboard-hold.html` (Option/Alt hold, kept but not pursued). Same storage-only boundaries; no repo code, no stack choice, no extension.

**Behavior built (labelled the Tab version on-screen):**
- **Typing:** input ready; ↑/↓ move highlight; Enter opens; unmodified **j/k and digits type into the query**.
- **Tab ⇥ toggles:** Tab from typing → selection; Tab again → typing with **caret + query restored**. In selection: **j/k** move, **1–9** open numbered, **Enter** opens highlighted. Contextual pill/badges/hint show **only** in selection.
- **Esc always cancels** in either mode — the clear keyboard escape.
- **Shift+Tab is deliberately NOT a toggle:** it does normal backwards focus, which leaves the palette and **cancels** (focus-leaving cancels). Tab only overrides while Peek is open; when closed, Tab is normal and **focus is never trapped**. This override is documented on-screen ("Tab temporarily serves a mode command while Peek is open").

**Verified via trusted browser key events (agent_browser press/keyboard), DOM-confirmed:**
- Trusted **Tab typing→selection** (query `orion retry` preserved, input readonly, pill/badges shown). ✓
- **j** moves highlight in selection; no `j` leaks into query. ✓
- **Tab selection→typing** restores query and caret (caretEnd=11 for "orion retry"), input editable + refocused. ✓
- Unmodified **j/k/digits type** in typing (`orion retry` + typed `j5` → `orion retryj5`). ✓
- **Numeric commit** in selection: `github auth 880` → Tab → `1` opened "Refactor auth middleware (part 2)" (PR #880). ✓
- **Escape cancels** in both selection and typing (Active unchanged). ✓
- **No-op history regression preserved:** committing the already-Active tab keeps Previous distinct ("already Active; history unchanged"). ✓
- **Shift+Tab**: no toggle; focus moved to a real control and the palette canceled — no trapped focus. ✓
- **IME guard:** with an active composition, a real Tab does **not** toggle (guard returns; composition also suppresses hijack). ✓
- **Light + dark** and **narrow (600px)** render cleanly; selection badges/hint wrap without cramming. No console/page errors.

**Limitations / disclosures:** favicons are illustrative monograms; result order is fixed scenarios from the PEEK-3 acceptance set (free-play uses an approximate substring filter, labelled, not ranking); keystroke counts are neutral, not speed. The IME check used dispatched composition events around a real Tab keydown (agent_browser can't drive a full platform IME); a real build should re-verify with an actual input method. This viewer can't validate Chrome shortcut registration, real popup/side-panel focus, or cross-window "previous" — later authorized extension test (per PEEK-4).

**Recommended first hands-on task for Kavii (parent to run; not asked here):** Task 2 on the overlapping GitHub set — type `orion retry`, then **Tab → 1** to open the top result — and Task 1 (open → Enter to return to the just-left tab). React to whether Tab⇄typing feels natural and whether restoring the caret on toggle-back matters. Invocation shortcut and ranking remain separate open decisions.

Task left **in_progress**; no mode chosen.


Kavii tried the Tab-toggle prototype and explicitly confirmed: "yupp lets keep". Navigation resolution: typing supports arrows and Enter; Tab toggles into/out of selection; selection supports j/k and 1–9; returning restores query/caret; Esc always closes. Prototype is attached evidence, not a real Chrome implementation. Invocation shortcut and real browser focus/registration remain unresolved and will be tracked separately, not declared validated by this navigation decision.

Blocks PEEK-9 added by agent (thr_gdyshcku3c)

Status changed to Done by agent (thr_gdyshcku3c)
