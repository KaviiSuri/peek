import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

describe("MV3 metadata scope", () => {
  it("uses reserved action invocation with a remappable Control+Space suggestion", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.commands._execute_action.suggested_key).toEqual({
      default: "Ctrl+Space",
      mac: "MacCtrl+Space",
    });
    expect(manifest.action.default_popup).toBeUndefined();
  });

  it("has only gesture-scoped execution and tab metadata permissions", () => {
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "tabs"]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
  });
});
