import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const tempRoot = resolve(root, ".tmp/chrome-qa");
const output = resolve(process.env.PEEK_QA_OUTPUT ?? resolve(tempRoot, "evidence"));
const chromePath = process.env.PEEK_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = resolve(tempRoot, `profile-${process.pid}`);
const fixtures = resolve(root, "scripts/fixtures");
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${pending.method}: ${JSON.stringify(message.error)}`));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolveResult, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: timed out waiting for CDP response`));
      }, 10000);
      this.pending.set(id, { resolve: resolveResult, reject, method, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    this.socket.close();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(label, check, timeoutMs = 5000) {
  const started = performance.now();
  let lastError;
  while (performance.now() - started < timeoutMs) {
    try {
      const value = await check();
      if (value) return { value, elapsedMs: performance.now() - started };
    } catch (error) {
      lastError = error;
    }
    await delay(10);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError}` : ""}`);
}

async function startFixtureServer() {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${request.headers.host}`).pathname);
    const relative = normalize(pathname).replace(/^[/\\]+/, "");
    const file = join(fixtures, relative || "source.html");
    if (!file.startsWith(fixtures)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "content-type": extname(file) === ".html" ? "text/html; charset=utf-8" : "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return { server, port: server.address().port };
}

async function waitForDebuggerPort() {
  const portFile = resolve(profile, "DevToolsActivePort");
  const found = await waitFor("Chrome DevToolsActivePort", async () => {
    try {
      const [port, path] = (await readFile(portFile, "utf8")).trim().split("\n");
      return port && path ? { port: Number(port), path } : undefined;
    } catch {
      return undefined;
    }
  }, 15000);
  return found.value;
}

function targetFilter(type) {
  return { filter: [{ type, exclude: false }, { exclude: true }] };
}

async function targets(client, type) {
  return (await client.send("Target.getTargets", type ? targetFilter(type) : {})).targetInfos;
}

async function targetByUrl(client, type, suffix) {
  const found = await waitFor(`${type} target ${suffix}`, async () =>
    (await targets(client, type)).find((target) => target.url.endsWith(suffix)),
  );
  return found.value;
}

async function attach(client, targetId) {
  return (await client.send("Target.attachToTarget", { targetId, flatten: true })).sessionId;
}

async function axTree(client, sessionId) {
  return (await client.send("Accessibility.getFullAXTree", {}, sessionId)).nodes;
}

function axRole(nodes, role) {
  return nodes.filter((node) => node.role?.value === role);
}

function axText(nodes) {
  return nodes.map((node) => `${node.name?.value ?? ""} ${node.value?.value ?? ""}`).join("\n");
}

async function waitForOverlay(client, sessionId, timeoutMs) {
  return waitFor("Peek combobox", async () => {
    const nodes = await axTree(client, sessionId);
    const combobox = axRole(nodes, "combobox")[0];
    return combobox ? { nodes, combobox } : undefined;
  }, timeoutMs);
}

async function waitForOverlayClosed(client, sessionId) {
  return waitFor("Peek teardown", async () => axRole(await axTree(client, sessionId), "combobox").length === 0);
}

async function press(client, sessionId, key, code = key, modifiers = 0) {
  const keyCode = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, k: 75, " ": 32 }[key] ?? key.toUpperCase().charCodeAt(0);
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, sessionId);
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, sessionId);
}

async function capture(client, sessionId, name) {
  const result = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true }, sessionId);
  const path = resolve(output, name);
  await writeFile(path, Buffer.from(result.data, "base64"));
  return path;
}

async function main() {
  await readFile(resolve(dist, "manifest.json"), "utf8");
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(profile, { recursive: true });
  await mkdir(output, { recursive: true });

  const { server, port: fixturePort } = await startFixtureServer();
  const sourceUrl = `http://127.0.0.1:${fixturePort}/source.html`;
  const orionUrl = `http://127.0.0.1:${fixturePort}/orion-retry.html`;
  const atlasUrl = `http://127.0.0.1:${fixturePort}/atlas.html`;
  const chrome = spawn(chromePath, [
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--remote-allow-origins=*",
    "--new-window",
    sourceUrl,
  ], { stdio: "ignore" });

  let client;
  try {
    const debuggerPort = await waitForDebuggerPort();
    const version = await (await fetch(`http://127.0.0.1:${debuggerPort.port}/json/version`)).json();
    client = new CdpClient(version.webSocketDebuggerUrl);
    await client.connect();

    const { id: extensionId } = await client.send("Extensions.loadUnpacked", {
      path: dist,
      enableInIncognito: false,
    });
    const loaded = (await client.send("Extensions.getExtensions")).extensions.find((extension) => extension.id === extensionId);
    assert(loaded?.enabled && loaded.path === dist, "Chrome did not report the exact unpacked build as enabled");
    await delay(500);

    const sourcePage = await targetByUrl(client, "page", "/source.html");
    const sourceTab = await targetByUrl(client, "tab", "/source.html");
    const sourceSession = await attach(client, sourcePage.targetId);
    await client.send("Page.enable", {}, sourceSession);
    await client.send("Accessibility.enable", {}, sourceSession);
    await client.send("Target.activateTarget", { targetId: sourcePage.targetId });
    await client.send("Page.bringToFront", {}, sourceSession);
    await delay(100);
    await capture(client, sourceSession, "00-before-action.png");

    await client.send("Extensions.triggerAction", { id: extensionId, targetId: sourceTab.targetId });
    const overlayReady = waitForOverlay(client, sourceSession);
    const firstCharacter = delay(50).then(() => client.send("Input.insertText", { text: "o" }, sourceSession));
    const frameDelays = [0, 10, 25, 50, 100];
    let previous = 0;
    for (const frameDelay of frameDelays) {
      await delay(Math.max(0, frameDelay - previous));
      previous = frameDelay;
      await capture(client, sourceSession, `01-reveal-${String(frameDelay).padStart(3, "0")}ms.png`);
    }
    const firstReady = await overlayReady;
    await firstCharacter;
    const firstOverlay = await waitFor("first query character", async () => {
      const nodes = await axTree(client, sourceSession);
      const combobox = axRole(nodes, "combobox")[0];
      return combobox?.value?.value === "o" ? { nodes, combobox } : undefined;
    });
    const query = firstOverlay.value.combobox.value.value;
    const firstInputReadyMs = firstReady.elapsedMs;

    const worker = await waitFor("Peek service worker", async () =>
      (await targets(client)).find((target) => target.type === "service_worker" && target.url.startsWith(`chrome-extension://${extensionId}/`)),
    );
    const workerSession = await attach(client, worker.value.targetId);
    const evalWorker = async (expression) => {
      const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, workerSession);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const commands = await evalWorker("new Promise((resolve) => chrome.commands.getAll(resolve))");
    const actionCommand = commands.find((command) => command.name === "_execute_action");
    assert(actionCommand?.shortcut === "⌃Space", `Expected physical Control+Space, got ${JSON.stringify(actionCommand?.shortcut)}`);

    const stateExpression = `Promise.all([chrome.windows.getAll({populate:true}),chrome.windows.getLastFocused({populate:true})]).then(([windows,last])=>({lastFocusedWindowId:last.id,windows:windows.map(w=>({id:w.id,focused:w.focused,type:w.type,incognito:w.incognito,tabs:(w.tabs||[]).map(t=>({id:t.id,active:t.active,title:t.title,url:t.url}))}))}))`;
    const browserState = () => evalWorker(stateExpression);
    const sourceState = await browserState();
    const sourceChromeTab = sourceState.windows.flatMap((window) => window.tabs.map((tab) => ({ ...tab, windowId: window.id }))).find((tab) => tab.url === sourceUrl);
    assert(sourceChromeTab, "Source Chrome tab was not found");
    const focusSource = () => evalWorker(`chrome.tabs.update(${sourceChromeTab.id},{active:true}).then(()=>chrome.windows.update(${sourceChromeTab.windowId},{focused:true}))`);

    await press(client, sourceSession, "Escape");
    await waitForOverlayClosed(client, sourceSession);

    await client.send("Target.createTarget", { url: orionUrl, newWindow: true });
    const orionPage = await targetByUrl(client, "page", "/orion-retry.html");
    await targetByUrl(client, "tab", "/orion-retry.html");
    await focusSource();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await client.send("Input.insertText", { text: "orion" }, sourceSession);
    const filtered = await waitFor("Orion filtered result", async () => {
      const nodes = await axTree(client, sourceSession);
      return axText(nodes).includes("Fix retry in Orion scheduler") ? nodes : undefined;
    });
    assert(axRole(filtered.value, "option").length === 1, "Orion filter did not produce one exact result");
    await capture(client, sourceSession, "02-filtered-cross-window.png");
    await press(client, sourceSession, "Enter");
    await waitForOverlayClosed(client, sourceSession);
    const committedState = await browserState();
    const committedWindow = committedState.windows.find((window) => window.id === committedState.lastFocusedWindowId);
    assert(committedWindow?.tabs.some((tab) => tab.active && tab.url === orionUrl), "Cross-window commit did not focus the exact Orion tab and window");

    await focusSource();
    const beforeEscape = await browserState();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await press(client, sourceSession, "ArrowDown");
    await press(client, sourceSession, "Escape");
    await waitForOverlayClosed(client, sourceSession);
    const afterEscape = await browserState();
    assert(afterEscape.lastFocusedWindowId === beforeEscape.lastFocusedWindowId, "Escape changed the focused window");

    await focusSource();
    const beforeBackdrop = await browserState();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 4, y: 4, button: "left", clickCount: 1 }, sourceSession);
    await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 4, y: 4, button: "left", clickCount: 1 }, sourceSession);
    await waitForOverlayClosed(client, sourceSession);
    const afterBackdrop = await browserState();
    assert(afterBackdrop.lastFocusedWindowId === beforeBackdrop.lastFocusedWindowId, "Backdrop cancellation changed the focused window");

    await focusSource();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await client.send("Input.insertText", { text: "source" }, sourceSession);
    await press(client, sourceSession, "Enter");
    await waitForOverlayClosed(client, sourceSession);
    const noOpState = await browserState();
    assert(noOpState.lastFocusedWindowId === sourceChromeTab.windowId, "Current-target commit moved focus");

    await client.send("Target.createTarget", { url: atlasUrl, newWindow: true });
    const atlasPage = await targetByUrl(client, "page", "/atlas.html");
    await targetByUrl(client, "tab", "/atlas.html");
    await focusSource();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await client.send("Input.insertText", { text: "atlas" }, sourceSession);
    await waitFor("Atlas filtered result", async () => axText(await axTree(client, sourceSession)).includes("Atlas uploader retry"));
    await client.send("Target.closeTarget", { targetId: atlasPage.targetId });
    await press(client, sourceSession, "Enter");
    const stale = await waitFor("stale-target error", async () => {
      const nodes = await axTree(client, sourceSession);
      return axText(nodes).includes("That tab is no longer open") ? nodes : undefined;
    });
    assert(axText(stale.value).includes("Could not load tabs"), "Stale target did not retain the deliberate error composition");
    await capture(client, sourceSession, "03-stale-target-error.png");
    await press(client, sourceSession, "Escape");
    await waitForOverlayClosed(client, sourceSession);

    await focusSource();
    await press(client, sourceSession, "k", "KeyK", 4);
    const siteShortcut = await client.send("Runtime.evaluate", { expression: "document.querySelector('p').textContent", returnByValue: true }, sourceSession);
    assert(siteShortcut.result.value === "Site shortcut received", "Closed-Peek site shortcut did not reach the page");

    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await delay(120);
    await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] }, sourceSession);
    await delay(30);
    await capture(client, sourceSession, "04-light.png");
    await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] }, sourceSession);
    await delay(30);
    await capture(client, sourceSession, "05-dark.png");
    await client.send("Emulation.setDeviceMetricsOverride", { width: 480, height: 720, deviceScaleFactor: 1, mobile: false }, sourceSession);
    await capture(client, sourceSession, "06-narrow-dark.png");
    await client.send("Emulation.clearDeviceMetricsOverride", {}, sourceSession);
    await press(client, sourceSession, "Escape");
    await waitForOverlayClosed(client, sourceSession);

    let physicalKeyboardShortcutInvocation = "unverified: rerun with PEEK_QA_MANUAL_SHORTCUT=1";
    if (process.env.PEEK_QA_MANUAL_SHORTCUT === "1") {
      await focusSource();
      console.log("Manual gate: press physical Control+Space in the focused disposable Chrome window now.");
      await waitForOverlay(client, sourceSession, 30000);
      physicalKeyboardShortcutInvocation = "pass: overlay opened after physical Control+Space";
      await capture(client, sourceSession, "07-physical-shortcut.png");
      await press(client, sourceSession, "Escape");
    }

    const report = {
      browser: version.Browser,
      product: "Google Chrome",
      profile,
      fixtureOrigin: `http://127.0.0.1:${fixturePort}`,
      extension: { id: extensionId, path: loaded.path, enabled: loaded.enabled },
      command: actionCommand,
      invocation: {
        method: "CDP Extensions.triggerAction",
        firstInputReadyAndObservedMs: Number(firstInputReadyMs.toFixed(2)),
        firstCharacter: query,
        note: "CDP page key events do not traverse Chrome's browser-accelerator dispatcher; physical shortcut invocation remains a manual gate.",
      },
      checks: {
        unpackedLoad: "pass",
        coherentRevealFilmstrip: "captured",
        firstCharacter: "pass at 50ms after action dispatch",
        titleUrlFilter: "pass",
        crossWindowExactCommitAndFocus: "pass",
        escapeNoActivation: "pass",
        backdropNoActivation: "pass",
        currentTargetNoOp: "pass",
        staleTargetErrorNoSubstitution: "pass",
        closedPeekSiteShortcut: "pass",
        lightDarkNarrowScreenshots: "captured",
        physicalKeyboardShortcutInvocation,
      },
    };
    await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    console.log(`Evidence: ${output}`);
  } finally {
    if (client) {
      try {
        await client.send("Browser.close");
      } catch {
        // Chrome may close the DevTools socket before replying.
      }
      client.close();
    }
    server.close();
    await Promise.race([
      new Promise((resolveExit) => chrome.once("exit", resolveExit)),
      delay(2000),
    ]);
    if (chrome.exitCode === null) chrome.kill("SIGTERM");
  }
}

await main();
