# PEEK-8 · Which result layout makes overlapping tabs easiest to recognise?

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Question
Through a focused visual comparison with Kavii, which row density, supporting-URL placement and truncation best support recognising overlapping work tabs while preserving the confirmed visual direction?

Use the resolved visual-reference decision: Raycast-inspired finish/readability, favicon, prominent title, quieter meaningful URL path, no static shortcut footer. Both light and dark. Compare a small number of variants using the same realistic 25–30+ tab dataset, especially similar GitHub repos/issues/PRs and some Sheets. Preserve identical content across variants so appearance is the variable. Do not select a framework, implement an extension, invent extra features, or decide for Kavii. Artifacts are discovery prototypes only, not production UI. Keyboard mode, invocation shortcut, and ranking remain separate unresolved decisions. Resolve only after Kavii reacts to tangible examples; record rationale and remaining limitations.

## Recorded comments

Blocked by PEEK-2 added by agent (thr_gdyshcku3c)

Blocks PEEK-7 added by agent (thr_gdyshcku3c)

Status changed to In Progress by agent (thr_gdyshcku3c)

**Result-layout discovery prototype (evidence only; no layout chosen, no product decision).**

Attached: `prototype-result-layouts.html` (self-contained, no network/deps) + 7 screenshots. Marked **DISCOVERY PROTOTYPE**; all tab data is fictional/mocked; favicons are illustrative monograms; nothing implements ranking, performance, keyboard nav, or an invocation shortcut.

**What it shows** — THREE row treatments on ONE identical 30-row synthetic fixture (same data + order), Raycast-inspired finish held constant so *content hierarchy/density* is the only variable:
- **A — Compact, trailing URL:** one line; bold title, URL run right-aligned at row end. Densest (~10 visible). Identity in the trailing path; the domain can drop first when space is tight.
- **B — Title + second-line URL:** two lines; prominent title + source on line 1, full `domain / path` on line 2. Roomiest (~7 visible); most disambiguation surface — always shows meaningful domain AND path.
- **C — Aligned title / source columns:** one line; favicon · domain · title · path in fixed aligned columns — scannable down a column when many tabs share a domain; path degrades to end-truncation at extreme 3-up density.

Fixture is intentionally overlapping: many similar GitHub titles ("Fix flaky…", "Refactor auth middleware", "Dark mode contrast fixes"), near-duplicate `package.json`-style paths across `acme-labs/orion`, `atlas`, `nimbus/pulse`, `orbit-hq/ledger`, plus Google Sheets/Docs, Linear, Figma, Notion, Stack Overflow, MDN, localhost.

**Controls (clearly separated from product UI — dashed/striped chrome):** page-level Light/Dark toggle; Side-by-side vs Full-size single; A/B/C variant selector; synced scrolling across the three; `←`/`→` to switch variant in full-size; narrow screens auto-force full-size single so nothing clips. No instructional footer inside the palettes (only a quiet "Open tabs" section label). Selected row is identical across variants (row 3, "Scheduler drops jobs under load").

**Verification performed (visually inspected each shot):**
- Rendered in **light and dark** (`proto-light-overview`, `proto-dark-overview`).
- **Identical data/order** across all three variants; **same selected row**.
- **No clipping** at wide (1280) and narrow (720 → single-mode forced, `proto-narrow-light`).
- Full-size single mode for **A/B/C** (`proto-fullsize-*`); paths incl. issue/PR numbers show fully at width.
- Full 30-row fixture + varied favicons/domains render and stay in sync when scrolled (`proto-dark-scrolled-mixed`).
- No console/page errors. Opened locally via `file://` in an isolated browser session — no static server needed.

**Gaps / limits:** favicons are monograms, not real brand marks (labelled illustrative) — real favicons would change B/C recognition, worth noting before Kavii reacts. C's path truncates from the end at the tightest 3-up density (can lose the trailing number); A drops the domain first under pressure. Visible-row counts differ by design (density is the variable). No fuzzy-match highlighting shown (kept out to kee the variable clean; can add if useful). This is a viewer, not a working search.

**For parent to put to Kavii (I did not ask him):** react to A vs B vs C on the overlapping set — is a single dense line with a trailing path (A) enough, or is B's second-line domain+path worth the lower density, or does C's column alignment help most when many tabs share a domain? Keyboard mode, shortcut, and ranking remain separate open decisions.

Task left **in_progress** (not done/in_review); parent brings the actual choice to Kavii.


Resolution: Kavii selected variant B in the side-by-side visual comparison. Carry forward the two-line result layout: favicon, prominent title, quieter meaningful domain/path beneath. Prototype and screenshots are attached primary evidence. This selects result layout, not functional search, placeholder favicon design, optional type badges, shortcut, ranking or final pixel values. No additional rationale was supplied; do not invent one. Validate long-title/path handling and selected-row readability during later hands-on work.

Status changed to Done by agent (thr_gdyshcku3c)
