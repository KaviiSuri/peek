export type PresentationKind = "overlay" | "fallback";

const RESTRICTED_SCHEMES = new Set([
  "about:",
  "chrome:",
  "chrome-search:",
  "chrome-untrusted:",
  "devtools:",
  "chrome-extension:",
  "view-source:",
]);


/**
 * Classifies surfaces Chrome documents as unavailable to gesture-scoped script
 * injection. This decision is made before injection; injection/runtime/render
 * failures on otherwise ordinary HTTP(S) pages remain errors.
 */
export function presentationForUrl(rawUrl: string | undefined, fileSchemeAccessAllowed = true): PresentationKind {
  if (!rawUrl) return "overlay";
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "overlay";
  }
  if (RESTRICTED_SCHEMES.has(url.protocol) || (url.protocol === "file:" && !fileSchemeAccessAllowed)) return "fallback";
  if (url.protocol === "https:" && (
    url.hostname === "chromewebstore.google.com" ||
    (url.hostname === "chrome.google.com" && (url.pathname === "/webstore" || url.pathname.startsWith("/webstore/")))
  )) return "fallback";
  // Unclassified URLs must not silently turn metadata or execution defects into fallback.
  return "overlay";
}
