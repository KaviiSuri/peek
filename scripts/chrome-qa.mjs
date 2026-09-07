import { execFileSync, spawn } from "node:child_process";
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

async function selectedOverlayTabId(client, sessionId) {
  const document = await client.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
  let selectedId;
  const visit = (node) => {
    const attributes = Object.fromEntries(Array.from({ length: (node.attributes?.length ?? 0) / 2 }, (_, index) => [node.attributes[index * 2], node.attributes[index * 2 + 1]]));
    if (attributes["aria-selected"] === "true" && attributes.id?.startsWith("peek-tab-")) selectedId = Number(attributes.id.slice("peek-tab-".length));
    for (const child of node.children ?? []) visit(child);
    for (const shadow of node.shadowRoots ?? []) visit(shadow);
  };
  visit(document.root);
  return selectedId;
}

async function waitForSelectedOverlayTabId(client, sessionId, label) {
  return (await waitFor(label, async () => {
    const tabId = await selectedOverlayTabId(client, sessionId);
    return tabId === undefined ? undefined : tabId;
  })).value;
}

async function measureOverlay(client, sessionId) {
  const document = await client.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    for (const child of node.children ?? []) visit(child);
    for (const shadow of node.shadowRoots ?? []) visit(shadow);
  };
  visit(document.root);
  const attributes = (node) => Object.fromEntries(Array.from({ length: (node.attributes?.length ?? 0) / 2 }, (_, index) => [node.attributes[index * 2], node.attributes[index * 2 + 1]]));
  const panelNode = nodes.find((node) => attributes(node).class?.split(/\s+/).includes("palette"));
  const inputNode = nodes.find((node) => node.nodeName === "INPUT" && attributes(node)["aria-label"] === "Find a tab by title or URL");
  const selectedNode = nodes.find((node) => attributes(node).role === "option" && attributes(node)["aria-selected"] === "true");
  assert(panelNode && inputNode, "Could not resolve overlay geometry nodes through the pierced DOM tree");
  const rect = async (node) => {
    if (!node) return undefined;
    const { model } = await client.send("DOM.getBoxModel", { nodeId: node.nodeId }, sessionId);
    const xs = [model.border[0], model.border[2], model.border[4], model.border[6]];
    const ys = [model.border[1], model.border[3], model.border[5], model.border[7]];
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return { x: left, y: top, width: right - left, height: bottom - top, top, right, bottom, left };
  };
  const metrics = await client.send("Page.getLayoutMetrics", {}, sessionId);
  const viewport = { width: metrics.cssVisualViewport.clientWidth, height: metrics.cssVisualViewport.clientHeight };
  const panel = await rect(panelNode);
  const accessibility = await axTree(client, sessionId);
  const combobox = axRole(accessibility, "combobox")[0];
  const focused = combobox?.properties?.some((property) => property.name === "focused" && property.value?.value === true);
  return {
    viewport,
    panel,
    input: await rect(inputNode),
    selected: await rect(selectedNode),
    panelCenterDelta: {
      x: panel.left + panel.width / 2 - viewport.width / 2,
      y: panel.top + panel.height / 2 - viewport.height / 2,
    },
    activeElement: focused ? "input" : null,
  };
}

function activeTabIdentity(state) {
  return state.windows
    .flatMap((window) => window.tabs.filter((tab) => tab.active).map((tab) => ({ windowId: window.id, tabId: tab.id, url: tab.url })))
    .sort((left, right) => left.windowId - right.windowId);
}

function sameActiveTabs(left, right) {
  return JSON.stringify(activeTabIdentity(left)) === JSON.stringify(activeTabIdentity(right));
}

function assertStableGeometry(measurements, label) {
  const baseline = measurements.loading.panel;
  for (const [state, measurement] of Object.entries(measurements)) {
    assert(Math.abs(measurement.panelCenterDelta.x) <= 0.5 && Math.abs(measurement.panelCenterDelta.y) <= 0.5, `${label} ${state} panel was not centred`);
    assert(measurement.panel.left >= 0 && measurement.panel.top >= 0 && measurement.panel.right <= measurement.viewport.width && measurement.panel.bottom <= measurement.viewport.height, `${label} ${state} panel exceeded the viewport`);
    assert(Math.abs(measurement.panel.x - baseline.x) <= 0.5 && Math.abs(measurement.panel.y - baseline.y) <= 0.5 && Math.abs(measurement.panel.width - baseline.width) <= 0.5 && Math.abs(measurement.panel.height - baseline.height) <= 0.5, `${label} panel geometry changed from loading to ${state}`);
    assert(measurement.input.top >= measurement.panel.top && measurement.input.bottom <= measurement.panel.bottom, `${label} ${state} input was clipped`);
    if (measurement.selected) assert(measurement.selected.top >= measurement.panel.top && measurement.selected.bottom <= measurement.panel.bottom, `${label} ${state} selected row was clipped`);
    assert(measurement.activeElement === "input", `${label} ${state} input lost focus`);
  }
}

