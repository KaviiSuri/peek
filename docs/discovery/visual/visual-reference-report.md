# Peek — visual reference investigation (evidence, revised)

Child agent (Opus 4.8) supporting Wayfinding. **Evidence only — no Peek UI, no mockups, no direction chosen, no product decisions.** Returns to parent, not to Kavii directly.

Scope followed: repo read-only, git untouched, no PRODUCT.md edits, no delegation. Artifacts under this thread's `BB_THREAD_STORAGE`. Captured via an isolated `peek-visref` browser session; Kavii's browser/profile never attached to or touched. No sign-ins performed (declined every auth prompt).

**Revision note (round 2, addressing parent feedback):** removed the incorrect universal claim about action hints; relabelled the VS Code Quick Open shot as a *prefix/mode help list* and sourced **actual near-duplicate result rows**; added **verified light+dark pairs for both directions** (same product where possible); and separated *row anatomy* from *personality*. New/changed captions were each re-checked against the pixels.

---

## The set (by what it teaches)

| Teaching goal | Reference | Theme(s) captured | Artifact(s) |
|---|---|---|---|
| Quiet command palette, real result rows | **VS Code** command palette | **Light + Dark** (matched, same product) | `vscode-command-palette-light.png`, `vscode-command-palette-dark.png` |
| Near-duplicate result rows (Kavii's core case) | **GitHub** file finder | **Light + Dark** (matched, same product) | `github-file-finder-nearduplicate-light.png`, `github-file-finder-nearduplicate-dark.png` |
| Distinctive command palette | **Raycast** | **Dark** real content + **Light/Dark** matched preview pair | `raycast-mac-hero.png`, `raycast-theme-light.png`, `raycast-theme-dark.png` |
| Quiet, on-point (GitHub-native), keyboard grammar | **GitHub** command palette | **Light** (docs; dark unavailable — see gaps) | `github-command-palette-nav.png`, `github-command-palette-theme.png` |
| Prefix/mode grammar (help list, NOT file results) | **VS Code** Quick Open help | **Dark** | `vscode-quick-open.png` |
| Keyboard rhythm + preview (styling not prescribed) | **Telescope.nvim** | **Dark** | `telescope-nvim.png` |

Directions covered with verified light+dark: **quiet** = VS Code (matched pair); **distinctive** = Raycast (matched preview pair). Near-duplicate rows also captured in both themes.

---

## Correction to the earlier "action hints only on active rows" claim

That was wrong as a universal statement. Verified per product:
- **VS Code** (`vscode-command-palette-*.png`): right-aligned **keybinding accessories show on every row that has a keybinding**, selected or not (e.g. `⌃⌘I`, `⌃⌘F` visible on non-selected rows). A gear/settings affordance appears on the hovered/active row.
- **Raycast** (`raycast-mac-hero.png`): a **persistent global action footer** (`Open Command ↵`, `Actions ⌘K`) is always visible, independent of selection; per-row accessories (source label, type) also show on all rows.
- **GitHub** (`github-command-palette-nav.png`, `github-command-palette-theme.png`): the `Jump to` / `Run command` accessory **does** appear only on the active row.

So "reveal-on-active" is one specific pattern (GitHub), not a rule. This is itself a useful design decision for Kavii to react to: always-visible hints (teachable, busier) vs active-only hints (calmer, less discoverable).

## Row anatomy is separate from personality

Correcting the earlier framing that lumped "icons/metadata columns" with "distinctive":
- **Quiet** interfaces here also carry rich anatomy: GitHub (quiet) has leading icons + a right-aligned action column; VS Code (quiet) has right-aligned keybinding columns and match-bolding.
- **Personality** ("quiet vs distinctive") is carried by the **frame and finish** — window rounding, blur/translucency, colour saturation, motion, footer chrome — *not* by whether rows have an icon or a second column.
- Practical consequence for Peek: it can add a favicon and a right-aligned URL/source column (helpful for near-duplicate GitHub tabs) **without** committing to a "distinctive" personality. Anatomy and personality are independent axes.

---

## 1. VS Code command palette — quiet direction, verified light/dark pair

- **Source:** live `https://vscode.dev/` (real VS Code for the Web), same query `>View: Toggle` in both themes; theme switched via the built-in **Preferences: Color Theme → Light Modern / Dark Modern**. No extension installed, no sign-in.
- **Artifacts:** `vscode-command-palette-light.png` (verified **light**), `vscode-command-palette-dark.png` (verified **dark**).

Teaches (identical in both themes, so the pair isolates *theme* from *layout*):
- **Fuzzy-match bolding** — the typed fragment is highlighted within each command label.
- **Right-aligned keybinding accessories** on rows that have them (see correction above).
- Category-prefixed labels (`View: Toggle …`) → a shared-prefix list where the **tail** disambiguates (a text analogue of many `github.com/org/repo/…` tabs sharing a prefix).
- Low-saturation selection band; dense, quiet rows.

## 2. GitHub file finder — actual near-duplicate result rows (Kavii's core case), light/dark pair

- **Source:** live `https://github.com/vercel/next.js/find/canary`, query `package.json`. Public, logged-out; works without auth. Captured in dark (system dark) and light (`set media light`).
- **Artifacts:** `github-file-finder-nearduplicate-light.png`, `github-file-finder-nearduplicate-dark.png` (both verified).

Teaches — this is the most on-point shot for Peek:
- A monorepo yields **~10+ identically-named `package.json` rows**. The **only** disambiguator is the **dimmed folder path** prefix (`rspack/`, `.github/`, `bench/vercel/`, `examples/mdx/`, `packages/font/`…).
- The matched basename `package.json` is **bolded**; the folder prefix is **dimmed** → your eye lands on "which one" fast.
- Strong full-width selection highlight on the active row.
- Directly validates PRODUCT.md's "identically titled results are acceptable, provided navigating results is easy": here, identical titles are made navigable purely by a dimmed path column. That is a concrete pattern Peek can borrow for duplicate GitHub tabs.

## 3. Raycast — distinctive direction, light/dark

- **Sources:**
  - `raycast-mac-hero.png` — official product manual hero (`https://manual.raycast.com/`), verified **dark**, shows **real app/command rows** (icon + bold title + dimmed source label + right-aligned type + persistent footer).
  - `raycast-theme-light.png` / `raycast-theme-dark.png` — Raycast's **official theme explorer** (`https://ray.so/themes`), which renders the **real Raycast window chrome** in a chosen theme. Cropped to the window. Verified **light** and **dark**. *Labelled honestly:* these are the official themeable preview (demo "List / Primary Text" content), **not** a desktop-app capture — used because the Raycast desktop app can't be run here and no public static light root-search screenshot was found.

Teaches:
- Distinctive personality via **frame**: rounded translucent window, coloured accessory tags, section header, always-on footer.
- The matched `ray.so` pair isolates theme: same layout, light vs dark, showing selection contrast and right-aligned accessory tags in both.

## 4. GitHub command palette — quiet, on-point, keyboard grammar (light only)

- **Source:** official docs `https://docs.github.com/en/get-started/accessibility/github-command-palette` (GitHub's own product screenshots).
- **Artifacts:** `github-command-palette-nav.png`, `github-command-palette-theme.png` (both verified **light**).
- Teaches: scope breadcrumb, inline `#` / `/` / `>` grammar, sections, monochrome rows, and **active-row-only** `Jump to`/`Run command` accessory. Dark not available from docs and not capturable live logged-out (see gaps).

## 5. VS Code Quick Open help list — prefix/mode grammar (relabelled)

- **Source:** VS Code docs `https://code.visualstudio.com/docs/getstarted/tips-and-tricks`.
- **Artifact:** `vscode-quick-open.png` (verified **dark**).
- **Corrected label:** this is the Quick Open **command/prefix help list** (`Go to File`, `# Go to Symbol`, `> Show and Run Commands`, `: Go to Line`, grouped "global commands"/"editor commands") — it is **not** a list of file results. It teaches the *mode grammar* and the *primary-token + dimmed-description* row style, nothing about file density. Real file-density is covered by #2.

## 6. Telescope.nvim — keyboard rhythm + preview (dark)

- **Source:** project README `https://github.com/nvim-telescope/telescope.nvim`.
- **Artifact:** `telescope-nvim.png` (verified **dark**). Per PRODUCT.md, rhythm not styling.
- Teaches: prompt + live result count (`82/82`), `>` caret selection, monospace density, live preview pane (note: Peek deliberately does not infer page contents, so preview is a rhythm reference, not a borrow).

---

## Verification performed

- Every artifact exists under `BB_THREAD_STORAGE/images/` and was **opened and inspected**; captions describe only what is visible. Sizes confirmed.
- Theme is stated as **captured**, per image. Matched light/dark pairs (VS Code, GitHub file finder, Raycast preview) use the **same layout/query/source**, isolating theme.
- The corrected hint claim and the relabelled Quick Open image were both re-checked against pixels before writing.
- No image is presented as evidence of speed or usability.

## Gaps and specific source blockers

- **GitHub command palette, dark:** not available. Docs ship light-only PNGs (no `<picture>` dark variant), and the live command palette is **inert when logged-out** (`Ctrl/Cmd+K` does nothing without sign-in), which I did not do. Blocker: requires an authenticated GitHub session to capture. GitHub's *file finder* (#2) did capture in dark, so a GitHub-dark surface is covered, just not the command palette specifically.
- **VS Code Quick Open with a real repo's files:** blocked — opening `next.js` in `vscode.dev` triggered a "GitHub Repositories wants to sign in" prompt to read the file index; I declined. Worked around with GitHub's public file finder (#2), which shows the same near-duplicate-rows lesson without auth.
- **Raycast desktop light root-search capture:** not obtainable (desktop app can't run here; no public static light root-search screenshot found). Used Raycast's official `ray.so` theme preview instead, clearly labelled.
- **Arc command bar:** still unsourceable — `arc.net` redirects to Dia; the command bar isn't shown.
- **Chrome's own Tab Search** (the literal incumbent): browser-chrome UI, not page-capturable via automation, and Google image search was captcha-blocked. Best obtained as a manual screenshot by Kavii/parent if a direct baseline is wanted.

## Next meaningful taste question (for parent to pose to Kavii — not asked by me)

Two independent decisions the evidence surfaces, both testable on the near-duplicate case (`github-file-finder-nearduplicate-*` is the closest proxy to Kavii's tabs):
1. **Disambiguator:** for identically-titled tabs, is a **dimmed path/URL fragment** (GitHub file finder, quiet) enough, or does he want a **favicon + right-aligned source column** (Raycast-like anatomy — which, per the anatomy≠personality point, can still be quiet)?
2. **Hint visibility:** **always-visible** action/keybinding hints (VS Code/Raycast) or **active-row-only** hints (GitHub)?

His answers, not mine, set whether the next capture round pursues the quiet or distinctive *finish* — theme pairs for both directions are already in hand, so light/dark coverage does not depend on that choice.
