import type { PeekTab } from "../shared/model";

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase().replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();
}

interface TokenMatch {
  readonly quality: "exact" | "contiguous" | "dropped-character";
  readonly position: number;
}

interface SearchEvidence {
  readonly tab: PeekTab;
  readonly coverage: number;
  readonly qualities: readonly TokenMatch["quality"][];
  readonly repositoryHome: boolean;
  readonly contiguousPhrase: boolean;
  readonly queryOrder: boolean;
}

const qualityOrder: Record<TokenMatch["quality"], number> = {
  exact: 3,
  contiguous: 2,
  "dropped-character": 1,
};

function lexicalTerms(value: string): string[] {
  return normalizeSearchText(value).match(/[\p{Letter}\p{Number}]+/gu) ?? [];
}

function droppedCharacterMatch(token: string, word: string): boolean {
  if (token.length < 4 || word.length < token.length || word.length > token.length + 4) return false;
  let tokenIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let wordIndex = 0; wordIndex < word.length && tokenIndex < token.length; wordIndex += 1) {
    if (word[wordIndex] !== token[tokenIndex]) continue;
    if (firstMatch < 0) firstMatch = wordIndex;
    lastMatch = wordIndex;
    tokenIndex += 1;
  }
  return tokenIndex === token.length && lastMatch - firstMatch + 1 <= token.length + 2;
}

function bestTokenMatch(token: string, text: string): TokenMatch | undefined {
  if (!/[\p{Letter}\p{Number}]/u.test(token)) {
    const position = text.indexOf(token);
    return position >= 0 ? { quality: "contiguous", position } : undefined;
  }
  const words = lexicalTerms(text);
  let offset = 0;
  let best: TokenMatch | undefined;
  for (const word of words) {
    const position = text.indexOf(word, offset);
    offset = position + word.length;
    const candidate: TokenMatch | undefined = word === token
      ? { quality: "exact", position }
      : word.includes(token)
        ? { quality: "contiguous", position: position + word.indexOf(token) }
        : droppedCharacterMatch(token, word)
          ? { quality: "dropped-character", position }
          : undefined;
    if (candidate && (!best || qualityOrder[candidate.quality] > qualityOrder[best.quality])) best = candidate;
  }
  return best;
}

function repositoryHomeMatch(tab: PeekTab, tokens: readonly string[]): boolean {
  if (tokens.length !== 1) return false;
  try {
    const url = new URL(tab.url);
    const path = url.pathname.split("/").filter(Boolean);
    return url.hostname === "github.com" && path.length === 2 && bestTokenMatch(tokens[0]!, path[1]!) !== undefined;
  } catch {
    return false;
  }
}

function evidenceFor(tab: PeekTab, tokens: readonly string[], normalizedQuery: string): SearchEvidence | undefined {
  if (tokens.length === 0) {
    return { tab, coverage: 0, qualities: [], repositoryHome: false, contiguousPhrase: false, queryOrder: true };
  }

  const title = normalizeSearchText(tab.title);
  const url = normalizeSearchText(tab.url);
  const combined = `${title} ${url}`;
  const matches = tokens.map((token) => {
    const titleMatch = bestTokenMatch(token, title);
    const urlMatch = bestTokenMatch(token, url);
    if (!titleMatch) return urlMatch ? { ...urlMatch, position: title.length + 1 + urlMatch.position } : undefined;
    if (!urlMatch || qualityOrder[titleMatch.quality] >= qualityOrder[urlMatch.quality]) return titleMatch;
    return { ...urlMatch, position: title.length + 1 + urlMatch.position };
  });
  const present = matches.filter((match): match is TokenMatch => match !== undefined);
  if (present.length === 0) return undefined;

  return {
    tab,
    coverage: present.length,
    qualities: present.map((match) => match.quality).sort((left, right) => qualityOrder[left] - qualityOrder[right]),
    repositoryHome: repositoryHomeMatch(tab, tokens),
    contiguousPhrase: title.includes(normalizedQuery) || url.includes(normalizedQuery),
    queryOrder: present.length === tokens.length && matches.every((match, index) => index === 0 || match!.position >= matches[index - 1]!.position),
  };
}

function compareTextualEvidence(left: SearchEvidence, right: SearchEvidence): number {
  if (left.coverage !== right.coverage) return right.coverage - left.coverage;
  if (left.contiguousPhrase !== right.contiguousPhrase) return left.contiguousPhrase ? -1 : 1;
  for (let index = 0; index < left.qualities.length; index += 1) {
    const difference = qualityOrder[right.qualities[index]!] - qualityOrder[left.qualities[index]!];
    if (difference !== 0) return difference;
  }
  if (left.repositoryHome !== right.repositoryHome) return left.repositoryHome ? -1 : 1;
  if (left.queryOrder !== right.queryOrder) return left.queryOrder ? -1 : 1;
  return 0;
}

export function searchTabs(tabs: readonly PeekTab[], query: string): PeekTab[] {
  const normalizedQuery = normalizeSearchText(query);
  const lexicalQuery = lexicalTerms(normalizedQuery);
  const tokens = lexicalQuery.length === 0 && normalizedQuery ? [normalizedQuery] : lexicalQuery;
  const evidence = tabs.flatMap((tab) => {
    const match = evidenceFor(tab, tokens, normalizedQuery);
    return match ? [match] : [];
  });

  return evidence.sort((left, right) => {
    const textual = compareTextualEvidence(left, right);
    if (textual !== 0) return textual;
    if (tokens.length === 0 && left.tab.previous !== right.tab.previous) return left.tab.previous ? -1 : 1;
    if (tokens.length === 0 && left.tab.current !== right.tab.current) return left.tab.current ? 1 : -1;
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
