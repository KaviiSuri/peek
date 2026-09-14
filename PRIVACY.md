# Peek privacy policy

Last updated: September 14, 2026

Peek is a Chrome extension for finding and explicitly switching to open tabs. It does not require an account.

## Information Peek handles

Peek reads the titles, URLs, identifiers, window identifiers, favicon information, and last-accessed timestamps of eligible open tabs in the current Chrome profile. It observes tab activation and window focus to identify the current and previously viewed distinct tab. This is browsing-activity information, even though Peek handles it locally.

Search text entered into Peek is processed locally to match open-tab titles and URLs. Peek does not search or collect webpage body content, passwords, form contents, or ordinary typing outside its interface. Incognito tabs are excluded.

## Use and storage

Peek uses this information only to display, search, rank, and switch between open tabs and to support returning to the previous tab. Query and palette state are held in memory. The identifiers of the current and previous tab and their windows are stored in Chrome's session-only extension storage, not in a remote database or Chrome Sync. Peek does not maintain a persistent browsing-history or search-query log.

## Sharing and network access

Peek does not send tab metadata or search text to the developer or an analytics service. It has no advertising, telemetry, remote search service, or remotely hosted executable code. It does not sell or share user data with third parties.

For icons, Peek requests images from Chrome's browser-owned favicon endpoint and passes bounded image data to its interface. Chrome's own browsing, favicon fetching, updates, and other browser services are separate from Peek and are governed by Google's policies.

## Permissions

- **activeTab:** temporary access to the tab where the user invokes Peek.
- **scripting:** install Peek's interface on that tab after invocation.
- **tabs:** read open-tab metadata and identify the selected destination across normal windows in the current profile.
- **storage:** retain current and previous tab identifiers in session storage across background-worker suspension.
- **favicon:** obtain tab icons through Chrome's favicon service.

Peek does not request access to all websites or run a permanently installed keyboard listener on webpages.

## Control and deletion

Users can disable or remove Peek in Chrome's extension settings. Session storage is temporary and is cleared when the browser session ends or the extension is reloaded, disabled, updated, or removed. There is no developer-held copy of browsing data to delete.

If a user voluntarily submits information in a public support issue, that submission is handled by GitHub and is separate from the extension. Do not include private browsing details in public issues.

## Limited use and changes

Peek's use of information received from Chrome APIs follows the Chrome Web Store User Data Policy, including its Limited Use requirements. User data is used only for Peek's tab-finding and switching functionality.

Changes to data handling will be reflected in this policy and the extension's disclosures before the changed behavior is released.

## Contact

For privacy questions, contact the maintainers through [Peek's issue tracker](https://github.com/KaviiSuri/peek/issues). Do not include sensitive information in a public issue.
