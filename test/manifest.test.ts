import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

describe("MV3 metadata scope", () => {
  it("ships correctly sized PNG icons for Chrome and its toolbar", async () => {
    expect(Object.keys(manifest.icons)).toEqual(["16", "32", "48", "128"]);
    expect(manifest.action.default_icon).toEqual({
      "16": manifest.icons["16"],
      "32": manifest.icons["32"],
    });
    for (const [size, path] of Object.entries(manifest.icons)) {
      const png = await readFile(new URL(`../${path}`, import.meta.url));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.toString("ascii", 12, 16)).toBe("IHDR");
      expect(png.readUInt32BE(16)).toBe(Number(size));
      expect(png.readUInt32BE(20)).toBe(Number(size));
    }
  });

  it("uses reserved action invocation with a remappable Control+Space suggestion", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.commands._execute_action.suggested_key).toEqual({
      default: "Ctrl+Space",
      mac: "MacCtrl+Space",
    });
    expect(manifest.action.default_popup).toBeUndefined();
  });

  it("has only gesture-scoped execution, tab metadata and session-state permissions", () => {
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "tabs", "storage", "favicon"]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
  });
});
