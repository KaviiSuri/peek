# Peek search decision examples

Purpose: give the parent one concrete case at a time for PEEK-3. These are discussion fixtures, not matcher output, measured rankings, scores, or an algorithm proposal.

## Settled frame

- Strongest match comes first.
- V0 searches **title + URL only** across current-profile Chrome windows.
- The empty-query list appears immediately; the tab just left is preselected. Empty-query ordering and cross-window “previous” semantics remain separate questions.
- The chosen result row treatment is: favicon, prominent title, quieter meaningful domain/path beneath.
- Identically titled or untitled tabs may remain ambiguous. No page-content or semantic inference is added here.

**Data labels:** `[fixture]` reproduces a title and domain/path from the synthetic 30-tab PEEK-8 fixture exactly. `[invented]` is introduced only where the fixture lacks the ambiguity needed for a decision. All `last used` values are explicitly illustrative.

---

## Case 1 — remembered repo + task word (recommended first discussion)

**Exact query:** `orion retry`

**Why first:** This is a common high-value shape for repeated GitHub work. It exposes the core question without discussing algorithms: should two remembered clues split across title and URL beat a very good one-clue title match?

### Candidate tabs

1. `[fixture]` **Fix flaky retry in scheduler**\
   `github.com/acme-labs/orion/pull/2481`
2. `[fixture]` **Flaky test: scheduler retry backoff**\
   `github.com/acme-labs/orion/issues/2460`
3. `[fixture]` **Fix flaky retry in uploader**\
   `github.com/acme-labs/atlas/pull/1188`
4. `[fixture]` **acme-labs/orion**\
   `github.com/acme-labs/orion`
5. `[fixture]` **Bump orion to v3.2 and update deps**\
   `github.com/acme-labs/orion/pull/2490`

### Two plausible readings of “strongest”

- **A — cover all remembered clues first:** candidates 1 and 2 form the top group because `retry` is in the title and `orion` is in the URL. Candidate 3 has the strong title word but wrong repo; 4 and 5 only cover `orion`.
- **B — concentrate on the title first:** candidate 3 may rise because its title strongly contains `retry`, even though `orion` is absent. Candidates 1 and 2 still match, but across fields.

### Recommendation

Use reading **A**: covering both user-entered clues across title + URL should beat a one-clue match concentrated in the title. Do not force the user to remember whether a clue lives in the page title or GitHub path. Candidates 1 and 2 can remain an unordered top pair until a later example establishes a genuine difference.

### User decision still needed

Does `orion retry` make candidates 1 and 2 clearly more relevant than the Atlas result? This is the single recommended first question for the parent to present.

---

## Case 2 — bare repository name versus work inside that repository

**Exact query:** `orion`

### Candidate tabs

1. `[fixture]` **acme-labs/orion**\
   `github.com/acme-labs/orion`
2. `[fixture]` **CI · orion — run #2481 failing**\
   `github.com/acme-labs/orion/actions/runs/2481`
3. `[fixture]` **Bump orion to v3.2 and update deps**\
   `github.com/acme-labs/orion/pull/2490`
4. `[fixture]` **Scheduler drops jobs under load**\
   `github.com/acme-labs/orion/issues/2455`
5. `[fixture]` **Orion incident postmortem**\
   `docs.google.com/document/d/1z7…Pq/edit`

### Two plausible orderings

- **A — exact entity first:** 1, then 2/3/5 (title word), then 4 (URL-only).
- **B — active work first:** 2/3/5, then 1, then 4; a richer task title is treated as more useful than the repository root despite the root's exact title.

### Recommendation

Start with **A**. For a bare repo name, the exact repository-title/root-path match is the least surprising strongest result. Title occurrences should then beat URL-only occurrences. This recommendation does **not** say every exact title must always beat a longer title; it is a concrete expectation for a bare repository query.

### User decision still needed

When typing only a repo name, is Kavii usually asking for the repository root, or the most relevant open work item inside it? If the latter, case 1's extra task word remains the less surprising way to express that intent.

---

## Case 3 — site name + title fragment + identifying URL number

**Exact query:** `github auth 880`

### Candidate tabs

1. `[fixture]` **Refactor auth middleware (part 2)**\
   `github.com/nimbus/pulse/pull/880`
2. `[fixture]` **Refactor auth middleware**\
   `github.com/nimbus/pulse/pull/874`
3. `[fixture]` **Auth token refresh race condition**\
   `github.com/nimbus/pulse/issues/869`
4. `[fixture]` **RFC: unify auth middleware**\
   `github.com/nimbus/pulse/discussions/71`

### Expected response (not genuinely ambiguous)

Candidate 1 should be first: `github` is in its domain, `auth` is in its title, and `880` is in its URL. Candidates 2–4 cover the site and title clues but not `880`. A result that ignores domain/path clues would make the quieter URL line visually useful but search behavior less useful.

### Recommendation

Treat site/domain and path substrings as first-class remembered clues. A multiword query may be satisfied across title and URL; the user should not have to choose a field or type a prefix.

### User decision still needed

Are site names and bare PR/issue numbers (`github`, `880`) clues Kavii actually remembers and types together? If not, each should still work independently, but this three-clue form should not dominate acceptance testing.

---

## Case 4 — abbreviation + dropped character + non-contiguous text

**Exact query:** `sched rtry`

### Candidate tabs

1. `[fixture]` **Flaky test: scheduler retry backoff**\
   `github.com/acme-labs/orion/issues/2460`
