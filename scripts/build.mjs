import { cp, mkdir, rm, stat } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await Promise.all([
  build({
    entryPoints: ["src/background.ts"],
    outfile: "dist/background.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    minify: true,
    sourcemap: false,
  }),
  build({
    entryPoints: ["src/overlay.ts"],
    outfile: "dist/overlay.js",
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    minify: true,
    sourcemap: false,
  }),
  build({
    entryPoints: ["src/fallback.ts"],
    outfile: "dist/fallback.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    minify: true,
    sourcemap: false,
  }),
]);
await Promise.all([
  cp("manifest.json", "dist/manifest.json"),
  cp("fallback.html", "dist/fallback.html"),
  cp("icons", "dist/icons", { recursive: true }),
]);

const sizes = await Promise.all(["background.js", "overlay.js", "fallback.js", "fallback.html"].map(async (file) => ({
  file,
  bytes: (await stat(`dist/${file}`)).size,
})));
for (const { file, bytes } of sizes) console.log(`${file}: ${bytes} bytes`);
