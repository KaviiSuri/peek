# Peek

A keyboard-first Chrome tab finder. V0 does one complete job: find and explicitly switch to an open tab in the current profile across normal windows.

## Agreed first release

- Search titles and URLs only. Strong textual matches beat recency; support remembered fragments and shortened input without special syntax.
- Show a centred in-page palette on ordinary pages and a centred browser-created extension window on restricted pages. No native companion.
- Use favicon, prominent title and quieter meaningful domain/path in light and dark appearance. No static shortcut footer.
- Highlight the previously viewed distinct tab when known. Highlight movement never activates. Explicit selection switches; Escape cancels.
- Support typing with arrows/Enter, plus Tab-toggle selection with j/k and visible 1–9 choices. Restore query/caret when returning to typing.
- Reveal coherent initial content, preserve the first keystroke and avoid disruptive shortcut conflicts.
- Use minimal Effect TS at browser/lifecycle boundaries, pure search/interaction and synchronous MV3 entrypoints. Remaining tooling choices belong to the first implementation ticket.

Google Chrome is the target. Discovery testing in Dia is evidence about Dia only, not verified Chrome compatibility. Production implementation and release verification have not started.

## Canonical documents

- [First-release specification](docs/first-release-spec.md)
- [Acceptance contract and evidence limits](docs/first-release-acceptance.md)
- [Implementation ticket index](docs/tasks/README.md)
- [Discovery archive](docs/discovery/README.md)

The spec separates confirmed product decisions from owner-selected defaults. BB Tasks remains the live decision and implementation tracker; repository task files are a durable snapshot.

## Later releases

History, bookmarks, recently closed tabs, browser navigation/actions and automatic folders remain future candidates. Semantic/page-content search, global or cross-profile invocation, incognito search, broad host permissions, settings and a native companion are outside v0. These are not promises for subsequent releases.

Kavii's daily-use bar is less query formulation and faster finding than manual tab scanning, without disruptive shortcuts. See the acceptance contract for the concrete scenarios and verification gates.
