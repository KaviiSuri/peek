# PEEK-7 · What evidence makes v0 ready for daily use?

Status at export: done. This is a snapshot; BB Tasks remains the live tracker.

## Question
Given the resolved search, interaction, visual and technical decisions, what concrete acceptance checks make this one capability worth using and the spec ready to hand off? Confirmed rejection tests: thinking about search formulation, slower than manual tab finding, disruptive shortcuts. Define realistic scenarios around 25–30+ tabs and a larger stress case, repeated GitHub tabs and ambiguous titles. Include matching correctness, focus behavior, light/dark readability and keyboard conflicts. Do not invent performance thresholds or declare success without evidence. Resolve with Kavii-approved acceptance criteria and any remaining validation required; this is not implementation.

## Recorded comments

Blocking state changed to Blocked after dependency addition by agent (thr_gdyshcku3c)

Blocked by PEEK-2 added by agent (thr_gdyshcku3c)

Blocked by PEEK-3 added by agent (thr_gdyshcku3c)

Blocked by PEEK-5 added by agent (thr_gdyshcku3c)

Blocked by PEEK-6 added by agent (thr_gdyshcku3c)

Blocked by PEEK-8 added by agent (thr_gdyshcku3c)

Blocked by PEEK-9 added by agent (thr_gdyshcku3c)

Attached preparatory first-release-acceptance-draft.md (SHA-256 eb1125f6a43da0500a74afe17c8dff1a5e2c70396237c4a09c788372ab0d24b0). It consolidates the confirmed Chrome/current-profile/title+URL-only scope; immediate list and previous-distinct default; explicit activation; accepted navigation and layout B; strong textual relevance before recency; normal 30-tab and synthetic 100-tab workloads; manual-workflow comparison; focus/privacy/failure checks; and accepted title/URL-only limitations. Timing is observational—no invented millisecond threshold. The draft labels provisional owner defaults and all unverified real-Chrome gates. Synthetic viewers are not counted as production acceptance. No status change or success claim.

Replaced the acceptance draft attachment to correct the previous-tab wording and evidence labels. Previous now means the previously viewed DISTINCT tab before current, across observed window attention, and never current at invocation; active tabs in unfocused windows do not count. The draft now separates explicitly user-confirmed product requirements from owner-derived acceptance examples/defaults and explicitly identifies the PR 880 query and Shift+Tab handling as examples/defaults rather than individual user decisions. Revised SHA-256: a880e835605ac66faa5113714542104b557220a21e9ea542de5de70b66ae83ed. No status change.

Acceptance input from prototype observation and user direction: avoid visible empty-shell-to-populated-list flash on initial open. Prepare coherent initial content before reveal or otherwise demonstrate no incomplete first paint; preserve cancel and error handling. Do not repair existing discovery prototypes just for polish. User has instructed us to document and keep Wayfinding. Timing evidence is approximate host-to-model response, not a measured paint threshold.

Confirmed scope update: restricted/non-injectable pages use a centred browser-created extension-window fallback, not a native companion app, with same results/navigation contract. Validate unavailable-page detection, fallback focus/close/return behavior, and exclusion of the fallback window from tab results/previous history. Existing top-right action popup is not chosen fallback. Do not add another prototype solely to settle already accepted scope; implementation verification remains pending.

Attached final decision-ready acceptance contract (SHA-256 60d0afd0637942cd4f95244bb37ec870f7b3b52579c94168802e901390971c87). Consolidates and supersedes the preparatory draft/experiment outline. Agreed presentation is now ordinary-page centred overlay plus centred browser-created extension-window fallback on restricted/browser-owned pages; browser chrome accepted, same results/navigation, no native companion or extra fallback settings. Removed obsolete no-fallback/ordinary-only proposal. Previous wording is consistently “previously viewed distinct tab before the current tab.” Added coherent first-visible-frame/no-split-frame future regression criterion without treating rAF as paint proof. Records Control+Space + reserved _execute_action as confirmed on ordinary Dia pages and explicitly leaves Google Chrome unverified. Separates fixed contract, owner defaults, tested Dia evidence, built/mock evidence, accepted limitations, and implementation evidence gates. It does not claim production acceptance passed. Decision audit: no unresolved user-facing v0 product decision remains in PEEK-7 scope; owner release judgment awaits evidence against fixed gates rather than new product choices. Document-only change; no code/browser/build/install/repo/Downloads action; statuses unchanged.

Blocking state changed to Not blocked after PEEK-9 moved to Done by agent (thr_gdyshcku3c)

Owner adopts acceptance contract for v0 with provenance/precision corrections being incorporated in spec synthesis: Chrome remains stated target, Dia observations are evidence only; distinguish user-confirmed and owner defaults; cancel performs no activation but does not reverse user click-away to another window; missing previous history uses sensible non-current candidate without inventing history or warning clutter; deterministic empty-query MRU is owner default. Accepted duplicate ambiguity remains explicit. Decision criteria are settled; actual production verification is still pending, not falsely passed. No further prototype polishing.

Status changed to Done by agent (thr_gdyshcku3c)

Spec synthesis complete; attached corrected first-release-acceptance.md (SHA f337a77f7e2384095ffae9ce7a9ab129b8bbab94d8049960e2a39b2cb81a6bd9) and self-contained first-release-spec.md (SHA 040fc5230e3da8b7aa558c07ab7a8d4a6c387f27aa81241be5cfb0d113158e27). Acceptance now separates user-confirmed contract from owner defaults: cross-window previous semantics, no-op behavior, Shift+Tab, case normalization, PR-number/query-order examples, missing-history non-current MRU, MRU empty ordering, stable loading option, and restricted-only fallback classification are labelled accurately. Click-away means Peek performs no activation and does not reverse an intentional external window focus change. Chrome remains the v0 target; Dia evidence is explicit and not Chrome/support proof. Spec follows Problem/Solution/22 scoped User Stories/Implementation Decisions/Testing Decisions/Out of Scope/Further Notes, with task-key provenance and absolute artifacts. It carries minimal Effect/browser seams, production-shaped tests, normal 30-tab + owner stress 100-tab inputs, false-start lessons without unsupported root-cause claims, and no arbitrary speed threshold. Precise remaining gates: Google Chrome command/focus/coherent reveal; restricted fallback classification/centering/lifecycle; real cross-window attention/activation; profile/incognito/privacy; production matcher; accessibility/IME; emitted size and cold/warm readiness. These are verification gates, not discovery questions. No production code exists; prototypes remain throwaway evidence. Parent owns publication/tracker status. Documents only; no browser/code/build/install/repo changes.
