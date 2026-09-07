# PEEK-2 · Which visual direction feels right for Peek?

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Question
Which visual direction should Peek take, based on Kavii reacting to real references first? Compare quiet/browser-native versus distinctive personality in both light and dark. Inspect readable density and hierarchy for 25–30+ overlapping work tabs, especially GitHub. No Poof UI inspiration; Telescope informs rhythm, not appearance. No Peek mockups yet. Human-in-the-loop: do not choose on Kavii’s behalf. Resolve with the selected qualities, rejected qualities and reference links in a resolution comment, after Kavii confirms.

## Recorded comments

Labels changed to wayfinder:grilling by agent (thr_gdyshcku3c)

Blocks PEEK-7 added by agent (thr_gdyshcku3c)

Status changed to In Progress by agent (thr_gdyshcku3c)

**Visual reference evidence (child agent, Opus 4.8 — evidence only, no direction chosen)**

Curated **4 real command-palette / fuzzy-finder interfaces (5 verified screenshots)** to contrast the *quiet/native* vs *distinctive* directions, stressed for recognising the right row among 25–30+ overlapping GitHub-heavy tabs. Full write-up + images attached to this task (`peek-visual-reference-report.md`).

Captured, verified (opened + inspected each; theme = what's actually in the shot):
- **GitHub command palette** — quiet/native, most on-point; **light**. Scope breadcrumb, inline keyboard grammar (`# / >`), monochrome rows, subtle full-width selection bar, right-aligned action accessory on the active row only, fuzzy-match bolding. Source: https://docs.github.com/en/get-started/accessibility/github-command-palette
- **VS Code Quick Open** — quiet, text-only; **dark**. Bright primary token + **dimmed secondary description on one line** = metadata hierarchy by brightness alone; very tight density. Source: https://code.visualstudio.com/docs/getstarted/tips-and-tricks
- **Raycast root search** — distinctive; **dark**. Richest row (icon + title + dimmed source + right "Command" accessory) + section headers + persistent action footer. Personality lives in the frame, not a loud selection. Source: https://manual.raycast.com/
- **Telescope.nvim** — keyboard-rhythm reference (styling not prescribed); **dark**. Prompt + live result count, `>` caret highlight, monospace density, live preview pane. Source: https://github.com/nvim-telescope/telescope.nvim

Direction-neutral findings worth reacting to:
- Every strong example uses a **low-saturation selection bar** and reveals the action hint (`Jump to` / `↵`) only on the active row — none use a loud colour block.
- "Which tab is this?" for near-duplicate GitHub rows is answered two ways: **brightness-dimmed secondary line** (VS Code) vs **distinct right-aligned source/URL column** (GitHub/Raycast).
- Personality sits in the **frame** (rounded window, blur, icon colour, footer), separable from list density — keeps "quiet vs distinctive" from being confused with behaviour.

Unresolved / not invented:
- **Distinctive+light** and matched **light/dark pairs** not captured (I have dark for Raycast/VS Code/Telescope, light for GitHub); missing twins were **not** fabricated — next capture round if side-by-side theme comparison is wanted.
- **Arc command bar** unsourceable (arc.net now redirects to Dia); **Chrome's own Tab Search** is browser-chrome UI, not page-capturable + image search was captcha-blocked — worth a manual screenshot from Kavii/parent as the incumbent baseline.

Next taste question for Kavii (parent to pose — I did not ask him): recognising the right tab among many near-identical GitHub rows, react first to **(a)** title + one dimmed secondary line (quiet), or **(b)** favicon + title + right-aligned source column (distinctive)? That sets which end the next capture round chases and whether we source matched light/dark pairs.

No claim any image proves speed or usability. Task left in_progress; not claiming, resolving, or editing the map.


**Visual reference evidence — round 2 (revisions + light/dark pairs). Evidence only; no direction chosen.**

Addressed parent feedback. Revised report attached (`peek-visual-reference-report-v2.md`); 6 new images added.

**Corrections made:**
- Dropped the wrong "action hints only on active rows" universal claim. Verified per product: **VS Code** shows keybinding accessories on every row that has one (selected or not); **Raycast** has an always-on action footer; **only GitHub** reveals `Jump to`/`Run command` on the active row alone.
- **Relabelled** the old VS Code Quick Open shot as the **prefix/mode help list** (`Go to File`, `#`, `>`, `:`) — it is *not* file results.
- Separated **row anatomy from personality**: icons/metadata columns are not what makes an interface "distinctive" (GitHub and VS Code are quiet yet carry icons/keybinding columns). Personality lives in the frame/finish. So Peek could add a favicon + right-aligned URL column and still stay quiet.

**New verified light/dark pairs (theme isolated; same layout/source):**
- **Quiet — VS Code command palette**, live on vscode.dev, same `>View: Toggle` query: `vscode-command-palette-light.png` + `-dark.png`. Shows match-bolding + keybinding columns.
- **Near-duplicate result rows (Kavii's core case) — GitHub file finder**, live public `find/canary`, query `package.json`: `github-file-finder-nearduplicate-light.png` + `-dark.png`. ~10+ identical `package.json` titles disambiguated **only** by a dimmed folder-path prefix, matched basename bolded, strong selection. Directly backs PRODUCT.md's "identically titled results are acceptable if navigation is easy."
- **Distinctive — Raycast**: `raycast-mac-hero.png` (dark, real app/command rows) + matched official `ray.so` theme-explorer preview `raycast-theme-light.png` / `-dark.png` (real Raycast window chrome; labelled as official preview, not a desktop capture).

**Source blockers (specific):**
- GitHub **command palette dark**: docs are light-only (no dark `<picture>`), and the live palette is inert logged-out (I did not sign in). Dark GitHub surface is still covered by the file finder.
- VS Code Quick Open on a real repo's files: blocked by a GitHub sign-in prompt for the file index (declined); worked around with the public GitHub file finder.
- Raycast desktop light root-search: app can't run here / no public static light shot → used official ray.so preview.
- Arc command bar: arc.net now redirects to Dia, bar not shown. Chrome's own Tab Search: browser-chrome UI, not page-capturable + image search captcha-blocked — needs a manual screenshot.

**Next taste question for Kavii (parent to pose):** (1) for identical tab titles, is a dimmed path/URL fragment enough, or does he want favicon + right-aligned source column? (2) always-visible hints (VS Code/Raycast) or active-row-only (GitHub)? Theme pairs for both directions are already in hand, so light/dark coverage does **not** depend on his direction choice.

No claim any image proves speed/usability. Task left in_progress; map/description untouched; no sign-ins performed.


Confirmed in the live product conversation: Kavii prefers Raycast among the references because of its recognisable icons, clear labels, readability and visual finish. He confirmed result anatomy: favicon alongside a prominent tab title, with site or URL as quieter supporting text. This is a partial decision, not approval to copy Raycast or build UI. Still open: supporting-text formatting, hint presentation, spacing and final visual treatment. Keep the visual-direction decision open until those are sufficiently established with Kavii.

Kavii confirmed that quieter supporting text should include meaningful URL paths, not only the domain, to distinguish tabs from the same site (for example github.com/org/repo/issues/123). Exact shortening/truncation and row placement remain open; this confirms the information to preserve, not a specific layout.

Kavii rejected an always-visible footer for fixed navigation hints such as arrows / Enter / Escape as useless. He sees potential value only when hints change with context; contextual hints are not yet a committed feature. Do not add a static shortcut legend merely to imitate Raycast.

Resolution confirmed by Kavii: visual direction is Raycast-inspired polish and readability, with favicons, prominent tab titles, quieter meaningful site/URL paths, and no static shortcut footer. Context-dependent hints remain possible, not required. This establishes qualities to explore, not a pixel design or permission to copy Raycast. Real references were compared before this decision; both light/dark remain required. Kavii confirmed this is enough to move to focused visual exploration. Exact spacing, truncation and treatment should be resolved through tangible comparisons rather than more abstract questions. Separate interaction agreement: Peek disappears after explicit tab selection; this does not resolve the keyboard-interaction ticket.

Status changed to Done by agent (thr_gdyshcku3c)

Blocks PEEK-8 added by agent (thr_gdyshcku3c)
