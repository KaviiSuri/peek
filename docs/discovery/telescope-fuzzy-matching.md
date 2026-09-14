# Telescope fuzzy matching for Peek

## Recommendation

Yes. Adopt the fzf matching model behind the user's configured Telescope instead of extending Peek's custom matcher. Use the existing browser-oriented `fzf` JavaScript package as the first candidate, with extended matching explicitly enabled. Do not copy Telescope's older n-gram helpers or assume the package defaults reproduce Telescope.

Preserve Peek's empty-query switching order. For nonempty queries, use fzf score and returned match positions. Start with Telescope's shorter-search-string tie-break, then stable input order. Keeping recency instead is a reasonable product decision, but is not Telescope parity. Decide the searchable title/URL representation explicitly and test it before committing to ranking changes.

## What the user configured

The owner's local Neovim configuration was inspected read-only. It declares `telescope-fzf-native.nvim`, builds with `make`, conditions loading on `make` being executable, and calls `pcall(require('telescope').load_extension, 'fzf')`. There are no fzf option overrides. Installed repositories match the supplied lockfile commits:

- Telescope `a0bbec21143c7bc5f8bb02e0005fa0b982edc026`.
- fzf-native `b25b749b9db64d375d782094e2b9dce53ad53a40`.

This proves configuration intent, not successful runtime loading. `pcall` can swallow failure. No Neovim session or user configuration was launched.

