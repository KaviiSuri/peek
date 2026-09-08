// Only browser-produced raster bytes cross into the invoked document. Never
// assign a remote URL or SVG payload to a content-side image, even on malformed
// or controlled model delivery. Bound each decoded icon to 32 KiB.
export const MAX_ICON_BYTES = 32 * 1024;
export function isSafeFavicon(value: string | undefined): value is string {
  return value !== undefined && value.length <= 22 + 4 * Math.ceil(MAX_ICON_BYTES / 3) &&
    /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