2. `[fixture]` **Fix flaky retry in scheduler**\
   `github.com/acme-labs/orion/pull/2481`
3. `[fixture]` **Scheduler drops jobs under load**\
   `github.com/acme-labs/orion/issues/2455`
4. `[fixture]` **Fix flaky retry in uploader**\
   `github.com/acme-labs/atlas/pull/1188`

### Two plausible responses

- **A — forgiving retrieval:** 1 first because the abbreviated/near-typo fragments appear in query order (`scheduler` then `retry`); 2 next because both fragments are present but reversed; 3 and 4 each cover only one clue.
- **B — literal retrieval:** no result for `rtry`, or only partial results for `sched`, requiring correction to `retry`.

### Recommendation

Prefer **A** as the expected experience. The confirmed quality bar says search should not require formulation effort; a dropped vowel and shortened first word are realistic memory/typing behavior. This is an expected example, not a mandate for a particular fuzzy-search technique.

### User decision still needed

Is this degree of forgiveness necessary for v0, and should query-term order make candidate 1 stronger than candidate 2? These can be answered separately if one feels obvious and the other does not.

---

## Case 5 — equally strong duplicate titles; recency is only a tie option

**Exact query:** `hiring pipeline`

### Candidate tabs

1. `[fixture]` **Hiring pipeline tracker**\
   `docs.google.com/spreadsheets/d/1f2…Xm/edit`\
   *Illustrative last used: 18 minutes ago*
2. `[invented duplicate]` **Hiring pipeline tracker**\
   `docs.google.com/spreadsheets/d/7q4…Bn/edit`\
   *Illustrative last used: 2 minutes ago*
3. `[fixture]` **Q3 revenue forecast v4**\
   `docs.google.com/spreadsheets/d/1a9…kQ/edit`\
   *Illustrative last used: 6 minutes ago*
4. `[invented ambiguity]` **Untitled spreadsheet**\
   `docs.google.com/spreadsheets/d/4u6…Ls/edit`\
   *Illustrative last used: 1 minute ago*

### Two plausible orderings

- **A — recency breaks only a textual tie:** 2 then 1; 3 and 4 remain below because they do not match the query. This does not let a recent weak result outrank a stronger match.
- **B — stable tie order:** 1 then 2 according to existing tab/window order; recency is ignored even when title evidence is indistinguishable.

### Recommendation

If Kavii finds the newest duplicate is usually the intended one, use **A** strictly as a tie-breaker after match strength. Do not use this example to introduce recency ahead of stronger text. The opaque URLs still may not let him visually prove which duplicate is which; v0 already permits that limitation.

### User decision still needed

For textually indistinguishable tabs, is “most recently used first” more trustworthy than stable tab-strip/window order? Recency remains unconfirmed until Kavii chooses.

---

## Case 6 — adjacent topic word absent from title and URL

**Exact query:** `outage`

**Remembered target:** `[fixture]` **Orion incident postmortem**\
`docs.google.com/document/d/1z7…Pq/edit`

### Nearby candidate tabs (none contains `outage` in title or URL)

1. `[fixture]` **Orion incident postmortem**\
   `docs.google.com/document/d/1z7…Pq/edit`
2. `[fixture]` **Scheduler drops jobs under load**\
   `github.com/acme-labs/orion/issues/2455`
3. `[fixture]` **CI · orion — run #2481 failing**\
   `github.com/acme-labs/orion/actions/runs/2481`
4. `[fixture]` **Atlas: memory leak in tile cache**\
   `github.com/acme-labs/atlas/issues/1207`

### Two possible product responses

- **A — honest title/URL boundary:** show no matches for `outage`. The target becomes findable with a visible clue such as `orion incident` or `postmortem`.
- **B — infer that outage means incident/postmortem:** return candidate 1 using synonyms or page contents. This exceeds the confirmed title/URL-only boundary and is not a v0 expectation.

### Recommendation

Use **A** and record this as an intentional miss, not a matcher failure to patch with hidden semantics. It is still an important acceptance case because it reveals whether the title/URL-only boundary is tolerable in real use.

### User decision still needed

Is this miss acceptable once the visible title makes `orion incident` or `postmortem` easy to learn from normal browsing, or would it cross the “I had to think how to find it” abandonment line? If unacceptable, revisit scope explicitly rather than quietly adding content access.

---

## Proposed expectations, kept separate from decisions

| Concrete expectation | Current status |
|---|---|
| More entered clues matched across title + URL outrank a strong one-clue match | Recommended; discuss Case 1 first |
| Bare exact repo title/root beats title-token and URL-only repo occurrences | Recommended; unresolved |
| URL numbers/path fragments count without field syntax | Recommended; unresolved |
| Common abbreviation/dropped-character input still retrieves likely tabs | Recommended; degree/order unresolved |
| Recency applies only after textual match strength, if used at all | Option only; recency tie-break unresolved |
| An adjacent-topic word absent from title/URL may honestly return no result | Consistent with confirmed v0 boundary; acceptability unresolved |

## Progressive conversation order

Present **Case 1 only** first: “For `orion retry`, should the two Orion tabs containing `retry` beat the Atlas tab whose title also strongly contains `retry`?” If confirmed, proceed to Case 2. Keep the remaining cases available rather than presenting them as a questionnaire.

## Fixture verification

Every `[fixture]` title and domain/path above was copied from `../visual/prototype-result-layouts.html`. The duplicate Hiring sheet and Untitled spreadsheet are explicitly invented because the fixture has no identical-title pair. No ordering shown here comes from an implemented matcher, and no scores or performance claims are made.