The [extension defaults](https://github.com/nvim-telescope/telescope-fzf-native.nvim/blob/b25b749b9db64d375d782094e2b9dce53ad53a40/lua/telescope/_extensions/fzf.lua#L20-L150) enable fuzzy matching, smart case, and replacement of both generic and file sorters. Both replacements use the same fzf scorer, not a separate filename-tail boost. The adapter rejects score zero and returns `1 / score`, because Telescope sorts lower values first. It obtains highlights from the same matcher.

## Exact behavior to adopt

[fzf.c, constants and algorithm](https://github.com/nvim-telescope/telescope-fzf-native.nvim/blob/b25b749b9db64d375d782094e2b9dce53ad53a40/src/fzf.c#L47-L55), [boundary rules](https://github.com/nvim-telescope/telescope-fzf-native.nvim/blob/b25b749b9db64d375d782094e2b9dce53ad53a40/src/fzf.c#L307-L340), and [V2 dynamic programming](https://github.com/nvim-telescope/telescope-fzf-native.nvim/blob/b25b749b9db64d375d782094e2b9dce53ad53a40/src/fzf.c#L524-L768) establish:

- Every character in a fuzzy term must occur in order, with arbitrary gaps. V2 searches for a high-scoring alignment; it falls back to V1 when the slab cannot accommodate the matrix.
- Match reward is 16. Gap opening costs 3 and each continuation costs 1. Boundary and nonword bonuses are 8; lower-to-upper camelCase and nonnumber-to-number transitions get 7. Consecutive matches receive at least 4, with stronger run-start bonuses propagated. The first query character's bonus is doubled. These rules reward acronyms, word starts and compact matches without requiring whole-word matches.
- This is subsequence matching, not edit-distance correction. `gthb` can match `github`; `githib` cannot match `github` by substituting a letter, and `githbu` cannot match `github` by swapping the final two letters. Accidental alternate alignments in longer strings remain possible.

The [parser and score aggregation](https://github.com/nvim-telescope/telescope-fzf-native.nvim/blob/b25b749b9db64d375d782094e2b9dce53ad53a40/src/fzf.c#L984-L1188) split ordinary space-separated terms into AND groups. Each term must match, but terms can occur in either order in the candidate. Characters within each term remain ordered. Scores add; there is no separate phrase or query-term-order boost. Extended syntax includes `|` alternatives, `!` exclusion, `'` exact, `^` prefix, `$` suffix and escaped spaces. Smart case applies per term: uppercase in a term makes that term case-sensitive.

Native normalization is effectively absent: the normalization function is a stub, calls pass `false`, and character classification is ASCII/byte-oriented. Do not claim Unicode case folding or accent-insensitive matching for this native version. [Source](https://github.com/nvim-telescope/telescope-fzf-native.nvim/blob/b25b749b9db64d375d782094e2b9dce53ad53a40/src/fzf.c#L280-L340).

Telescope's [default tie-break](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/config.lua#L713-L730) prefers shorter `entry.ordinal`; equal lengths retain discovery order in the ordinary insertion path. The [entry manager](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/entry_manager.lua#L120-L156) only invokes this tie-break for scores below 1 and has bounded-result shortcuts. This is not the standalone fzf CLI's entire tie-break policy. Empty/native inverse-only queries can score 1 and avoid that tie-break.

## Telescope without the extension

Important correction: at this pin, [both default sorter options are `get_fzy_sorter`](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/config.lua#L676-L699). They are not the similarly named n-gram functions.

The [Lua fzy implementation](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/algos/fzy.lua) matches one case-insensitive ordered subsequence, including literal spaces. It does not parse order-independent AND terms. Its dynamic program rewards consecutive characters by 1, slash boundaries by .9, word boundaries by .8, camelCase by .7 and dots by .6. Leading/trailing gaps cost .005 per character; inner gaps cost .01. It returns positions for highlights, has a 1024-byte scoring limit and does not implement typo substitutions or swaps.

The older [generic/file fuzzy helpers](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/sorters.lua#L211-L410) instead count overlapping bigrams, favor shorter strings and earlier contiguous substrings, and reward increasing first-occurrence positions. File scoring adds uppercase overlap and a basename modifier. They are neither strict subsequence nor edit-distance algorithms; missing/reordered bigrams can survive heuristically. Their [highlighter](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/sorters.lua#L6-L20) highlights n-gram occurrences rather than one optimal alignment. Do not port these helpers.

## `live_grep` is a different operation

[`live_grep`](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/builtin/__files.lua#L95-L166) passes the prompt to an external search process, normally `rg`, and uses `highlighter_only`, not the configured generic/file sorter. The [default rg arguments](https://github.com/nvim-telescope/telescope.nvim/blob/a0bbec21143c7bc5f8bb02e0005fa0b982edc026/lua/telescope/config.lua#L621-L642) include `--smart-case`; absent overrides, the prompt is a regex, not a fuzzy query. By contrast, `find_files` collects filenames and applies `file_sorter`; `grep_string` collects initial content matches and uses `generic_sorter` for subsequent filtering. Peek's in-memory tab list corresponds to the fuzzy-list operation, not live grep.

## Browser implementation

Audit candidate: [`ajitid/fzf-for-js`](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/README.md), npm package `fzf`. It explicitly targets browsers. Its [algorithm](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/src/lib/algo.ts#L1-L49) cites both upstream fzf and telescope-fzf-native and uses the same scoring constants. Its [package manifest](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/package.json) provides ESM, TypeScript declarations, BSD-3-Clause licensing and no runtime dependencies.

Suggested evaluation configuration:

```ts
new Fzf(candidates, {
  selector: candidate => candidate.searchText,
  match: extendedMatch,
  fuzzy: "v2",
  casing: "smart-case",
  normalize: false,
  tiebreakers: [byLengthAsc],
});
```

[`finders.ts`](https://github.com/ajitid/fzf-for-js/blob/cf3903255b6bba6143bfbed5a387f3cadfd6938a/src/lib/finders.ts#L31-L94) defaults to `basicMatch`, accent normalization enabled and no tie-breakers. Those need deliberate overrides. Unlike native C, JS operates on Unicode code points and applies NFC even with `normalize: false`; it is a close algorithmic fit, not proven byte-for-byte parity. Map returned positions back to the displayed title/URL, accounting for NFC and UTF-16. Do not lowercase candidate strings beforehand, which would discard camelCase boundary information.

Maintenance caveat: audited repository HEAD is `cf3903255b6bba6143bfbed5a387f3cadfd6938a`, dated 2025-04-15, a dependency update. The npm registry reports latest `0.5.2`, published 2023-04-25, with release gitHead `357c8aedaeff3f1af190049fab1c8d03609e7aee`. This is an existing tested package, but the evidence does not justify calling its release cadence actively maintained. HEAD source audit is not verification of the published bundle. Registry response is saved under `telescope-source-audit/fzf-npm.json`.

No browser-ready WASM package was validated in this bounded audit. Compiling the native C matcher to WASM is a possible exact-core route, but would add a build, memory/position adapter and extension-CSP check while retaining its Unicode limitations. Prefer the existing JS port unless parity fixtures or measured performance justify that work. No dependencies were installed and no browser/native app actions were taken.

## Peek differences and adoption gates

Read [Peek `src/search/search.ts`](https://github.com/KaviiSuri/peek/blob/e562440d63ebe74c6b86d86fe9f793af24388417/src/search/search.ts). Current matching lowercases, strips diacritics with NFKD and splits punctuation into lexical terms. It admits partial token coverage, confines fuzzy matching to a narrow within-word dropped-character rule, then ranks coverage, contiguous phrase, token quality, GitHub repository-home status, query order and recency. Neither substitutions nor transpositions are implemented. This is materially different from fzf.

Replacing it means dropping partial-coverage fallback and repository-home/query-order special rules, allowing short and cross-word subsequences, preserving punctuation syntax, and adopting smart case. Preserve empty-query previous/current/MRU behavior separately. Use a single documented title-plus-location search string initially; scoring fields separately or weighting title matches would be additional Peek policy, not copied Telescope behavior.

Before adoption, compare inclusion, ordering and highlight positions for short acronyms, wide gaps, camelCase, reordered AND terms, a missing term, exact/exclusion operators, punctuation, accents, emoji, substitutions and swaps. Include long titles/URLs and equal-score candidates. Check the actual npm release artifact against these fixtures and benchmark representative tab counts. No runtime parity or browser performance claim is made by this source-only audit.

## Adopted in0.2.0

The owner approved adoption and publication. Runtime dependency is pinned to `fzf@0.5.2`, with extendedMatch, V2, smart case, normalize:false and byLengthAsc. The index is built once per model snapshot. Blank-query previous/MRU ordering is preserved; all-term filtering replaces partial-coverage fallback and repository boosts.

**Published-artifact correction:** Unlike the audited repository HEAD,0.5.2 uses `str.split("")` in strToRunes, so returned positions are UTF-16 offsets. Peek's adapter and tests use those offsets, normalize indexed/displayed text to NFC, and expand displayed highlights to complete grapheme clusters. Emoji and combining-mark renderer tests guard this distinction. We do not claim native byte-for-byte parity.

The searchable label is normalized title + space + rendered location. Location includes host/port/path/query/fragment and excludes scheme and credentials. Prefix/suffix operators apply to the combined label. All source metadata and queries stay local.
