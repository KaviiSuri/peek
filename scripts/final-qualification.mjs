import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertCommitChain, cancellationReadiness } from './qualification-assertions.mjs';
import { assertDrySchedule, earlyCharacterAttempt } from './early-character.mjs';

// Additional technical qualification, using the same disposable browser and
// exact shipped build as chrome-qa. No private/personal profile is attached.
export async function qualify(c) {
  const { client, chrome, chromePath, profile, output, extensionId, sourceSession, sourceTab,
    sourceChromeTab, sourceUrl, settingsTab, settingsSession, settingsTabTarget,
    evalWorker, browserState, focusSource, targets, attach, waitFor, delay, assert,
    press, capture, overlayInputState, overlayResultTabIds, waitForOverlay,
    waitForOverlayClosed, measureOverlay, activeTabIdentity,
    createInterceptedFixturePage, searchFixtureFacts, fixtureOrigins, activateDisposableChrome,
    getWorkerSession, setWorkerSession, CdpClient } = c;
  const report = { samples: [], earlyCharacters: [], earlyRecoveries: [], visuals: [], departures: [], earlyColdCharacterQualification: 'pending native execution/review; fixed-delay attempts are separate from readiness-gated samples', limits: [] };
  const save = () => writeFile(resolve(output, 'final-qualification.json'), JSON.stringify(report, null, 2));
  await client.send('Runtime.evaluate', { expression: `globalThis.qaFocusEvents=[];for(const type of ['focus','blur','visibilitychange','pagehide'])window.addEventListener(type,()=>qaFocusEvents.push({type,at:Date.now(),focused:document.hasFocus(),visibility:document.visibilityState}),true)`, returnByValue: true }, sourceSession);
  await evalWorker(`globalThis.qaBrowserEvents=[];chrome.windows.onFocusChanged.addListener(id=>qaBrowserEvents.push({kind:'focus',id,at:Date.now()}));chrome.tabs.onActivated.addListener(info=>qaBrowserEvents.push({kind:'activation',info,at:Date.now()}))`);
  const evaluate = async (session, expression) => {
    const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const replaceOverlayQuery = async (_client, session, query) => {
    const tree = await client.send('DOM.getDocument', { depth: -1, pierce: true }, session);
    let input;
    const visit = node => {
      const attrs = Object.fromEntries(Array.from({ length: (node.attributes?.length ?? 0) / 2 }, (_, i) => [node.attributes[i * 2], node.attributes[i * 2 + 1]]));
      if (node.nodeName === 'INPUT' && attrs['aria-label'] === 'Find a tab by title or URL') input = node;
      for (const child of [...node.children ?? [], ...node.shadowRoots ?? []]) visit(child);
    };
    visit(tree.root);
    assert(input, 'Query input absent');
    const { object } = await client.send('DOM.resolveNode', { nodeId: input.nodeId }, session);
    await client.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: `function(){this.setSelectionRange(0,this.value.length)}` }, session);
    if (query) await client.send('Input.insertText', { text: query }, session);
    else await client.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: `function(){this.value='';this.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}))}` }, session);
    assert((await overlayInputState(client, session)).value === query, 'Query not retained');
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
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = luminance(value.path), b = luminance(value.background);
    return { ...value, pathContrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
  };
  const focusState = session => evaluate(session, '({focused:document.hasFocus(),visibility:document.visibilityState,at:Date.now()})');
  const sourceFocus = async kind => {
    if (kind === 'overlay') await focusSource();
    else await evalWorker(`chrome.tabs.update(${settingsTab.id},{active:true}).then(()=>chrome.windows.update(${settingsTab.windowId},{focused:true}))`);
    activateDisposableChrome(chrome);
    await client.send('Page.bringToFront', {}, kind === 'overlay' ? sourceSession : settingsSession);
    await delay(250);
    await waitFor('qualification source focus', async () => (await focusState(kind === 'overlay' ? sourceSession : settingsSession)).focused);
  };
  // Compile before measurements. The marker is immediately before native event
  // posting, excluding Swift startup/compilation and IPC setup from latency.
  const swift = resolve(output, 'post-key.swift');
  const binary = resolve(output, 'post-key');
  await writeFile(swift, `import CoreGraphics\nimport Foundation\nguard CGPreflightPostEventAccess() else { fatalError("No existing event permission") }\nlet pid = pid_t(Int32(CommandLine.arguments[1])!)\nlet source = CGEventSource(stateID: .hidSystemState)\nlet down = CGEvent(keyboardEventSource: source, virtualKey: 49, keyDown: true)!\ndown.flags = [.maskControl]\nprint(Date().timeIntervalSince1970 * 1000)\ndown.postToPid(pid)\nusleep(20000)\nlet up = CGEvent(keyboardEventSource: source, virtualKey: 49, keyDown: false)!\nup.flags = []\nup.postToPid(pid)\n`);
  execFileSync('/usr/bin/swiftc', [swift, '-o', binary]);
  const earlyBinary = resolve(output, 'native-early-character');
  execFileSync('/usr/bin/swiftc', [resolve('scripts/native-early-character.swift'), '-o', earlyBinary]);
  const drySchedule = JSON.parse(execFileSync(earlyBinary, ['--dry-run'], { encoding: 'utf8' }));
  assertDrySchedule(drySchedule);
  await writeFile(resolve(output, 'early-character-dry-run.json'), JSON.stringify(drySchedule, null, 2));
  const earlyNative = mode => JSON.parse(execFileSync(earlyBinary, [mode, String(chrome.pid), chromePath, profile], { encoding: 'utf8' }));
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

  const paletteSnapshot = async session => {
    try { return { present: true, ...await overlayInputState(client, session) }; }
    catch (error) {
      if (String(error).includes('Could not resolve overlay input and palette')) return { present: false };
      throw error;
    }
  };
  const earlyTrial = async ({ count, kind, temperature, index }) => {
    // Explicit setup precedes the measured attempt, never follows a missed key
    // to relabel it. Worker debugging is detached before natural suspension.
    await sourceFocus(kind);
    const source = kind === 'overlay' ? sourceSession : settingsSession;
    const sourceState = () => evaluate(source, '({focused:document.hasFocus(),visibility:document.visibilityState,at:Date.now(),activeTag:document.activeElement?.tagName,activeValue:document.activeElement?.value??null})');
    const before = await browserState();
    let idle;
    if (temperature === 'natural-idle') {
      const detachedAt = Date.now();
      await client.send('Target.detachFromTarget', { sessionId: getWorkerSession() });
      try {
        await waitFor('natural idle before fixed-delay character attempt', async () => !(await targets(client)).some(t => t.type === 'service_worker' && t.url.startsWith(workerUrl)), 70000);
      } catch (error) {
        report.earlyCharacters.push({ count, kind, temperature, index, outcome: 'not-attempted', reason: 'natural idle not established', detachedAt, observedAt: Date.now(), error: String(error), forcedStop: false });
        await save(); throw error;
      }
      idle = { detachedAt, absentAt: Date.now(), forcedStop: false };
    }
    const sourceBefore = await sourceState();
    const initialTargets = await targets(client);
    const beforePages = new Set(initialTargets.filter(t => t.type === 'page').map(t => t.targetId));
    const sourcePalette = await paletteSnapshot(source);
    const workerPresent = initialTargets.some(t => t.type === 'service_worker' && t.url.startsWith(workerUrl));
    const preconditions = { sourceFocused: sourceBefore.focused, sourceVisible: sourceBefore.visibility === 'visible',
      paletteAbsent: !sourcePalette.present && !initialTargets.some(t => t.url.startsWith(`${workerUrl}fallback.html#`)),
      temperatureVerified: temperature === 'natural-idle' ? !workerPresent : workerPresent,
      sourceBefore, sourcePalette, before, idle, workerPresent };
    let surface;
    const measured = await earlyCharacterAttempt({ preconditions,
      // One native process dispatches BOTH keys. No open()/AX wait or worker
      // reattachment can intervene between shortcut and character posting.
      post: () => earlyNative('--post'),
      observe: async () => {
        const observationStartedAt = Date.now(), deadline = observationStartedAt + 2000;
        let palette = { present: false };
        do {
          if (kind === 'overlay') surface = { session: source };
          else if (!surface) {
            const page = (await targets(client, 'page')).find(t => !beforePages.has(t.targetId) && t.url.startsWith(`${workerUrl}fallback.html#`));
            if (page) surface = { page, session: await attach(client, page.targetId) };
          }
          if (surface) palette = await paletteSnapshot(surface.session);
          if (palette.present && palette.value === 'g') break;
          await delay(50);
        } while (Date.now() < deadline);
        return { available: true, palette, sourceAfter: await sourceState(), observationStartedAt, observedAt: Date.now(),
          observationBudgetMs: 2000, noWorkerReattachment: true,
          limit: 'Readback after native posting; CDP calls may exceed the nominal observation budget. Not paint timing.' };
      },
    });
    report.earlyCharacters.push({ count, kind, temperature, index, ...measured });
    await save(); // Preserve misses/aborts BEFORE cleanup, reattachment or setup.
    const recovery = { count, kind, temperature, index, phase: 'separate post-measurement recovery', startedAt: Date.now() };
    report.earlyRecoveries.push(recovery);
    try {
      assert(['hit', 'miss'].includes(measured.outcome), 'Early attempt unmeasured/aborted; stop rather than manufacture a successful trial');
      recovery.foregroundCheck = earlyNative('--check');
      assert(recovery.foregroundCheck.foregroundBeforeShortcut, 'External foreground owner: recovery stopped without activation');
      if (temperature === 'natural-idle') await reattach();
      const popup = (await targets(client, 'page')).find(t => t.url.startsWith(`${workerUrl}fallback.html#`));
      if (popup) await client.send('Target.closeTarget', { targetId: popup.targetId });
      else if ((await paletteSnapshot(source)).present) await close({ session: source });
      recovery.outcome = 'cleanup complete; next readiness-gated trial has independent setup';
    } catch (error) { recovery.outcome = 'stopped'; recovery.error = String(error); throw error; }
    finally { recovery.finishedAt = Date.now(); await save(); }
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
    }).catch(async error => {
      const diagnostic = await evalWorker(`(async()=>{const tab=await chrome.tabs.get(${sourceChromeTab.id});const u=new URL(chrome.runtime.getURL('_favicon/'));u.searchParams.set('pageUrl',tab.url);u.searchParams.set('size','32');try{const r=await fetch(u);const b=new Uint8Array(await r.arrayBuffer());return {tab,endpoint:u.href,status:r.status,type:r.headers.get('content-type'),length:b.length,firstBytes:Array.from(b.slice(0,12)),permissions:await chrome.permissions.getAll()}}catch(error){return {tab,endpoint:u.href,error:String(error)}}})()`);
      await writeFile(resolve(output, `favicon-diagnostic-${kind}.json`), JSON.stringify(diagnostic, null, 2));
      throw error;
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

  report.failureRecovery = [];
  for (const kind of ['overlay', 'fallback']) {
    await sourceFocus(kind);
    await evalWorker(`globalThis.qaGetAll=chrome.windows.getAll.bind(chrome.windows);chrome.windows.getAll=async()=>{throw new Error('controlled enumeration failure')}`);
    const failed = await open(kind);
    await waitFor('deliberate model error', async () => (await client.send('Accessibility.getFullAXTree', {}, failed.session)).nodes.some(node => node.name?.value?.includes('Peek could not read open tabs')));
    const errorGeometry = await measureOverlay(client, failed.session);
    await capture(client, failed.session, `error-${kind}.png`);
    await evalWorker('chrome.windows.getAll=qaGetAll;delete globalThis.qaGetAll');
    await close(failed);
    await sourceFocus(kind);
    const recovered = await open(kind);
    await waitFor('recovered model', async () => (await overlayResultTabIds(client, recovered.session)).length > 0);
    await close(recovered);
    await sourceFocus(kind);
    const beforePending = await browserState();
    await evalWorker(`globalThis.qaGetAll=chrome.windows.getAll.bind(chrome.windows);globalThis.qaModelPending=false;chrome.windows.getAll=async(...args)=>{const result=await qaGetAll(...args);qaModelPending=true;await new Promise(resolve=>globalThis.qaReleaseModel=resolve);return result}`);
    const pending = await open(kind);
    await waitFor('pending real model boundary', () => evalWorker('qaModelPending'));
    const loadingGeometry = await measureOverlay(client, pending.session);
    await close(pending);
    await evalWorker('chrome.windows.getAll=qaGetAll;qaReleaseModel();delete globalThis.qaGetAll;delete globalThis.qaReleaseModel');
    await delay(150);
    const afterPending = await browserState();
    assert(JSON.stringify(activeTabIdentity(beforePending)) === JSON.stringify(activeTabIdentity(afterPending)), 'Pending model cancellation activated a tab');
    assert(afterPending.lastFocusedWindowId === beforePending.lastFocusedWindowId, 'Pending model cancellation moved focus');
    assert(!afterPending.windows.some(w => w.type === 'popup'), 'Late fallback model resurrected a popup');
    assert(await evaluate(sourceSession, "!document.querySelector('#peek-extension-host')"), 'Late ordinary model resurrected a host');
    report.failureRecovery.push({ kind, errorGeometry, loadingGeometry, modelErrorRecovered: true, pendingCancellation: { before: beforePending, after: afterPending, lateObservationMs: 150 } });
    await save();
  }

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

  const pdfUrl = new URL('/source.pdf', sourceUrl).href;
  const pdfPage = await client.send('Target.createTarget', { url: pdfUrl });
  const pdfSession = await attach(client, pdfPage.targetId);
  await client.send('Page.enable', {}, pdfSession);
  const pdfTab = (await waitFor('synthetic PDF tab', async () => (await evalWorker('chrome.tabs.query({})')).find(tab => tab.url === pdfUrl))).value;
  await evalWorker(`chrome.tabs.update(${pdfTab.id},{active:true}).then(()=>chrome.windows.update(${pdfTab.windowId},{focused:true}))`);
  activateDisposableChrome(chrome);
  await client.send('Page.bringToFront', {}, pdfSession);
  const contentType = await evaluate(pdfSession, 'document.contentType');
  assert(contentType === 'application/pdf', 'PDF fixture was not handled as PDF');
  const pdfBefore = await browserState();
  const pdfPostedAt = native();
  const pdfSurface = (await waitFor('usable PDF presentation', async () => {
    if (await evaluate(pdfSession, "!!document.querySelector('#peek-extension-host')")) return { session: pdfSession, kind: 'overlay' };
    const popup = (await targets(client, 'page')).find(t => t.url.startsWith(`${workerUrl}fallback.html#`));
    return popup ? { session: await attach(client, popup.targetId), page: popup, kind: 'fallback' } : undefined;
  }).catch(async error => {
    report.pdf = { url: pdfUrl, contentType, postedAt: pdfPostedAt, state: await browserState(), actionTitle: await evalWorker(`chrome.action.getTitle({tabId:${pdfTab.id}})`), probe: await evalWorker(`chrome.scripting.executeScript({target:{tabId:${pdfTab.id}},func:()=>document.contentType}).then(value=>({value}),error=>({error:String(error)}))`) };
    await save();
    throw error;
  })).value;
  await waitForOverlay(client, pdfSurface.session);
  await client.send('Input.insertText', { text: 'peek' }, pdfSurface.session);
  assert((await overlayInputState(client, pdfSurface.session)).value === 'peek', 'PDF presentation did not accept query');
  await capture(client, pdfSurface.session, 'pdf-presentation.png');
  await close(pdfSurface);
  const pdfAfter = await browserState();
  assert(JSON.stringify(activeTabIdentity(pdfBefore)) === JSON.stringify(activeTabIdentity(pdfAfter)) && pdfBefore.lastFocusedWindowId === pdfAfter.lastFocusedWindowId, 'PDF Escape changed identity/focus');
  report.pdf = { url: pdfUrl, contentType, presentation: pdfSurface.kind, postedAt: pdfPostedAt, typedQuery: 'peek', before: pdfBefore, after: pdfAfter };
  await client.send('Target.closeTarget', { targetId: pdfPage.targetId });
  await save();

  report.openPaletteIdle = [];
  for (const kind of ['overlay', 'fallback']) {
    await sourceFocus(kind);
    const surface = await open(kind);
    await waitFor('active palette model', async () => (await overlayResultTabIds(client, surface.session)).length > 0);
    const before = await browserState();
    const detachedAt = Date.now();
    await client.send('Target.detachFromTarget', { sessionId: getWorkerSession() });
    await waitFor('natural idle while palette remains open', async () => !(await targets(client)).some(t => t.type === 'service_worker' && t.url.startsWith(workerUrl)), 70000);
    const idleAt = Date.now();
    const focusedBeforeEnter = await focusState(surface.session);
    assert(focusedBeforeEnter.focused, 'Open-palette idle lost focus; no manufactured cold Enter');
    await press(client, surface.session, 'Enter');
    await reattach();
    await waitFor('safe expired-session error after active UI idle', async () => (await client.send('Accessibility.getFullAXTree', {}, surface.session)).nodes.some(node => node.name?.value?.includes('Peek session expired')));
    const after = await browserState();
    assert(JSON.stringify(activeTabIdentity(before)) === JSON.stringify(activeTabIdentity(after)) && before.lastFocusedWindowId === after.lastFocusedWindowId, 'Expired-session Enter changed tab/window identity');
    await capture(client, surface.session, `open-idle-${kind}.png`);
    await close(surface);
    await sourceFocus(kind);
    const recovered = await open(kind);
    await waitFor('reinvoke after expired active UI', async () => (await overlayResultTabIds(client, recovered.session)).length > 0);
    await close(recovered);
    report.openPaletteIdle.push({ kind, detachedAt, idleAt, forcedStop: false, focusedBeforeEnter, before, after, result: 'safe expiration without activation; Escape and fresh invocation recover', limit: 'An open palette session is in worker memory; Enter after natural suspension requires close/reinvoke. No stale selection is activated.' });
    await save();
  }

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
      // Browser trace screenshot events start before invocation. Do not combine
      // Page screencast and synchronous screenshots in the same focus trial.
      await sourceFocus(kind);
      await client.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.screenshot', transferMode: 'ReturnAsStream' }, sourceSession);
      const visual = await open(kind);
      await waitFor('workload ready', async () => (await overlayResultTabIds(client, visual.session)).length >= count);
      await finishTrace();
      for (const scheme of ['light', 'dark']) {
        await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, visual.session);
        for (const query of ['github', 'docs', 'orion retry', 'outage']) {
          await replaceOverlayQuery(client, visual.session, query);
          await capture(client, visual.session, `workload-${count}-${kind}-${scheme}-${query.replaceAll(' ', '-')}.png`);
          const contrast = await selectedContrast(visual.session);
          assert(!contrast || contrast.pathContrast >= 4.5, 'Selected path contrast below 4.5:1');
          report.visuals.push({ count, kind, scheme, query, contrast, geometry: await measureOverlay(client, visual.session).catch(async error => {
            report.visualFailure = { count, kind, scheme, query, at: Date.now(), frontmost: execFileSync('/usr/bin/swift', ['-e', 'import AppKit; let a=NSWorkspace.shared.frontmostApplication; print(a?.processIdentifier ?? 0); print(a?.localizedName ?? "unknown")'], { encoding: 'utf8' }), chromePid: chrome.pid, focusEvents: await evaluate(sourceSession, 'qaFocusEvents'), browserEvents: await evalWorker('qaBrowserEvents'), state: await browserState() };
            await save();
            throw error;
          }) });
        }
      }
      async function finishTrace() {
      const tracingComplete = new Promise(resolveTrace => {
        const remove = client.on('Tracing.tracingComplete', event => { remove(); resolveTrace(event); });
      });
      await client.send('Tracing.end', {}, sourceSession);
      const completedTrace = await tracingComplete;
      let traceText = '';
      while (true) {
        const chunk = await client.send('IO.read', { handle: completedTrace.stream }, sourceSession);
        traceText += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data;
        if (chunk.eof) break;
      }
      await client.send('IO.close', { handle: completedTrace.stream }, sourceSession);
      await writeFile(resolve(output, `trace-${count}-${kind}.json`), traceText);
      const snapshots = JSON.parse(traceText).traceEvents.filter(event => event.name === 'Screenshot' && event.args?.snapshot);
      for (const [i, event] of snapshots.entries()) await writeFile(resolve(output, `trace-frame-${count}-${kind}-${i}.jpg`), Buffer.from(event.args.snapshot, 'base64'));
      report.visuals.push({ count, kind, browserTrace: `trace-${count}-${kind}.json`, screenshotEvents: snapshots.map(({ ts, pid, tid }) => ({ ts, pid, tid })), limit: kind === 'fallback' ? 'Source-page trace began before gesture; it does not prove the new fallback window first paint. Inspect content and obtain separate popup reveal evidence.' : 'Source-page tracing started before gesture; screenshot events use Chrome monotonic microseconds. Inspect content; sampling may omit frames.' });
      }
      await close(visual);
      await save();
      for (const temperature of ['warm', 'natural-idle']) {
        for (let index = 0; index < (temperature === 'warm' ? 3 : 2); index++) {
          await earlyTrial({ count, kind, temperature, index });
          // Separate readiness-gated trial/setup, never recovery inside the
          // fixed-delay attempt or a replacement for its retained miss.
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
          assert((await overlayInputState(client, opened.session)).value === 'g', 'Readiness-gated character lost');
          const characterAt = Date.now();
          await waitFor('full workload delivered', async () => (await overlayResultTabIds(client, opened.session)).length > 0);
          const queryAt = Date.now();
          await replaceOverlayQuery(client, opened.session, 'github auth 880');
          const ordered = await overlayResultTabIds(client, opened.session);
          // Duplicates share relevance; exact identity is the delivered first row.
          const selected = ordered[0];
          assert(fixtureTabs.filter((_, i) => i % 30 === 10).some(tab => tab.id === selected), 'PR880 not first in workload query');
          const orderedAt = Date.now();
          await evalWorker(`(() => { globalThis.qualificationChain=[]; if(globalThis.qualificationWrapped)return;globalThis.qualificationWrapped=true; for (const [name,obj] of [['tab',chrome.tabs],['window',chrome.windows]]) { const original=obj.update.bind(obj); obj.update=(...args)=>{const p=original(...args);void p.then(()=>qualificationChain.push({name,args,at:Date.now()}),error=>qualificationChain.push({name:'error',error:String(error)}));return p;}; } })()`);
          const commitAt = Date.now();
          void press(client, opened.session, 'Enter').catch(() => undefined);
          const chain = (await waitFor('first completed qualification activation/focus chain', async () => {
            const events = await evalWorker('qualificationChain');
            const a = events.findIndex(e => e.name === 'tab');
            const f = events.slice(a + 1).find(e => e.name === 'window');
            return a >= 0 && f ? { activation: events[a], focus: f } : undefined;
          })).value;
          const selectedTab = fixtureTabs.find(tab => tab.id === selected);
          assertCommitChain(chain, selectedTab);
          const after = await browserState();
          assert(after.lastFocusedWindowId === selectedTab.windowId && after.windows.find(w => w.id === selectedTab.windowId)?.tabs.some(t => t.id === selected && t.active), 'Commit identities do not match');
          await sourceFocus(kind);
          let cancelIdle;
          if (temperature === 'natural-idle') {
            const detachedAt = Date.now();
            await client.send('Target.detachFromTarget', { sessionId: getWorkerSession() });
            await waitFor('natural idle before cancellation sample', async () => !(await targets(client)).some(t => t.type === 'service_worker' && t.url.startsWith(workerUrl)), 70000);
            cancelIdle = { detachedAt, absentAt: Date.now(), preGestureFocus: await focusState(source), forcedStop: false };
            assert(cancelIdle.preGestureFocus.focused, 'Cold cancel source lost focus; do not relabel a focus-woken sample');
          }
          const cancelling = await open(kind, temperature === 'natural-idle');
          if (temperature === 'natural-idle') await reattach();
          const cancelBefore = await browserState();
          const cancelAt = Date.now();
          await close(cancelling);
          const cancelledAt = Date.now();
          const cancelAfter = await browserState();
          assert(JSON.stringify(activeTabIdentity(cancelBefore).filter(t => !cancelBefore.windows.find(w => w.id === t.windowId)?.type.includes('popup'))) === JSON.stringify(activeTabIdentity(cancelAfter)), 'Cancellation changed normal active tabs');
          const cancelReadiness = await focusState(source);
          const readiness = cancellationReadiness(kind === 'overlay' ? sourceChromeTab.windowId : settingsTab.windowId, cancelAfter, cancelReadiness, cancelAt);
          report.samples.push({ count, enumeratedTabCount: before.windows.flatMap(w => w.tabs).length, kind, temperature, index, initialFocus, preGestureFocus, idle,
            dispatchAt: opened.requestedAt, inputObservedMs: opened.inputObservedAt - opened.requestedAt,
            characterProbe: 'readiness-gated: after palette AX readiness and worker attachment; early input not measured',
            readinessGatedCharacterRequestedMs: inputAt - opened.requestedAt, readinessGatedCharacterObservedMs: characterAt - opened.requestedAt,
            queryOrderMs: orderedAt - queryAt, commitFocusMs: chain.focus.at - commitAt, cancelClosedMs: cancelledAt - cancelAt, cancelIdle, cancelTemperature: temperature, cancelBefore, cancelAfter, cancelReadiness, selected, chain, ...readiness });
          await save();
          async function reattachIfNeeded() { if (temperature === 'natural-idle') await reattach(); }
        }
      }
    }
    await evalWorker(`chrome.tabs.remove(${JSON.stringify(fixtureTabs.map(t => t.id))})`);
  }
  report.limits.push('Warm/cold workload character samples wait for AX readiness and worker attachment before typing. They do not establish early cold-character preservation. Separate earlyCharacters entries use a native fixed-delay schedule without AX/worker readiness gating and retain actual offsets and misses. The original fixed-50ms core probe is also retained; neither establishes a universal SLA.');
  report.limits.push('Native posting timestamp excludes compiled-helper startup. DOM/AX observation intervals include CDP polling/attachment; they are not paint latency or a universal SLA. Fallback first paint is not captured before target attachment. Cancel teardown duration is separate from the first collected source-ready observation. Unfocused, hidden or externally departed samples are incomplete, never readiness passes; no restoration is performed inside the measurement. Readiness is not physical IME or global OS shortcut evidence.');
  await save();
  return report;
}
