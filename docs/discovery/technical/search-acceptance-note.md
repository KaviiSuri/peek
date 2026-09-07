# PEEK-3 search acceptance note

This synthesizes confirmed product requirements and owner-selected routine defaults. It defines observable retrieval behavior only—no scores, matcher/library choice, or implementation design.

## Confirmed requirements

1. **Strongest textual match first.** Recency must never promote a weaker textual match over a stronger one.
2. **Clues combine across title and URL.** A query needs no field selector; remembered site, repository, title, path, PR/issue number, or domain fragments may contribute together.
3. **Covering more entered clues is stronger than covering fewer.** For `orion retry`, Orion tabs whose title contains `retry` rank above an Atlas tab containing only `retry`.
4. **A bare repository query prefers the repository home.** For `orion`, `acme-labs/orion` at `github.com/acme-labs/orion` ranks above issues, PRs, CI runs, and unrelated documents that merely mention Orion.
5. **Shortened and dropped-character input works.** `sched rtry` retrieves the Scheduler/Retry tabs without requiring correction.
6. **Recency breaks equally strong matches only.** It is a final tie-breaker, not a relevance signal that can defeat stronger title/URL evidence.
7. **V0 remains title/URL-only.** It does not inspect page content, infer synonyms, or promise semantic retrieval. Identically titled and untitled tabs may remain ambiguous.

## Sensible defaults selected by the product owner

These defaults make “strongest” concrete enough to build and test without another interview:

- Match case-insensitively across the combined visible title and URL.
- Prefer results covering all query clues over partial matches, regardless of whether those clues are split between title and URL.
- Within equal clue coverage, prefer clearer textual evidence—exact or contiguous fragments before more scattered character matches.
- Use **query-term order as a weak, provisional signal** only after clue coverage and clearer textual evidence. Validate it against real use; do not make approval of this routine default a prerequisite.
- Use recency only after textual evidence is otherwise equal.
- Return an honest empty result when no title or URL contains a tolerable textual match. Do not silently broaden to page-content or semantic search.

A behavioral ordering of evidence is therefore:

> clue coverage → textual directness/contiguity → provisional query order → recency tie-break

This is an acceptance model, not a scoring formula.

## Concrete expected retrieval tests

All unmarked tabs below come from the verified 30-tab PEEK-8 fixture. The one duplicate sheet is explicitly synthetic because the fixture has no exact-title pair.

### 1. Combined repository and title clues

Query: `orion retry`

Expected top group, ahead of all partial matches:

- **Fix flaky retry in scheduler** — `github.com/acme-labs/orion/pull/2481`
- **Flaky test: scheduler retry backoff** — `github.com/acme-labs/orion/issues/2460`

Expected below that group:

- **Fix flaky retry in uploader** — `github.com/acme-labs/atlas/pull/1188` (`retry` only)
- **acme-labs/orion** — `github.com/acme-labs/orion` (`orion` only)
- **Bump orion to v3.2 and update deps** — `github.com/acme-labs/orion/pull/2490` (`orion` only)

Pass condition: the field boundary is invisible to the user; both-clue results win.

### 2. Bare repository name

Query: `orion`

Expected first:

- **acme-labs/orion** — `github.com/acme-labs/orion`

Expected later: **CI · orion — run #2481 failing**, **Bump orion to v3.2 and update deps**, **Orion incident postmortem**, and URL-only Orion issues.

Pass condition: the repository home wins even if an issue or PR was used more recently.

### 3. Site + title + URL path

Query: `github auth 880`

Expected first:

- **Refactor auth middleware (part 2)** — `github.com/nimbus/pulse/pull/880`

Expected later: the `/pull/874`, `/issues/869`, and `/discussions/71` auth results, which cover `github` and `auth` but not `880`.

Pass condition: domain, title, and URL path combine without special syntax.

### 4. Shortened/dropped-character query

Query: `sched rtry`

Expected first group:

- **Flaky test: scheduler retry backoff** — `github.com/acme-labs/orion/issues/2460`
- **Fix flaky retry in scheduler** — `github.com/acme-labs/orion/pull/2481`

Provisional expected internal order: issue before PR because `scheduler` then `retry` follows query order, while the PR reverses it. This ordering is a validation target, not a user-interview gate.

Expected later: **Scheduler drops jobs under load** and **Fix flaky retry in uploader**, each covering only one clue.

Pass condition: both-clue tabs appear without correcting `rtry`; unrelated fuzzy noise does not displace them.

### 5. Equal textual match and recency

Query: `hiring pipeline`

Equal-title pair:

- **Hiring pipeline tracker** — `docs.google.com/spreadsheets/d/1f2…Xm/edit` — illustrative last used: 18 minutes ago
- **Hiring pipeline tracker** — `docs.google.com/spreadsheets/d/7q4…Bn/edit` — **synthetic duplicate**, illustrative last used: 2 minutes ago

Expected order: newer duplicate first. A more recent **Untitled spreadsheet** or **Q3 revenue forecast v4** must not rise above either matching title.

Pass condition: recency resolves only the equal textual pair. Opaque URLs may still leave the two rows visually ambiguous; that is an accepted v0 limitation.

### 6. Adjacent-topic word outside the data boundary

Query: `outage`

Remembered target: **Orion incident postmortem** — `docs.google.com/document/d/1z7…Pq/edit`.

Expected response: no inferred match, because neither title nor URL contains `outage`. Querying `orion incident` or `postmortem` retrieves the document.

Pass condition: Peek does not fabricate a semantic result or request page-content access to hide this limitation.

## Consequential unresolved risks only

- **Fuzzy permissiveness:** shortened/dropped-character support could admit noisy partial matches. A 25–30+ repeated-GitHub fixture must confirm that all-clue results remain above one-clue noise. This is an empirical acceptance risk, not an unresolved product choice.
- **Query-order weighting:** treating order as a weak late signal is provisional. Validate `sched rtry` and a small set of reversed-order real queries; remove or reduce the signal if it causes surprising ordering. This is not a blocker.
- **Adjacent-topic misses:** title/URL-only deliberately misses `outage` → “Orion incident postmortem.” If these misses are frequent enough to cross the established “I had to think how to find it” abandonment line, scope must be reconsidered explicitly in a later release—not silently expanded now.
- **Indistinguishable duplicates:** recency makes an ordering choice but cannot prove which opaque, identically titled Sheet is intended. The risk is accepted for v0, contingent on result navigation being easy enough to recover.

## Blocker assessment

**No genuine product blocker remains inside PEEK-3.** The search behavior is specific enough to carry into a prototype and later daily-use acceptance work. Remaining items are empirical validation risks, especially fuzzy noise and query-order behavior. The parent may decide whether this evidence is sufficient to resolve PEEK-3; this child has not changed task status.