function sendTargetedNativeControlSpace(chrome) {
  const command = execFileSync("/bin/ps", ["-p", String(chrome.pid), "-o", "command="], { encoding: "utf8" }).trim();
  assert(command.startsWith(chromePath) && command.includes(`--user-data-dir=${profile}`), "Refusing native input: Chrome PID did not match the disposable executable and profile");
  const script = `import CoreGraphics
let pid = pid_t(${chrome.pid})
guard CGPreflightPostEventAccess() else { fatalError("CoreGraphics post-event access is not already granted") }
let source = CGEventSource(stateID: .hidSystemState)
let down = CGEvent(keyboardEventSource: source, virtualKey: 49, keyDown: true)!
down.flags = [.maskControl]
down.postToPid(pid)
usleep(20000)
let up = CGEvent(keyboardEventSource: source, virtualKey: 49, keyDown: false)!
up.flags = [.maskControl]
up.postToPid(pid)`;
  execFileSync("/usr/bin/swift", ["-e", script], { stdio: "pipe" });
  return { pid: chrome.pid, executable: chromePath, profile, processCommandVerified: true, preflightPostEventAccess: true, facility: "CoreGraphics CGEvent.postToPid(disposableChromePid)" };
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

    const actionRequestedAt = performance.now();
    const overlayReady = waitForOverlay(client, sourceSession);
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: sourceTab.targetId });
    const actionResponseAt = performance.now();
    const firstCharacter = delay(50).then(async () => {
      const requestedAt = performance.now();
      await client.send("Input.insertText", { text: "o" }, sourceSession);
      return { requestedSinceActionMs: requestedAt - actionRequestedAt, completedSinceActionMs: performance.now() - actionRequestedAt };
    });
    const revealSamples = [];
    for (let index = 1; index <= 5; index += 1) {
      const captureStartedAt = performance.now();
      const name = `01-reveal-sample-${String(index).padStart(2, "0")}.png`;
      await capture(client, sourceSession, name);
      revealSamples.push({
        name,
        captureStartedSinceActionRequestMs: Number((captureStartedAt - actionRequestedAt).toFixed(2)),
        captureCompletedSinceActionRequestMs: Number((performance.now() - actionRequestedAt).toFixed(2)),
      });
      await delay(10);
    }
    const firstReady = await overlayReady;
    const firstCharacterTiming = await firstCharacter;
    let firstOverlay;
    try {
      firstOverlay = await waitFor("first query character", async () => {
        const nodes = await axTree(client, sourceSession);
        const combobox = axRole(nodes, "combobox")[0];
        return combobox?.value?.value === "o" ? { nodes, combobox } : undefined;
      });
    } catch (error) {
      const nodes = await axTree(client, sourceSession).catch(() => []);
      const combobox = axRole(nodes, "combobox")[0];
      const pageState = await client.send("Runtime.evaluate", {
        expression: "({activeTag:document.activeElement?.tagName,activeId:document.activeElement?.id,priorInputValue:document.querySelector('#prior-focus')?.value,peekHostPresent:document.querySelector('#peek-extension-host')!==null})",
        returnByValue: true,
      }, sourceSession).catch(() => undefined);
      const diagnostics = {
        actionRequestToCdpResponseMs: Number((actionResponseAt - actionRequestedAt).toFixed(2)),
        overlayObservedSinceActionRequestMs: Number(firstReady.elapsedMs.toFixed(2)),
        firstCharacterTiming: {
          requestedSinceActionMs: Number(firstCharacterTiming.requestedSinceActionMs.toFixed(2)),
          completedSinceActionMs: Number(firstCharacterTiming.completedSinceActionMs.toFixed(2)),
        },
        overlayComboboxValue: combobox?.value?.value,
        overlayComboboxFocused: combobox?.properties?.some((property) => property.name === "focused" && property.value?.value === true),
        pageState: pageState?.result?.value,
        interpretation: "The retained 50 ms insertion request is unchanged. If priorInputValue contains the character while the combobox does not, the fixed probe preceded overlay focus; this is a readiness observation, not a universal 50 ms product SLA.",
      };
      await capture(client, sourceSession, "01-first-character-failure.png").catch(() => undefined);
      await writeFile(resolve(output, "first-character-failure.json"), `${JSON.stringify(diagnostics, null, 2)}\n`);
      throw new Error(`${error instanceof Error ? error.message : String(error)}; diagnostics: ${resolve(output, "first-character-failure.json")}`);
    }
    const query = firstOverlay.value.combobox.value.value;
    const overlayObservedSinceActionRequestMs = firstReady.elapsedMs;

    const worker = await waitFor("Peek service worker", async () =>
      (await targets(client)).find((target) => target.type === "service_worker" && target.url.startsWith(`chrome-extension://${extensionId}/`)),
    );
    let workerTargetId = worker.value.targetId;
    let workerSession = await attach(client, workerTargetId);
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
    const attentionState = () => evalWorker("chrome.storage.session.get('peekAttentionV1').then(value=>value.peekAttentionV1)");
    const waitForAttention = (label, predicate) => waitFor(label, async () => {
      const state = await attentionState();
      return predicate(state) ? state : undefined;
    });
    const sourceState = await browserState();
    const sourceChromeTab = sourceState.windows.flatMap((window) => window.tabs.map((tab) => ({ ...tab, windowId: window.id }))).find((tab) => tab.url === sourceUrl);
    assert(sourceChromeTab, "Source Chrome tab was not found");
    const focusSource = () => evalWorker(`chrome.tabs.update(${sourceChromeTab.id},{active:true}).then(()=>chrome.windows.update(${sourceChromeTab.windowId},{focused:true}))`);

    await press(client, sourceSession, "Escape");
    await waitForOverlayClosed(client, sourceSession);

    await focusSource();
    const beforePendingEscape = await browserState();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: sourceTab.targetId });
    await waitForOverlay(client, sourceSession);
    await client.send("Input.insertText", { text: "source" }, sourceSession);
    await client.send("Debugger.enable", {}, workerSession);
    await client.send("Debugger.pause", {}, workerSession);
    await press(client, sourceSession, "Enter");
    await delay(50);
    const pendingCommitNodes = await axTree(client, sourceSession);
    const pendingCommitInput = axRole(pendingCommitNodes, "combobox")[0];
    assert(pendingCommitInput?.properties?.some((property) => property.name === "focused" && property.value?.value === true), "Pending commit input lost focus before Escape");
    await capture(client, sourceSession, "02-pending-commit-before-escape.png");
    await press(client, sourceSession, "Escape");
    await waitForOverlayClosed(client, sourceSession);
    await client.send("Debugger.resume", {}, workerSession);
    await delay(100);
    const afterPendingEscape = await browserState();
    assert(afterPendingEscape.lastFocusedWindowId === beforePendingEscape.lastFocusedWindowId && sameActiveTabs(afterPendingEscape, beforePendingEscape), "Escape during a pending commit changed focus or active tabs");

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
    assert(sameActiveTabs(afterEscape, beforeEscape), "Escape changed an active tab identity");

    await focusSource();
    const beforeBackdrop = await browserState();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 4, y: 4, button: "left", clickCount: 1 }, sourceSession);
    await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 4, y: 4, button: "left", clickCount: 1 }, sourceSession);
    await waitForOverlayClosed(client, sourceSession);
    const afterBackdrop = await browserState();
    assert(afterBackdrop.lastFocusedWindowId === beforeBackdrop.lastFocusedWindowId, "Backdrop cancellation changed the focused window");
    assert(sameActiveTabs(afterBackdrop, beforeBackdrop), "Backdrop cancellation changed an active tab identity");

    await focusSource();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/source.html")).targetId });
    await waitForOverlay(client, sourceSession);
    await client.send("Input.insertText", { text: "source" }, sourceSession);
    await press(client, sourceSession, "Enter");
    await waitForOverlayClosed(client, sourceSession);
    const noOpState = await browserState();
    assert(noOpState.lastFocusedWindowId === sourceChromeTab.windowId, "Current-target commit moved focus");
    const focusedSourceWindow = noOpState.windows.find((window) => window.id === sourceChromeTab.windowId);
    assert(focusedSourceWindow?.tabs.some((tab) => tab.active && tab.id === sourceChromeTab.id && tab.url === sourceUrl), "Current-target commit changed the exact source active tab");

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

    const geometryTabs = [
      { id: 902, windowId: 92, title: "Fix retry in Orion scheduler", url: orionUrl, lastAccessed: 20, current: false },
      { id: sourceChromeTab.id, windowId: sourceChromeTab.windowId, title: "Peek source page", url: sourceUrl, lastAccessed: 30, current: true },
    ];
    const sendOverlayMessage = (message) => evalWorker(`chrome.tabs.sendMessage(${sourceChromeTab.id}, ${JSON.stringify(message)})`);
    const probeGeometry = async (label, captureStates = []) => {
      const sessionId = `geometry-${label}`;
      await sendOverlayMessage({ kind: "peek/init", sessionId, sourceTabId: sourceChromeTab.id, sourceWindowId: sourceChromeTab.windowId, model: { status: "loading", tabs: [] } });
      await waitForOverlay(client, sourceSession);
      await delay(100);
      const loading = await measureOverlay(client, sourceSession);
      if (captureStates.includes("loading")) await capture(client, sourceSession, `${label}-loading.png`);
      await delay(150);
      await sendOverlayMessage({ kind: "peek/model", sessionId, model: { status: "ready", tabs: geometryTabs } });
      await delay(100);
      const ready = await measureOverlay(client, sourceSession);
      if (captureStates.includes("ready")) await capture(client, sourceSession, `${label}-ready.png`);
      await sendOverlayMessage({ kind: "peek/model", sessionId, model: { status: "error", tabs: [], message: "Measured error composition." } });
      await delay(100);
      const error = await measureOverlay(client, sourceSession);
      if (captureStates.includes("error")) await capture(client, sourceSession, `${label}-error.png`);
      const measurements = { loading, ready, error };
      assertStableGeometry(measurements, label);
      return measurements;
    };

    await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] }, sourceSession);
    const normalGeometry = await probeGeometry("04-normal-light", ["loading", "ready", "error"]);
    await sendOverlayMessage({ kind: "peek/model", sessionId: "geometry-04-normal-light", model: { status: "ready", tabs: geometryTabs } });
    await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] }, sourceSession);
    await delay(100);
    await capture(client, sourceSession, "05-normal-ready-dark.png");

    await client.send("Emulation.setDeviceMetricsOverride", { width: 480, height: 720, deviceScaleFactor: 1, mobile: false }, sourceSession);
    const narrowGeometry = await probeGeometry("06-narrow-dark", ["loading", "ready"]);
    await client.send("Emulation.setDeviceMetricsOverride", { width: 900, height: 240, deviceScaleFactor: 1, mobile: false }, sourceSession);
    const shortGeometry = await probeGeometry("07-short-dark", ["loading", "ready"]);
    await client.send("Emulation.clearDeviceMetricsOverride", {}, sourceSession);
    await press(client, sourceSession, "Escape");
    await waitForOverlayClosed(client, sourceSession);

    // PEEK-12: exercise observed attention across two real Chrome windows.
    const attentionEvidence = {};
    const attentionBaseline = await browserState();
    const orionChromeTab = attentionBaseline.windows.flatMap((window) => window.tabs.map((tab) => ({ ...tab, windowId: window.id }))).find((tab) => tab.url === orionUrl);
    assert(orionChromeTab, "Orion Chrome tab was not found for attention QA");
    await evalWorker(`chrome.tabs.update(${orionChromeTab.id},{active:true}).then(()=>chrome.windows.update(${orionChromeTab.windowId},{focused:true}))`);
    await waitForAttention("Orion focused attention", (state) => state?.current?.tabId === orionChromeTab.id);
    await focusSource();
    const sourceAttention = await waitForAttention("source current and Orion previous", (state) => state?.current?.tabId === sourceChromeTab.id && state?.previous?.tabId === orionChromeTab.id);

    await client.send("Extensions.triggerAction", { id: extensionId, targetId: sourceTab.targetId });
    await waitForOverlay(client, sourceSession);
    const previousSelectedTabId = await waitForSelectedOverlayTabId(client, sourceSession, "initial selected tab after previous model delivery");
    assert(previousSelectedTabId === orionChromeTab.id, `Expected previous Orion tab ${orionChromeTab.id} selected, got ${previousSelectedTabId}`);
    await capture(client, sourceSession, "08-previous-selected-two-window.png");
    await press(client, sourceSession, "Enter");
    await waitForOverlayClosed(client, sourceSession);
    const returnedAttention = await waitForAttention("open Enter returned to previous", (state) => state?.current?.tabId === orionChromeTab.id && state?.previous?.tabId === sourceChromeTab.id);

    const orionSession = await attach(client, orionPage.targetId);
    await client.send("Page.enable", {}, orionSession);
    await client.send("Accessibility.enable", {}, orionSession);
    const beforeCurrentNoOp = await attentionState();
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targetByUrl(client, "tab", "/orion-retry.html")).targetId });
    await waitForOverlay(client, orionSession);
    await client.send("Input.insertText", { text: "orion" }, orionSession);
    await press(client, orionSession, "Enter");
    await waitForOverlayClosed(client, orionSession);
    const afterCurrentNoOp = await attentionState();
    assert(JSON.stringify(afterCurrentNoOp) === JSON.stringify(beforeCurrentNoOp), "Current-target no-op destroyed previous attention");

    const backgroundUrl = `${atlasUrl}?background-attention=${Date.now()}`;
    const backgroundTab = await evalWorker(`chrome.tabs.create({windowId:${sourceChromeTab.windowId},url:${JSON.stringify(backgroundUrl)},active:true})`);
    const backgroundPage = await waitFor("background-window active page", async () => (await targets(client)).find((target) => target.type === "page" && target.url === backgroundUrl));
    const backgroundSession = await attach(client, backgroundPage.value.targetId);
    await client.send("Page.enable", {}, backgroundSession);
    await client.send("Accessibility.enable", {}, backgroundSession);
    await delay(100);
    const afterBackgroundActivation = await attentionState();
    assert(JSON.stringify(afterBackgroundActivation) === JSON.stringify(afterCurrentNoOp), "Activation in an unfocused window was incorrectly recorded as viewed");
    await evalWorker(`chrome.windows.update(${sourceChromeTab.windowId},{focused:true})`);
    const afterBackgroundFocus = await waitForAttention("background tab observed on focus", (state) => state?.current?.tabId === backgroundTab.id && state?.previous?.tabId === orionChromeTab.id);

    await evalWorker(`chrome.tabs.remove(${orionChromeTab.id})`);
    const afterPreviousRemoval = await waitForAttention("removed previous reconciled", (state) => state?.current?.tabId === backgroundTab.id && state?.previous === undefined);
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targets(client, "tab")).find((target) => target.url === backgroundUrl).targetId });
    await waitForOverlay(client, backgroundSession);
    const missingHistorySelectedTabId = await waitForSelectedOverlayTabId(client, backgroundSession, "initial selected tab after missing-history model delivery");
    assert(missingHistorySelectedTabId !== undefined && missingHistorySelectedTabId !== backgroundTab.id, "Missing history did not select an eligible non-current MRU tab");
    await press(client, backgroundSession, "Escape");
    await waitForOverlayClosed(client, backgroundSession);

    // Establish source -> background, stop the worker, and verify session restoration owns initial selection.
    await focusSource();
    await waitForAttention("source attention before cold restart", (state) => state?.current?.tabId === sourceChromeTab.id);
    await evalWorker(`chrome.tabs.update(${backgroundTab.id},{active:true}).then(()=>chrome.windows.update(${backgroundTab.windowId},{focused:true}))`);
    const beforeWorkerStop = await waitForAttention("known previous before worker stop", (state) => state?.current?.tabId === backgroundTab.id && state?.previous?.tabId === sourceChromeTab.id);
    await client.send("Target.closeTarget", { targetId: workerTargetId });
    await waitFor("Peek worker stopped", async () => !(await targets(client)).some((target) => target.type === "service_worker" && target.url.startsWith(`chrome-extension://${extensionId}/`)));
    await client.send("Extensions.triggerAction", { id: extensionId, targetId: (await targets(client, "tab")).find((target) => target.url === backgroundUrl).targetId });
    await waitForOverlay(client, backgroundSession, 10000);
    const restartedWorker = await waitFor("restarted Peek service worker", async () =>
      (await targets(client)).find((target) => target.type === "service_worker" && target.url.startsWith(`chrome-extension://${extensionId}/`)),
    );
    workerTargetId = restartedWorker.value.targetId;
    workerSession = await attach(client, workerTargetId);
    const afterWorkerRestart = await attentionState();
    const coldSelectedTabId = await waitForSelectedOverlayTabId(client, backgroundSession, "initial selected tab after cold-worker model delivery");
    assert(coldSelectedTabId === sourceChromeTab.id, `Cold worker selected ${coldSelectedTabId}, expected previous source ${sourceChromeTab.id}`);
    await capture(client, backgroundSession, "09-cold-worker-previous-selected.png");
    await press(client, backgroundSession, "Escape");
    await waitForOverlayClosed(client, backgroundSession);

    Object.assign(attentionEvidence, {
      sourceAttention: sourceAttention.value,
      previousSelection: { currentTabId: sourceChromeTab.id, previousTabId: orionChromeTab.id, selectedTabId: previousSelectedTabId },
      openEnterReturn: returnedAttention.value,
      currentNoOp: { before: beforeCurrentNoOp, after: afterCurrentNoOp },
      backgroundWindowActivation: { before: afterCurrentNoOp, afterActivation: afterBackgroundActivation, afterFocus: afterBackgroundFocus.value, activatedTabId: backgroundTab.id },
      removedPrevious: { state: afterPreviousRemoval.value, selectedFallbackTabId: missingHistorySelectedTabId },
      coldWorker: { beforeStop: beforeWorkerStop.value, afterRestart: afterWorkerRestart, selectedTabId: coldSelectedTabId, stoppedTargetId: worker.value.targetId, restartedTargetId: workerTargetId },
    });

    let physicalKeyboardShortcutInvocation = "unverified: rerun with PEEK_QA_NATIVE_SHORTCUT=1 or PEEK_QA_MANUAL_SHORTCUT=1";
    let nativeShortcutTarget;
    if (process.env.PEEK_QA_NATIVE_SHORTCUT === "1" || process.env.PEEK_QA_MANUAL_SHORTCUT === "1") {
      const nativeSourceUrl = `${sourceUrl}?fresh-native-shortcut=${Date.now()}`;
      await client.send("Target.createTarget", { url: nativeSourceUrl });
      const nativePage = await waitFor("fresh native-shortcut page", async () => (await targets(client)).find((target) => target.type === "page" && target.url === nativeSourceUrl));
      const nativeSession = await attach(client, nativePage.value.targetId);
      await client.send("Page.enable", {}, nativeSession);
      await client.send("Accessibility.enable", {}, nativeSession);
      const absentHost = await client.send("Runtime.evaluate", { expression: "document.querySelector('#peek-extension-host') === null", returnByValue: true }, nativeSession);
      assert(absentHost.result.value === true, "Fresh native-shortcut tab was already injected before physical invocation");
      const stateWithNativeTab = await browserState();
      const nativeChromeTab = stateWithNativeTab.windows.flatMap((window) => window.tabs.map((tab) => ({ ...tab, windowId: window.id }))).find((tab) => tab.url === nativeSourceUrl);
      assert(nativeChromeTab, "Fresh native-shortcut Chrome tab was not found");
      await evalWorker(`chrome.tabs.update(${nativeChromeTab.id},{active:true}).then(()=>chrome.windows.update(${nativeChromeTab.windowId},{focused:true}))`);
      await client.send("Target.activateTarget", { targetId: nativePage.value.targetId });
      await client.send("Page.bringToFront", {}, nativeSession);
      const nativeBefore = await browserState();
      const nativeFocusedWindow = nativeBefore.windows.find((window) => window.id === nativeBefore.lastFocusedWindowId);
      assert(nativeFocusedWindow?.id === nativeChromeTab.windowId && nativeFocusedWindow.tabs.some((tab) => tab.active && tab.id === nativeChromeTab.id && tab.url === nativeSourceUrl), "Refusing native input: the fresh disposable synthetic tab was not active in the focused Chrome window");

      if (process.env.PEEK_QA_NATIVE_SHORTCUT === "1") {
        nativeShortcutTarget = { ...sendTargetedNativeControlSpace(chrome), sourceWindowId: nativeChromeTab.windowId, sourceTabId: nativeChromeTab.id, sourceUrl: nativeSourceUrl, hostAbsentBefore: true, previouslyActionInvoked: false };
        await waitForOverlay(client, nativeSession, 10000);
        physicalKeyboardShortcutInvocation = "pass: PID-targeted native Control+Space opened and focused Peek on a fresh, never-action-invoked synthetic tab";
      } else {
        console.log("Manual gate: press physical Control+Space in the focused fresh disposable Chrome tab now.");
        await waitForOverlay(client, nativeSession, 30000);
        physicalKeyboardShortcutInvocation = "pass: physical Control+Space opened Peek on a fresh, never-action-invoked synthetic tab";
      }
      const nativeNodes = await axTree(client, nativeSession);
      assert(axRole(nativeNodes, "combobox")[0]?.properties?.some((property) => property.name === "focused" && property.value?.value === true), "Physical shortcut did not focus the Peek input on the fresh tab");
      await capture(client, nativeSession, "10-physical-shortcut-fresh-tab.png");
      await press(client, nativeSession, "Escape");
    }

    const buildSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const backgroundBytes = (await stat(resolve(dist, "background.js"))).size;
    const overlayBytes = (await stat(resolve(dist, "overlay.js"))).size;
    const report = {
      browser: version.Browser,
      product: "Google Chrome",
      profile,
      fixtureOrigin: `http://127.0.0.1:${fixturePort}`,
      build: { sha: buildSha, backgroundBytes, overlayBytes },
      extension: { id: extensionId, path: loaded.path, enabled: loaded.enabled },
      command: actionCommand,
      invocation: {
        method: "CDP Extensions.triggerAction",
        actionRequestToCdpResponseMs: Number((actionResponseAt - actionRequestedAt).toFixed(2)),
        overlayObservedSinceActionRequestMs: Number(overlayObservedSinceActionRequestMs.toFixed(2)),
        firstCharacter: query,
        firstCharacterTiming: {
          requestedSinceActionMs: Number(firstCharacterTiming.requestedSinceActionMs.toFixed(2)),
          completedSinceActionMs: Number(firstCharacterTiming.completedSinceActionMs.toFixed(2)),
        },
        revealSamples,
        samplingLimit: "Sequential Page.captureScreenshot calls are timestamped around each capture. They are not paint timestamps and are not labelled as nominal milliseconds or a true first-frame filmstrip.",
      },
      attention: attentionEvidence,
      centering: {
        before: {
          buildSha: "c9ad0ea152925c1855c3edf1ceceb7bfd4aae6fc",
          evidence: "/Users/kavii-suri/.bb/thread-storage/thr_ukj655b33t/peek11-chrome-initial.png",
          method: "largest connected dark component in the branded-Chrome screenshot (OpenCV grayscale threshold <75)",
          viewport: { width: 1000, height: 1638 },
          panel: { x: 16, y: 278, width: 968, height: 260 },
          panelCenterDelta: { x: 0, y: -411 },
        },
        after: { normal: normalGeometry, narrow480x720: narrowGeometry, short900x240: shortGeometry },
      },
      nativeShortcutTarget,
      checks: {
        unpackedLoad: "pass",
        coherentRevealSamples: "captured with actual sequential capture intervals and explicit sampling limits",
        firstCharacter: "pass; request/completion offsets recorded without claiming paint-time delivery",
        stableLoadingReadyErrorGeometry: "pass at normal, 480x720 narrow and 900x240 short viewports",
        previousDistinctTwoWindow: "pass: exact current/previous/selected IDs recorded and open-Enter returned to previous",
        currentNoOpPreservesPrevious: "pass: exact attention state unchanged",
        backgroundWindowActivationIgnoredUntilFocus: "pass: exact state unchanged until containing window focused",
        removedPreviousFallback: "pass: removed ID purged and a non-current MRU tab selected",
        coldWorkerSessionRestore: "pass: service worker target stopped, restarted, and previous exact ID selected",
        pendingCommitEscape: "pass with real Chrome key events while the extension worker was paused; focused input stayed operable and active-tab identities were preserved",
        titleUrlFilter: "pass",
        crossWindowExactCommitAndFocus: "pass",
        escapeNoActivation: "pass: focused window and all active-tab identities preserved",
        backdropNoActivation: "pass: focused window and all active-tab identities preserved",
        currentTargetNoOp: "pass: exact source window/tab/url remained active",
        staleTargetErrorNoSubstitution: "pass",
        closedPeekSiteShortcut: "pass",
        lightDarkNarrowShortScreenshots: "captured",
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
