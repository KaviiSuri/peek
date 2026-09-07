import type { PeekTab } from "../shared/model";

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();
}

interface RankedTab {
  readonly tab: PeekTab;
  readonly score: number;
}

function scoreTab(tab: PeekTab, query: string): number | undefined {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return 0;

  const title = normalizeSearchText(tab.title);
  const url = normalizeSearchText(tab.url);
  let score = 0;

  for (const token of tokens) {
    const titleIndex = title.indexOf(token);
    const urlIndex = url.indexOf(token);
    if (titleIndex < 0 && urlIndex < 0) return undefined;
    if (titleIndex >= 0) score += titleIndex === 0 ? 30 : 20;
    if (urlIndex >= 0) score += urlIndex === 0 ? 12 : 8;
  }

  const normalizedQuery = tokens.join(" ");
  if (title.includes(normalizedQuery)) score += 40;
  if (url.includes(normalizedQuery)) score += 16;
  return score;
}

export function searchTabs(tabs: readonly PeekTab[], query: string): PeekTab[] {
  const ranked: RankedTab[] = [];
  for (const tab of tabs) {
    const score = scoreTab(tab, query);
    if (score !== undefined) ranked.push({ tab, score });
  }

  return ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (!query.trim() && left.tab.previous !== right.tab.previous) return left.tab.previous ? -1 : 1;
    if (!query.trim() && left.tab.current !== right.tab.current) return left.tab.current ? 1 : -1;
    if (right.tab.lastAccessed !== left.tab.lastAccessed) return right.tab.lastAccessed - left.tab.lastAccessed;
    return left.tab.id - right.tab.id;
  }).map(({ tab }) => tab);
}

export function meaningfulLocation(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const path = `${url.pathname}${url.search}`;
    const usefulPath = path === "/" ? "" : path.replace(/\/$/, "");
    return `${url.hostname}${usefulPath}`;
  } catch {
    return rawUrl;
  }
}
