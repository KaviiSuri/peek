# PEEK-3 · What must search match to feel effortless?

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Question
Using realistic remembered queries across 25–30+ overlapping work tabs, what title/URL matching and ordering behavior would Kavii trust without learning a search strategy? Include site names, GitHub repository and issue names, title fragments, adjacent topic words and ambiguous untitled sheets. Title/URL-only is the v0 boundary; do not add semantic search to fix every miss. Previous-tab default selection is settled, full empty-query ordering is not. Resolve with Kavii-approved examples, expected results and acceptable limitations; distinguish facts needing later tests from assumptions.

## Recorded comments

Blocks PEEK-5 added by agent (thr_gdyshcku3c)

Blocks PEEK-7 added by agent (thr_gdyshcku3c)

Confirmed by Kavii: strongest match first. Recency tie-breaking remains unsettled. Next step is a concrete query/result comparison, prepared by the GPT Pi child; no abstract ranking questionnaire or algorithm selection.

Status changed to In Progress by agent (thr_gdyshcku3c)

Attached `search-decision-examples.md`: six concrete title/URL-only cases prepared for progressive discussion, not a matcher design.

Recommended first case: query `orion retry` against two Orion tabs with `retry` in the title, an Atlas tab with a strong `retry` title, the Orion repo root, and an Orion-only PR. Proposed expectation: covering both remembered clues across title + URL beats concentrating one clue in the title. Ask only whether the two Orion+retry results clearly belong above Atlas; leave their internal tie for later.

Remaining cases, held back for one-at-a-time use:
- bare `orion`: exact repo root versus richer open work inside the repo;
- `github auth 880`: domain + title + URL-path clues without field syntax;
- `sched rtry`: abbreviation/dropped vowel/non-contiguous retrieval and whether query order matters;
- duplicate `Hiring pipeline tracker` sheets: illustrative recency as a textual tie-break only versus stable tab order;
- `outage`: honest no-result when the intended Orion postmortem lacks that word in title/URL, versus explicitly out-of-scope semantics.

All fixture labels were checked against the exact 30-tab PEEK-8 HTML: 15 unique title/domain/path triples verified. Only one duplicate Hiring sheet and one Untitled spreadsheet are invented and labelled; last-used values are labelled illustrative. No scores, performance claims, algorithm/library, implementation, or task resolution.

Confirmed search expectation from concrete orion retry example: tabs covering both remembered clues across title and URL rank above a tab covering only retry from a different repository. No field-selection syntax should be needed. This does not settle ordering within the two equally covering Orion results or recency tie-breaking.

Confirmed in subsequent concrete cases: for bare orion, prefer the matching repository homepage over its recently used issues (parent restated that interpretation). For sched rtry, retrieve scheduler retry tabs without requiring correction: shortened fragments and dropped-character input are expected. Query-term order weighting remains unchosen; no algorithm selected.

Confirmed: recency breaks equally strong matches; it must not elevate weaker matches. Process correction from Kavii: stop asking for routine choices with sensible defaults and stop turning prepared cases into a serial questionnaire. Parent should synthesize current expectations, choose and clearly label remaining routine defaults, and reserve live questions for genuine consequential uncertainty or hands-on reactions. Do not reopen title/URL-only scope or require approval for every example.

Attached concise synthesis: search-acceptance-note.md.

Confirmed requirements are separated from routine owner defaults and consequential validation risks. Behavioral acceptance model: clue coverage, then textual directness and contiguity, then weak provisional query order, then recency tie-break. This is not a scoring formula or algorithm selection.

Concrete expected tests cover orion retry, bare orion, github auth 880, sched rtry, equally titled Hiring sheets with recency, and the intentional title/URL-only miss for outage. No invented scores; the sole synthetic duplicate remains labelled.

Blocker assessment: no genuine product blocker remains inside PEEK-3. Fuzzy-noise control, query-order behavior, adjacent-topic misses, and indistinguishable duplicate recovery are empirical acceptance risks. Query-order weighting is a provisional default to validate, not an interview prerequisite. This child did not change task status or resolve on behalf of Kavii.

Resolution by discovery owner: confirmed search expectations are sufficient to move into empirical validation. Adopt case-insensitive matching, clearer/contiguous evidence before scattered matches, and honest empty results within the title/URL boundary as routine defaults, not new Kavii-confirmed decisions. Query-order weighting remains provisional and must not become a hard rejection rule. The attached search-acceptance-note.md provides examples and risks, NOT test results or a matcher implementation. Its heading owner-selected defaults becomes accurate through this comment; its broader examples (e.g. PR numbers) are owner-derived acceptance cases rather than separately user-confirmed requirements. Strongest-first and recency-only-on-ties remain confirmed. Close the decision, not the future validation work.

Status changed to Done by agent (thr_gdyshcku3c)
