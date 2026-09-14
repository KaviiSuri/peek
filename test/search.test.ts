import { describe, expect, it } from "vitest";
import { createTabSearch, meaningfulLocation, searchTabs } from "../src/search/search";
import type { PeekTab } from "../src/shared/model";
import { normalSearchFixture, stressSearchFixture } from "./fixtures/search-fixtures";

const tab = (id: number, title: string, overrides: Partial<PeekTab> = {}): PeekTab => ({
  id, title, url: "https://x.test", windowId: 1, current: false, lastAccessed: 0, ...overrides,
});
const ids = (tabs: readonly PeekTab[], query: string) => searchTabs(tabs, query).map((item) => item.id);

describe("fzf tab search", () => {
  it("preserves previous-first, non-current MRU order only for blank queries", () => {
    const tabs = [tab(1, "Notes", { current: true, lastAccessed: 900 }), tab(2, "Notes", { previous: true }), tab(3, "Notes", { lastAccessed: 500 }), tab(4, "Notes", { lastAccessed: 100 })];
    expect(ids(tabs, "")).toEqual([2, 3, 4, 1]);
    expect(ids(tabs, " \t ")).toEqual([2, 3, 4, 1]);
    // Equal text retains discovery order, not recency or previous/current flags.
    expect(ids(tabs, "notes")).toEqual([1, 2, 3, 4]);
    expect(ids([tab(1, "Older", { previous: false, lastAccessed: 1 }), tab(2, "Newer", { lastAccessed: 2 })], "")).toEqual([2, 1]);
  });

  it("matches short abbreviations and subsequences spanning word boundaries", () => {
    expect(ids([tab(1, "GitHub"), tab(2, "Notes")], "gh")).toEqual([1]);
    expect(ids([tab(1, "Alpha Beta Console"), tab(2, "Notes")], "abc")).toEqual([1]);
    expect(ids([tab(1, "a very wide b then c")], "abc")).toEqual([1]);
  });

  it("rewards compact runs, word starts and camelCase rather than recent use", () => {
    expect(ids([tab(1, "a very wide b then c", { lastAccessed: 999 }), tab(2, "abc")], "abc")).toEqual([2, 1]);
    expect(ids([tab(1, "mygithub"), tab(2, "GitHub")], "gh")).toEqual([2, 1]);
    expect(ids([tab(1, "Alpha Beta Console"), tab(2, "albatrossbackgroundcache")], "abc")).toEqual([1, 2]);
  });

  it("requires every space-separated term, in either order and across title/location", () => {
    const tabs = [tab(1, "Auth fix", { url: "https://github.com/team/project/pull/912" }), tab(2, "Auth notes"), tab(3, "Other", { url: "https://github.com/team/project/pull/912" })];
    expect(ids(tabs, "github auth 912")).toEqual([1]);
    expect(ids(tabs, "912 auth github")).toEqual([1]);
    expect(ids(tabs, "auth zzzzzzz")).toEqual([]);
  });

  it("uses smart case per term without destroying candidate capitalization", () => {
    const tabs = [tab(1, "GitHub Auth"), tab(2, "github auth")];
    expect(ids(tabs, "github auth").sort()).toEqual([1, 2]);
    expect(ids(tabs, "GitHub auth")).toEqual([1]);
    expect(ids(tabs, "GITHUB")).toEqual([]);
  });

  it("supports exact, prefix, suffix, exclusion and OR syntax", () => {
    const tabs = [tab(1, "GitHub alpha", { url: "https://x.test/alpha" }), tab(2, "Go to hub beta", { url: "https://x.test/beta" }), tab(3, "Docs beta", { url: "https://x.test/beta" })];
    expect(ids(tabs, "'github")).toEqual([1]);
    expect(ids(tabs, "^GitHub")).toEqual([1]);
    expect(ids(tabs, "alpha$")).toEqual([1]);
    expect(ids(tabs, "!beta")).toEqual([1]);
    expect(ids(tabs, "alpha | docs").sort()).toEqual([1, 3]);
    expect(ids(tabs, "!zzzzzz")).toHaveLength(3);
  });

  it("does not implement substitutions or transpositions", () => {
    const tabs = [tab(1, "github")];
    expect(ids(tabs, "gthb")).toEqual([1]);
    expect(ids(tabs, "githib")).toEqual([]);
    expect(ids(tabs, "githbu")).toEqual([]);
  });

  it("breaks score ties by shorter label then stable discovery order, without a GitHub special case", () => {
    const tabs = [tab(1, "Match extended", { lastAccessed: 999 }), tab(2, "Match"), tab(3, "Match")];
    expect(ids(tabs, "match")).toEqual([2, 3, 1]);
    const equalLengthHosts = [tab(1, "project", { url: "https://gitlab.com/team/project" }), tab(2, "project", { url: "https://github.com/team/project" })];
    expect(ids(equalLengthHosts, "project")).toEqual([1, 2]);
  });

  it("preserves punctuation as query content rather than silently clearing it", () => {
    const tabs = [tab(1, "C++ reference"), tab(2, "Meeting notes")];
    expect(ids(tabs, "++")).toEqual([1]);
    expect(ids(tabs, "%%")).toEqual([]);
  });

  it("normalizes canonical Unicode but does not silently strip accents", () => {
    const tabs = [tab(1, "Cafe\u0301", { url: "https://x.zz" }), tab(2, "Cafe", { url: "https://x.zz" })];
    expect(ids(tabs, "café")).toEqual([1]);
    expect(ids(tabs, "cafe")).toEqual([2]);
  });

  it("returns the published matcher's UTF-16 positions for the displayed title and URL", () => {
    const [match] = createTabSearch([tab(1, "🧭 GitHub Cafe\u0301", { url: "https://x.test/#auth" })])("gh auth");
    expect(match?.title).toBe("🧭 GitHub Café");
    expect([...match!.titlePositions].sort((a, b) => a - b)).toEqual([3, 6]);
    const location = match!.location;
    expect([...match!.locationPositions].sort((a, b) => a - b).map((index) => location[index]).join("")).toBe("auth");
    expect(createTabSearch([tab(1, "Notes")])("!zzzzz")[0]?.titlePositions.size).toBe(0);
  });

  it("reuses a model index without mutating metadata or leaking a previous query's positions", () => {
    const tabs = Object.freeze([Object.freeze(tab(1, "GitHub")), Object.freeze(tab(2, "Notes"))]);
    const find = createTabSearch(tabs);
    const first = find("gh");
    expect(find("notes").map((match) => match.tab.id)).toEqual([2]);
    expect(find("").every((match) => match.titlePositions.size === 0 && match.locationPositions.size === 0)).toBe(true);
    expect(find("gh")).toEqual(first);
    expect(first[0]?.tab).toBe(tabs[0]);
  });

  it("handles the existing30/100-tab ambiguity fixtures with all-term filtering", () => {
    expect(normalSearchFixture).toHaveLength(30);
    expect(ids(normalSearchFixture, "orion retry").slice(0, 2).sort()).toEqual([1, 4]);
    expect(ids(normalSearchFixture, "orion retry")).not.toContain(6);
    expect(ids(normalSearchFixture, "github auth 880")[0]).toBe(11);
    expect(ids(normalSearchFixture, "sched rtry").slice(0, 2)).toEqual([1, 4]);
    expect(ids(normalSearchFixture, "orion incident")[0]).toBe(23);
    expect(ids(normalSearchFixture, "postmortem")[0]).toBe(23);
    const find = createTabSearch(stressSearchFixture);
    const start = performance.now();
    const first = find("sched rtry");
    console.info(`100-tab fzf query: ${(performance.now() - start).toFixed(3)}ms, informational only`);
    expect(first[0]?.tab.id).toBe(1);
    expect(find("sched rtry")).toEqual(first);
    expect(stressSearchFixture).toHaveLength(100);
  });
});

describe("meaningfulLocation", () => {
  it("keeps searchable ports, paths, query and fragment while excluding scheme and credentials", () => {
    expect(meaningfulLocation("https://github.com/acme/orion/pull/21?view=files")).toBe("github.com/acme/orion/pull/21?view=files");
    expect(meaningfulLocation("https://example.com/")).toBe("example.com");
    expect(meaningfulLocation("https://user:password@example.com:8443/app?x=1#auth")).toBe("example.com:8443/app?x=1#auth");
    expect(meaningfulLocation("https://example.com/app#section/")).toBe("example.com/app#section/");
    expect(meaningfulLocation("not a URL")).toBe("not a URL");
  });
});
