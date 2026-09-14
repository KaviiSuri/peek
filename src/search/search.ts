import { Fzf, extendedMatch, byLengthAsc } from "fzf";
import type { PeekTab } from "../shared/model";

export interface TabMatch {
  readonly tab: PeekTab;
  // fzf@0.5.2 returns UTF-16 offsets, not code-point indices. Keep the
  // displayed NFC text identical to the indexed text.
  readonly title: string;
  readonly location: string;
  readonly titlePositions: ReadonlySet<number>;
  readonly locationPositions: ReadonlySet<number>;
}

export function meaningfulLocation(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const path = `${url.pathname}${url.search}${url.hash}`;
    const usefulPath = path === "/" ? "" : path;
    return `${url.host}${usefulPath}`;
  } catch {
    return rawUrl;
  }
}

function compareBlankQuery(left: PeekTab, right: PeekTab): number {
  if (Boolean(left.previous) !== Boolean(right.previous)) return left.previous ? -1 : 1;
  if (left.current !== right.current) return left.current ? 1 : -1;
  return right.lastAccessed - left.lastAccessed || left.id - right.id;
}

/** Build once per model snapshot. No case folding: it would erase fzf's
 * camelCase bonuses and smart-case behavior. Nonempty queries use only fzf
 * evidence, shorter-label tie breaking and stable discovery order. */
export function createTabSearch(tabs: readonly PeekTab[]): (query: string) => TabMatch[] {
  const candidates = tabs.map((tab) => {
    const title = tab.title.normalize("NFC");
    const location = meaningfulLocation(tab.url).normalize("NFC");
    return { tab, title, location, text: `${title} ${location}`, locationOffset: title.length + 1 };
  });
  const finder = new Fzf(candidates, {
    selector: (candidate) => candidate.text,
    match: extendedMatch,
    fuzzy: "v2",
    casing: "smart-case",
    normalize: false,
    tiebreakers: [byLengthAsc],
  });
  return (query) => {
    if (!query.trim()) {
      return [...candidates].sort((a, b) => compareBlankQuery(a.tab, b.tab)).map(({ tab, title, location }) => ({
        tab, title, location, titlePositions: new Set<number>(), locationPositions: new Set<number>(),
      }));
    }
    return finder.find(query.normalize("NFC")).map(({ item, positions }) => {
      const titlePositions = new Set<number>();
      const locationPositions = new Set<number>();
      for (const position of positions) {
        if (position < item.locationOffset - 1) titlePositions.add(position);
        else if (position >= item.locationOffset) locationPositions.add(position - item.locationOffset);
      }
      return { tab: item.tab, title: item.title, location: item.location, titlePositions, locationPositions };
    });
  };
}

export function searchTabs(tabs: readonly PeekTab[], query: string): PeekTab[] {
  return createTabSearch(tabs)(query).map((match) => match.tab);
}
