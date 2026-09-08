import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Additional technical qualification, using the same disposable browser and
// exact shipped build as chrome-qa. No private/personal profile is attached.
export async function qualify(c) {
  const { client, chrome, chromePath, profile, output, extensionId, sourceSession, sourceTab,
    sourceChromeTab, sourceUrl, settingsTab, settingsSession, settingsTabTarget,
    evalWorker, browserState, focusSource, targets, attach, waitFor, delay, assert,
    press, capture, overlayInputState, overlayResultTabIds, waitForOverlay,
    waitForOverlayClosed, replaceOverlayQuery, measureOverlay, activeTabIdentity,
    createInterceptedFixturePage, searchFixtureFacts, fixtureOrigins, activateDisposableChrome,
    getWorkerSession, setWorkerSession, CdpClient } = c;
  const report = { samples: [], visuals: [], departures: [], limits: [] };
  const save = () => writeFile(resolve(output, 'final-qualification.json'), JSON.stringify(report, null, 2));
  const evaluate = async (session, expression) => {
    const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const selectedContrast = async session => {
    const tree = await client.send('DOM.getDocument', { depth: -1, pierce: true }, session);
    let row;
    const visit = node => {
      const attrs = Object.fromEntries(Array.from({ length: (node.attributes?.length ?? 0) / 2 }, (_, i) => [node.attributes[i * 2], node.attributes[i * 2 + 1]]));
      if (attrs['aria-selected'] === 'true') row = node;
      for (const child of [...node.children ?? [], ...node.shadowRoots ?? []]) visit(child);
    };
    visit(tree.root);
    if (!row) return undefined;
    const { object } = await client.send('DOM.resolveNode', { nodeId: row.nodeId }, session);
    const value = (await client.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: `function(){return {path:getComputedStyle(this.querySelector('.path')).color,background:getComputedStyle(this).backgroundColor,title:getComputedStyle(this.querySelector('.title')).color}}`, returnByValue: true }, session)).result.value;
    const luminance = color => color.match(/[\\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = luminance(value.path), b = luminance(value.background);
    return { ...value, pathContrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
  };
  const focusState = session => evaluate(session, '({focused:document.hasFocus(),visibility:document.visibilityState,at:Date.now()})');
  const sourceFocus = async kind => {
    if (kind === 'overlay') await focusSource();
    else await evalWorker(`chrome.tabs.update(${settingsTab.id},{active:true}).then(()=>chrome.windows.update(${settingsTab.windowId},{focused:true}))`);
    activateDisposableChrome(chrome);
    await client.send('Page.bringToFront', {}, kind === 'overlay' ? sourceSession : settingsSession);
    await waitFor('qualification source focus', async () => (await focusState(kind === 'overlay' ? sourceSession : settingsSession)).focused);
  };
  // Compile before measurements. The marker is immediately before native event
  // posting, excluding Swift startup/compilation and IPC setup from latency.
  const swift = resolve(output, 'post-key.swift');
  const binary = resolve(output, 'post-key');
  await writeFile(swift, `import CoreGraphics\nimport Foundation\nguard CGPreflightPostEventAccess() else { fatalError("No existing event permission") }\nlet pid = pid_t(Int32(CommandLine.arguments[1])!)\nlet source = CGEventSource(stateID: .hidSystemState)\nlet down = CGEvent(keyboardEventSource: source, virtualKey: 49, keyDown: true)!\ndown.flags = [.maskControl]\nprint(Date().timeIntervalSince1970 * 1000)\ndown.postToPid(pid)\nusleep(20000)\nlet up = CGEvent(keyboardEventSource: source, virtualKey: 49, keyDown: false)!\nup.flags = [.maskControl]\nup.postToPid(pid)\n`);
  execFileSync('/usr/bin/swiftc', [swift, '-o', binary]);
  const native = () => {
    const command = execFileSync('/bin/ps', ['-p', String(chrome.pid), '-o', 'command='], { encoding: 'utf8' }).trim();
    assert(command.startsWith(chromePath) && command.includes(`--user-data-dir=${profile}`), 'Native PID/profile mismatch');
    return Number(execFileSync(binary, [String(chrome.pid)], { encoding: 'utf8' }).trim());
  };
  const workerUrl = `chrome-extension://${extensionId}/`;
  const reattach = async () => {
    const worker = (await waitFor('qualification worker', async () => (await targets(client)).find(t => t.type === 'service_worker' && t.url.startsWith(workerUrl)))).value;
    setWorkerSession(await attach(client, worker.targetId));
  };
  const open = async (kind, nativeGesture = false) => {
    const before = new Set((await targets(client, 'page')).map(t => t.targetId));
    const requestedAt = nativeGesture ? native() : Date.now();
    if (!nativeGesture) await client.send('Extensions.triggerAction', { id: extensionId, targetId: kind === 'overlay' ? sourceTab.targetId : settingsTabTarget.targetId });
    let session = sourceSession;
    let page;
    if (kind === 'fallback') {
      page = (await waitFor('qualification fallback', async () => (await targets(client, 'page')).find(t => !before.has(t.targetId) && t.url.startsWith(`${workerUrl}fallback.html#`)))).value;
      session = await attach(client, page.targetId);
      await client.send('Page.enable', {}, session);
    }
    await waitForOverlay(client, session);
    return { session, page, requestedAt, inputObservedAt: Date.now() };
  };
  const close = async surface => {
    void press(client, surface.session, 'Escape').catch(() => undefined);
    if (surface.page) await waitFor('qualification popup closed', async () => !(await targets(client, 'page')).some(t => t.targetId === surface.page.targetId));
    else await waitForOverlayClosed(client, surface.session);
  };

  // Real ordinary departure, plus intentional destination identities.
  await sourceFocus('overlay');
  const departure = await open('overlay');
  const beforeDeparture = await browserState();
  await evalWorker(`chrome.windows.update(${settingsTab.windowId},{focused:true})`);
  await waitForOverlayClosed(client, sourceSession);
  const afterDeparture = await browserState();
  assert(afterDeparture.lastFocusedWindowId === settingsTab.windowId, 'Ordinary dismissal reversed external destination');
  assert(JSON.stringify(activeTabIdentity(beforeDeparture)) === JSON.stringify(activeTabIdentity(afterDeparture)), 'Ordinary departure activated a tab');
  report.departures.push({ before: beforeDeparture, after: afterDeparture, overlayClosed: true });
  await save();

  // Controlled remote metadata through the actual shared listener. Record ALL
  // image requests in the invoked document; don't claim ResourceTiming leakage.
  report.favicon = [];
  for (const kind of ['overlay', 'fallback']) {
    await sourceFocus(kind);
    const surface = await open(kind);
    const browserIconImages = (await waitFor('browser-produced PNG recognition', async () => {
      const tree = await client.send('DOM.getDocument', { depth: -1, pierce: true }, surface.session);
      const icons = [];
      const visit = node => {
        if (node.nodeName === 'IMG') {
          const attrs = Object.fromEntries(Array.from({ length: (node.attributes?.length ?? 0) / 2 }, (_, i) => [node.attributes[i * 2], node.attributes[i * 2 + 1]]));
          if (attrs.src?.startsWith('data:image/png;base64,')) icons.push({ prefix: attrs.src.slice(0, 40), length: attrs.src.length });
        }
        for (const child of [...node.children ?? [], ...node.shadowRoots ?? []]) visit(child);
      };
      visit(tree.root);
      return icons.length ? icons : undefined;
    })).value;
    await client.send('Network.enable', {}, surface.session);
    const requests = [];
    const off = client.on('Network.requestWillBeSent', (event, session) => {
      if (session === surface.session && event.type === 'Image') requests.push({ url: event.request.url, headers: event.request.headers, timestamp: event.timestamp });
    });
    const id = kind === 'fallback' ? decodeURIComponent(new URL(surface.page.url).hash.slice(1)) : await evalWorker(`new Promise(resolve=>{const listener=(message)=>{if(message.kind==='peek/cancel'){chrome.runtime.onMessage.removeListener(listener);resolve(message.sessionId)}}; chrome.runtime.onMessage.addListener(listener); chrome.tabs.sendMessage(${sourceChromeTab.id},{kind:'peek/init',sessionId:'privacy-probe',sourceTabId:${sourceChromeTab.id},sourceWindowId:${sourceChromeTab.windowId},model:{status:'loading',tabs:[]}}).then(()=>{chrome.runtime.onMessage.removeListener(listener);resolve('privacy-probe')})})`);
    const message = { kind: 'peek/model', sessionId: id, model: { status: 'ready', tabs: [{ id: 991, windowId: 992, title: 'Remote icon canary', url: 'https://metadata.test/path', favIconUrl: `http://localhost:1/forbidden-icon-${kind}.png`, lastAccessed: 1, current: false }] } };
    await evalWorker(kind === 'overlay' ? `chrome.tabs.sendMessage(${sourceChromeTab.id},${JSON.stringify(message)})` : `chrome.runtime.sendMessage(${JSON.stringify(message)})`);
    await delay(250);
    assert(requests.every(request => !request.url.includes('forbidden-icon')), 'Palette requested controlled remote favicon');
    report.favicon.push({ kind, browserIconImages, requests, observationMs: 250, controlledMetadata: message.model.tabs[0], resourceTimingLeakClaimed: false });
    off();
    await close(surface);
  }
  await save();

  // Two real disposable profile boundaries, with canary target existence
  // independently established through each owned debugging connection.
  const secondProfile = `${profile}-second`;
  await mkdir(secondProfile, { recursive: true });
  const secondUrl = `${sourceUrl}?SECOND_PROFILE_CANARY`;
  const secondChrome = spawn(chromePath, [`--user-data-dir=${secondProfile}`, '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', secondUrl], { stdio: 'ignore' });
  let secondClient;
  try {
    const debuggerPort = (await waitFor('second disposable debugger', async () => {
      try { return Number((await readFile(resolve(secondProfile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return undefined; }
    }, 15000)).value;
    const version = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    secondClient = new CdpClient(version.webSocketDebuggerUrl);
    await secondClient.connect();
    const secondCanary = (await waitFor('second-profile canary target', async () => (await targets(secondClient, 'page')).find(t => t.url === secondUrl))).value;
    const incognitoUrl = `${sourceUrl}?INCOGNITO_CANARY`;
    const incognito = await evalWorker(`chrome.windows.create({incognito:true,url:${JSON.stringify(incognitoUrl)},focused:false})`);
    const incognitoCanary = (await waitFor('real incognito canary target', async () => (await targets(client, 'page')).find(t => t.url === incognitoUrl))).value;
    const primaryContext = (await targets(client, 'page')).find(t => t.url === sourceUrl)?.browserContextId;
    assert(incognitoCanary.browserContextId && incognitoCanary.browserContextId !== primaryContext, 'Incognito canary does not have a separate browser context');
    await sourceFocus('overlay');
    const surface = await open('overlay');
    await waitFor('isolation model ready', async () => (await overlayResultTabIds(client, surface.session)).length > 0);
    await replaceOverlayQuery(client, surface.session, 'CANARY');
    assert((await overlayResultTabIds(client, surface.session)).length === 0, 'Out-of-profile canary entered model');
    report.isolation = { secondProfile, secondPid: secondChrome.pid, secondCanary, incognitoCanary, incognitoWindow: { requestedIncognito: true, apiResult: incognito, primaryContext, separateContext: incognitoCanary.browserContextId }, primaryQuery: 'CANARY', results: [], extensionIncognitoEnabled: false };
    await close(surface);
    await client.send('Target.closeTarget', { targetId: incognitoCanary.targetId });
  } finally {
    if (secondClient) { await secondClient.send('Browser.close').catch(() => undefined); secondClient.close(); }
    if (secondChrome.exitCode === null) secondChrome.kill('SIGTERM');
  }
  await save();

  // Keep the original three-window clipping controls above; workload sizes here
  // count the ambiguity fixture, with source/Settings controls listed separately.
  for (const count of [30, 100]) {
    const pages = [];
    for (let i = 0; i < count; i++) {
      const [, title, host, path] = searchFixtureFacts[i % searchFixtureFacts.length];
      const opaque = i % 30 >= 28;
      const url = opaque ? `https://docs.google.com/spreadsheets/d/1Opaque${'Ab7xZq'.repeat(18)}${i % 30 === 28 ? 'Alpha' : 'Beta'}/edit?copy=${Math.floor(i / 30)}#gid=0`
        : `${fixtureOrigins[host]}${path}${i >= 30 ? `?duplicate=${Math.floor(i / 30)}` : ''}`;
      pages.push(await createInterceptedFixturePage(client, url, opaque ? 'Untitled spreadsheet with a deliberately long title that cannot uniquely identify the source document' : title));
    }
    const tabFacts = await evalWorker('chrome.tabs.query({})');
    const fixtureTabs = pages.map(page => tabFacts.find(tab => tab.url === page.url));
    assert(fixtureTabs.every(Boolean), 'Workload tab enumeration incomplete');
    const auth = fixtureTabs[10];
    for (const kind of ['overlay', 'fallback']) {
      // Real timestamped Chrome screencast frames, not rAF or delayed screenshot
      // names. Ordinary recording begins before gesture. Fallback attachment is
      // necessarily after target creation; explicitly not its first paint.
      await sourceFocus(kind);
      let filmSession = sourceSession;
      const frames = [];
      let off;
      const startFilm = async session => {
        filmSession = session;
        off = client.on('Page.screencastFrame', (frame, eventSession) => {
          if (eventSession !== session) return;
          const index = frames.length;
          frames.push({ index, timestamp: frame.metadata.timestamp, receivedAt: Date.now(), metadata: frame.metadata });
          void writeFile(resolve(output, `film-${count}-${kind}-${index}.png`), Buffer.from(frame.data, 'base64'));
          void client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }, session).catch(() => undefined);
        });
        await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }, session);
      };
      if (kind === 'overlay') await startFilm(sourceSession);
      await client.send('Tracing.start', { categories: 'disabled-by-default-devtools.screenshot', transferMode: 'ReturnAsStream' });
      const visual = await open(kind);
      if (kind === 'fallback') await startFilm(visual.session);
      await waitFor('workload ready', async () => (await overlayResultTabIds(client, visual.session)).length >= count);
      for (const scheme of ['light', 'dark']) {
        await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, visual.session);
        for (const query of ['github', 'docs', 'orion retry', 'outage']) {
          await replaceOverlayQuery(client, visual.session, query);
          await capture(client, visual.session, `workload-${count}-${kind}-${scheme}-${query.replaceAll(' ', '-')}.png`);
          const contrast = await selectedContrast(visual.session);
          assert(!contrast || contrast.pathContrast >= 4.5, 'Selected path contrast below 4.5:1');
          report.visuals.push({ count, kind, scheme, query, contrast, geometry: await measureOverlay(client, visual.session) });
        }
      }
      await client.send('Page.stopScreencast', {}, filmSession);
      off?.();
      const tracingComplete = new Promise(resolveTrace => {
        const remove = client.on('Tracing.tracingComplete', event => { remove(); resolveTrace(event); });
      });
      await client.send('Tracing.end');
      const completedTrace = await tracingComplete;
      let traceText = '';
      while (true) {
        const chunk = await client.send('IO.read', { handle: completedTrace.stream });
        traceText += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data;
        if (chunk.eof) break;
      }
      await client.send('IO.close', { handle: completedTrace.stream });
      await writeFile(resolve(output, `trace-${count}-${kind}.json`), traceText);
      const snapshots = JSON.parse(traceText).traceEvents.filter(event => event.name === 'Screenshot' && event.args?.snapshot);
      for (const [i, event] of snapshots.entries()) await writeFile(resolve(output, `trace-frame-${count}-${kind}-${i}.jpg`), Buffer.from(event.args.snapshot, 'base64'));
      report.visuals.push({ count, kind, browserTrace: `trace-${count}-${kind}.json`, screenshotEvents: snapshots.map(({ ts, pid, tid }) => ({ ts, pid, tid })), limit: 'Browser tracing started before gesture; screenshot trace events use Chrome monotonic microseconds. Inspect captured content; screenshot sampling may omit frames.' });
      report.visuals.push({ count, kind, frames, limit: kind === 'overlay' ? 'Chrome screencast samples started before gesture; frames may be dropped/coalesced. Timestamp is Chrome metadata, not rAF.' : 'Chrome screencast attached after popup creation; does not establish its first paint.' });
      await close(visual);
      await save();
      for (const temperature of ['warm', 'natural-idle']) {
        for (let index = 0; index < (temperature === 'warm' ? 3 : 2); index++) {
          await sourceFocus(kind);
          const source = kind === 'overlay' ? sourceSession : settingsSession;
          const before = await browserState();
          const initialFocus = await focusState(source);
          let idle;
          if (temperature === 'natural-idle') {
            const detachedAt = Date.now();
            await client.send('Target.detachFromTarget', { sessionId: getWorkerSession() });
            const stopped = await waitFor('natural worker idle with debugging detached', async () => !(await targets(client)).some(t => t.type === 'service_worker' && t.url.startsWith(workerUrl)), 70000);
            idle = { detachedAt, absentAt: Date.now(), elapsedMs: stopped.elapsedMs, forcedStop: false };
          }
          const preGestureFocus = await focusState(source);
          if (!preGestureFocus.focused) {
            report.samples.push({ count, kind, temperature, index, initialFocus, preGestureFocus, idle, outcome: 'not measured: source lost focus before gesture; no focus-woken sample relabelled cold' });
            await save();
            // Explicitly wake only for subsequent setup, outside this sample.
            await client.send('Extensions.triggerAction', { id: extensionId, targetId: kind === 'overlay' ? sourceTab.targetId : settingsTabTarget.targetId });
            await reattach();
            const existingPopup = (await targets(client, 'page')).find(t => t.url.startsWith(`${workerUrl}fallback.html#`));
            if (existingPopup) await client.send('Target.closeTarget', { targetId: existingPopup.targetId });
            else await press(client, sourceSession, 'Escape');
            continue;
          }
          const opened = await open(kind, true);
          await reattachIfNeeded();
          const inputAt = Date.now();
          await client.send('Input.insertText', { text: 'g' }, opened.session);
          assert((await overlayInputState(client, opened.session)).value === 'g', 'First intended character lost');
          const characterAt = Date.now();
          await waitFor('full workload delivered', async () => (await overlayResultTabIds(client, opened.session)).length > 0);
          const queryAt = Date.now();
          await replaceOverlayQuery(client, opened.session, 'github auth 880');
          const ordered = await overlayResultTabIds(client, opened.session);
          // Duplicates share relevance; exact identity is the delivered first row.
          const selected = ordered[0];
          assert(fixtureTabs.filter((_, i) => i % 30 === 10).some(tab => tab.id === selected), 'PR880 not first in workload query');
          const orderedAt = Date.now();
          await evalWorker(`(() => { globalThis.qualificationChain=[]; if(globalThis.qualificationWrapped)return;globalThis.qualificationWrapped=true; for (const [name,obj] of [['tab',chrome.tabs],['window',chrome.windows]]) { const original=obj.update.bind(obj); obj.update=(...args)=>{const p=original(...args);void p.then(()=>qualificationChain.push({name,args,at:Date.now()}),error=>qualificationChain.push({name:'error',error:String(error)}));return p;}; } )()`);
          const commitAt = Date.now();
          void press(client, opened.session, 'Enter').catch(() => undefined);
          const chain = (await waitFor('first completed qualification activation/focus chain', async () => {
            const events = await evalWorker('qualificationChain');
            const a = events.findIndex(e => e.name === 'tab');
            const f = events.slice(a + 1).find(e => e.name === 'window');
            return a >= 0 && f ? { activation: events[a], focus: f } : undefined;
          })).value;
          assert(chain.activation.args[0] === selected, 'First completed chain activated wrong tab');
          const after = await browserState();
          const selectedTab = fixtureTabs.find(tab => tab.id === selected);
          assert(after.lastFocusedWindowId === selectedTab.windowId && after.windows.find(w => w.id === selectedTab.windowId)?.tabs.some(t => t.id === selected && t.active), 'Commit identities do not match');
          await sourceFocus(kind);
          const cancelling = await open(kind);
          const cancelBefore = await browserState();
          const cancelAt = Date.now();
          await close(cancelling);
          const cancelledAt = Date.now();
          const cancelAfter = await browserState();
          assert(JSON.stringify(activeTabIdentity(cancelBefore).filter(t => !cancelBefore.windows.find(w => w.id === t.windowId)?.type.includes('popup'))) === JSON.stringify(activeTabIdentity(cancelAfter)), 'Cancellation changed normal active tabs');
          assert(cancelAfter.lastFocusedWindowId === (kind === 'overlay' ? sourceChromeTab.windowId : settingsTab.windowId), 'Cancellation focus changed');
          report.samples.push({ count, enumeratedTabCount: before.windows.flatMap(w => w.tabs).length, kind, temperature, index, initialFocus, preGestureFocus, idle,
            dispatchAt: opened.requestedAt, inputObservedMs: opened.inputObservedAt - opened.requestedAt, firstCharacterRequestedMs: inputAt - opened.requestedAt, firstCharacterObservedMs: characterAt - opened.requestedAt,
            queryOrderMs: orderedAt - queryAt, commitFocusMs: chain.focus.at - commitAt, cancelClosedMs: cancelledAt - cancelAt, cancelReadiness: await focusState(source), selected, chain, outcome: 'pass' });
          await save();
          async function reattachIfNeeded() { if (temperature === 'natural-idle') await reattach(); }
        }
      }
    }
    await evalWorker(`chrome.tabs.remove(${JSON.stringify(fixtureTabs.map(t => t.id))})`);
  }
  report.limits.push('Native posting timestamp excludes compiled-helper startup. DOM/AX observation intervals include CDP polling/attachment; they are not paint latency or a universal SLA. Fallback first paint is not captured before target attachment. Cancel readiness records actual document focus, not physical IME or global OS shortcut conflicts.');
  await save();
  return report;
}
