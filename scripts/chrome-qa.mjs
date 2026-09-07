import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = resolve(import.meta.dirname, "..");
const temp = resolve(root, ".tmp/chrome-qa");
const profile = resolve(temp, "profile");
const dist = resolve(root, "dist");
const port = 43117;

await readFile(resolve(dist, "manifest.json"), "utf8");
await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });

const serverLog = await import("node:fs").then(({ openSync }) => openSync(resolve(temp, "fixture-server.log"), "a"));
const server = spawn(process.execPath, [resolve(root, "scripts/fixture-server.mjs"), String(port)], {
  detached: true,
  stdio: ["ignore", serverLog, serverLog],
});
server.unref();
await writeFile(resolve(temp, "fixture-server.pid"), String(server.pid));
await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));

const common = [
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  `--disable-extensions-except=${dist}`,
  `--load-extension=${dist}`,
];
spawn(chrome, [...common, "--new-window", "chrome://extensions/", `http://127.0.0.1:${port}/source.html`], { detached: true, stdio: "ignore" }).unref();
await new Promise((resolveDelay) => setTimeout(resolveDelay, 900));
spawn(chrome, [...common, "--new-window", `http://127.0.0.1:${port}/orion-retry.html`, `http://127.0.0.1:${port}/atlas.html`], { detached: true, stdio: "ignore" }).unref();

console.log(`Disposable Chrome profile: ${profile}`);
console.log(`Unpacked extension: ${dist}`);
console.log("If Peek is not listed, enable Developer mode and choose Load unpacked, then select the dist directory above.");
console.log("Chrome now restricts command-line unpacked loading in some branded builds, so the one-time Load unpacked click may be required.");
console.log("Run the README Chrome checklist only in these synthetic windows. Close them when finished.");
