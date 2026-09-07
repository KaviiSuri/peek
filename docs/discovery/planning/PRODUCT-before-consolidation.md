# Peek — product discovery

> Living document. Update only after decisions are confirmed in the Peek product thread.

## One-line idea

A lightweight, beautiful browser command palette that starts by searching and switching open Chrome tabs.

## MVP direction

- Search open tabs
- Fuzzy matching across tab title and URL
- Keyboard-first interaction
- Select a result to focus its tab
- Simple, tasteful popup UI

## Longer-term direction

- History and bookmarks
- Recently closed tabs
- Browser navigation
- Small, discoverable commands and tab actions

## Non-goals for now

- Building a complicated browser replacement
- A settings-heavy productivity suite
- AI features before the core interaction feels excellent

## Confirmed first user

- Kavii is the primary user for the first release. Ground discovery and release validation in his actual daily Chrome use.

## Confirmed first-release boundary

- Finding and switching open tabs is the only required capability for the first release. No additional capability is currently essential to making it worth using for Kavii.
- Deliver that experience completely; keep other capabilities as future-release candidates.
- V0 searches titles and URLs without promising to infer page contents or distinguish unnamed tabs by meaning. Identically titled results are acceptable, provided navigating results is easy.

## Confirmed tab-finding behavior

- First-release priority: retrieve an open tab from a remembered fragment, rather than infer which tab the user needs.
- Show a tab list immediately when Peek opens, before any query is entered.
- Invoke Peek only while Chrome is focused; no system-wide invocation for the first release.
- Search all Chrome windows within the current profile. Other profiles are outside v0 search scope.
- Moving the result highlight does not activate a Chrome tab. Switch only on explicit selection.
- Result navigation must not interfere with typing the search query.
- Select the previously accessed tab by default, rather than the current tab. Opening Peek and pressing Enter should return to the tab just left.
- Telescope.nvim is the fuzzy-finding reference. Arc's automatic folder organisation is a separate reference, not an example of the desired fuzzy search.

## Confirmed daily-use quality bar

Kavii would abandon Peek if:

- Finding a tab requires thinking about how to phrase or perform the search.
- It is slower than the existing workflow of scrolling, visually finding a tab, and selecting it.
- Its shortcut interferes too often with shortcuts used elsewhere.

These are qualitative acceptance criteria. Concrete matching examples, timing comparisons, and shortcut expectations remain to be established.

## Confirmed working agreements

- This product discovery thread owns planning, task tracking, and continuity for Peek. Kavii makes product decisions.
- Build shared understanding before implementation, asking one focused question at a time.
- Include a moodboarding phase to explore visual inspiration before choosing a UI direction.
- Use Poof as a reference for the technical approach, particularly Effect TS. Do not use its UI as inspiration. Specific stack choices remain unsettled.
- Ship small, complete releases. Make one feature excellent and get it used rather than spreading effort across many unfinished features.
- Capture future features instead of forgetting or silently dropping them; sequence them into later releases as scope becomes clear.
- Keep confirmed decisions separate from proposals and open questions. Commit discovery-note changes.

## Project tracking

- BB Tasks project: `PEEK`, linked to the Peek BB project.
- Product decisions live here; tasks track discovery work, future ideas, and eventually release work.

## Confirmed discovery destination

An agreed, buildable first-release spec covering:

- The tab-finding experience
- A moodboard-backed visual direction
- A Poof-informed technical approach
- Daily-use acceptance criteria

Record future features separately rather than expanding the first release to include them. This destination is a planning outcome, not authorization to implement.

## Discovery approach

- Start with a Wayfinder assessment: agree on the destination, then explore unresolved decisions breadth-first, one focused question at a time.
- Create a persistent decision map in BB Tasks only if that exploration reveals enough uncertainty to need one. Do not assume the map is necessary or that the whole effort fits one conversation.
- No delegation or implementation during this initial assessment.

## Open questions

- Proposal: order the entire default list by most recently accessed. Default selection of the tab just left is confirmed; full-list ordering remains to be settled.
- Hands-on comparison needed: direct result navigation while typing versus a separate selection mode with Vim-style keys or numbered choices. Neither is selected.
- Test real queries based on site names, repository names, titles, and remembered topic words before complicating search. Include ambiguous untitled documents as a known limitation.
- How much result detail is needed to recognise the right tab without slowing scanning?
- Which concrete search examples and workflow comparisons demonstrate the confirmed daily-use quality bar?
- Which existing Chrome and webpage shortcuts must Peek preserve?
- Which visual direction should moodboarding establish?
- Which parts of Poof's technical approach fit Peek? Inspect before choosing.
