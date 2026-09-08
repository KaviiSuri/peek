// Only browser-produced raster bytes cross into the invoked document. Never
// assign a remote URL or SVG payload to a content-side image, even on malformed
// or controlled model delivery. Bound each decoded icon to 32 KiB.
export const MAX_ICON_BYTES = 32 * 1024;
export function isSafeFavicon(value: string | undefined): value is string {
  if (value === undefined) return false;
  const encodedLength = value.length - 22;
  const decodedLength = encodedLength / 4 * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  return decodedLength <= MAX_ICON_BYTES && encodedLength % 4 === 0 &&
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
