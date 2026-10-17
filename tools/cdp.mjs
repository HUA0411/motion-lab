#!/usr/bin/env node
/**
 * MOTION LAB · CDP 测试器 (tools/cdp.mjs)
 *
 * 用法：
 *   node tools/cdp.mjs <url> [--w 1440] [--h 900] [--wait 1500] [--full]
 *                       [--shot out.png] [--eval "expr"] [--click "selector"]
 *                       [--key "Tab"] [--reduced] [--offline]
 *                       [--json]
 *
 * 输出（stdout，便于脚本解析）：
 *   JSON 一行：{ url, title, viewport, consoleErrors, consoleWarnings, pageErrors,
 *                evalResults, overflowX, screenshot, metrics }
 *
 * 设计目标：无需 playwright，直接驱动 agent-browser 自带的 Chromium。
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CHROME_CANDIDATES = [
  process.env.ML_CHROME,
  `${process.env.USERPROFILE}\\.agent-browser\\browsers\\chrome-155.0.8059.39\\chrome.exe`,
  `${process.env.USERPROFILE}\\.agent-browser\\browsers\\chrome-152.0.7977.64\\chrome.exe`,
  `${process.env.USERPROFILE}\\.agent-browser\\browsers\\chrome-152.0.7977.42\\chrome.exe`,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (p && existsSync(p)) return p;
  }
  throw new Error('找不到 Chromium/Chrome，请设置 ML_CHROME 环境变量指向可执行文件。');
}

function parseArgs(argv) {
  const out = { url: null, w: 1440, h: 900, wait: 1600, full: false, evals: [], clicks: [], keys: [], reduced: false, offline: false, json: true, shot: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--w') out.w = parseInt(argv[++i], 10);
    else if (a === '--h') out.h = parseInt(argv[++i], 10);
    else if (a === '--wait') out.wait = parseInt(argv[++i], 10);
    else if (a === '--full') out.full = true;
    else if (a === '--shot') out.shot = argv[++i];
    else if (a === '--eval') out.evals.push(argv[++i]);
    else if (a === '--click') out.clicks.push(argv[++i]);
    else if (a === '--key') out.keys.push(argv[++i]);
    else if (a === '--reduced') out.reduced = true;
    else if (a === '--offline') out.offline = true;
    else if (a === '--no-json') out.json = false;
    else if (!out.url && !a.startsWith('--')) out.url = a;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.url) {
  console.error('用法：node tools/cdp.mjs <url> [--w 1440] [--h 900] [--wait 1500] [--full] [--shot out.png] [--eval "expr"] [--click "sel"] [--key "Tab"] [--reduced]');
  process.exit(2);
}

const chromePath = findChrome();
const port = 9222 + Math.floor(Math.random() * 500);
const profile = resolve(process.env.TEMP || '.', 'ml-cdp-' + Date.now());

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion',
    '--disable-new-content-rendering-timeout',
    '--run-all-compositor-stages-before-draw',
    '--disable-frame-rate-limit',
    '--deterministic-mode',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--window-size=' + args.w + ',' + args.h,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  const res = await fetch('http://127.0.0.1:' + port + path);
  return res.json();
}

async function waitForTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await fetchJson('/json/list');
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* 尚未就绪 */
    }
    await sleep(150);
  }
  throw new Error('等待 Chrome 调试端口超时');
}

let id = 0;
const pending = new Map();
const events = [];

function send(ws, method, params) {
  const messageId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
    ws.send(JSON.stringify({ id: messageId, method, params: params || {} }));
    setTimeout(() => {
      if (pending.has(messageId)) {
        pending.delete(messageId);
        reject(new Error('CDP 超时: ' + method));
      }
    }, 30000);
  });
}

function cleanup(code) {
  try {
    chrome.kill('SIGKILL');
  } catch {}
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
  process.exit(code || 0);
}

(async () => {
  const target = await waitForTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject: rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.method + ': ' + msg.error.message));
      else res(msg.result);
      return;
    }
    if (msg.method) events.push(msg);
  });

  const consoleMessages = [];
  const pageErrors = [];

  await send(ws, 'Runtime.enable');
  await send(ws, 'Page.enable');
  await send(ws, 'Log.enable');
  await send(ws, 'Network.enable');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type))
        .join(' ');
      consoleMessages.push({ type: msg.params.type, text });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageErrors.push(d.exception?.description || d.text || 'unknown exception');
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      if (e.level === 'error') consoleMessages.push({ type: 'log-error', text: e.text + ' ' + (e.url || '') });
      if (e.level === 'warning') consoleMessages.push({ type: 'log-warning', text: e.text });
    }
  });

  await send(ws, 'Emulation.setDeviceMetricsOverride', {
    width: args.w,
    height: args.h,
    deviceScaleFactor: 1,
    mobile: args.w < 768,
  });

  if (args.reduced) {
    await send(ws, 'Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  }

  await send(ws, 'Page.navigate', { url: args.url });
  await new Promise((res) => {
    const onLoad = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.method === 'Page.loadEventFired') {
        ws.off('message', onLoad);
        res();
      }
    };
    ws.on('message', onLoad);
    setTimeout(res, 15000);
  });
  await sleep(args.wait);

  /* 无头 Chrome 在页面被判定为不可见时 rAF 只会触发 1 次（实测 rafCount=1/1000ms）。
     用虚拟时间预算推进帧，让 rAF 驱动的动画真正跑完，否则所有动画都停在首帧。 */
  try {
    await send(ws, 'Emulation.setVirtualTimePolicy', {
      policy: 'advance',
      budget: 4000,
      maxVirtualTimeTaskStarvationCount: 10000,
    });
    await new Promise((res) => {
      const onBudget = (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.method === 'Emulation.virtualTimeBudgetExpired') {
          ws.off('message', onBudget);
          res();
        }
      };
      ws.on('message', onBudget);
      setTimeout(res, 6000);
    });
  } catch {
    /* 不支持虚拟时间时退化为真实等待 */
  }
  await sleep(120);

  if (args.offline) {
    await send(ws, 'Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await sleep(400);
  }

  const evalResults = [];
  async function evaluate(expression) {
    const result = await send(ws, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      return { error: result.exceptionDetails.exception?.description || result.exceptionDetails.text };
    }
    return result.result.value;
  }

  for (const sel of args.clicks) {
    const box = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if(!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x: r.left + r.width/2, y: r.top + r.height/2}; })()`);
    if (!box || box.error) {
      evalResults.push({ click: sel, error: box?.error || 'not found' });
      continue;
    }
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send(ws, 'Input.dispatchMouseEvent', {
        type,
        x: Math.round(box.x),
        y: Math.round(box.y),
        button: 'left',
        clickCount: 1,
        pointerType: 'mouse',
      });
    }
    await sleep(320);
    evalResults.push({ click: sel, ok: true });
  }

  for (const combo of args.keys) {
    const parts = combo.split('+');
    const key = parts.pop();
    const modifiers = parts.reduce((acc, p) => {
      const lower = p.toLowerCase();
      if (lower === 'shift') acc |= 8;
      if (lower === 'ctrl' || lower === 'control') acc |= 2;
      if (lower === 'alt') acc |= 1;
      if (lower === 'meta') acc |= 4;
      return acc;
    }, 0);
    const codes = { Tab: 9, Enter: 13, Escape: 27, ' ': 32, ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40 };
    const code = codes[key] || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
    const base = { modifiers, key: key === ' ' ? ' ' : key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
    await send(ws, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
    if (key.length === 1) await send(ws, 'Input.dispatchKeyEvent', { type: 'char', text: key, ...base });
    await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(280);
  }

  for (const expression of args.evals) {
    const value = await evaluate(expression);
    evalResults.push({ expression, value });
  }

  /* 通用体检 */
  const metrics = await evaluate(`(() => {
    const doc = document.documentElement;
    const over = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2)) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') return;
        if (el.closest('.tabbar, .hscroll, [data-scroll-x], .grain')) return;
        over.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''), left: Math.round(r.left), right: Math.round(r.right) });
      }
    });
    return {
      title: document.title,
      lang: doc.lang,
      dataMotion: doc.getAttribute('data-motion'),
      dataTheme: doc.getAttribute('data-theme'),
      dataPage: doc.getAttribute('data-page'),
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      overflowX: doc.scrollWidth > window.innerWidth + 1,
      h1Count: document.querySelectorAll('h1').length,
      h1Text: document.querySelector('h1') ? document.querySelector('h1').textContent.trim().slice(0, 60) : null,
      headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => h.tagName).join(','),
      images: document.querySelectorAll('img').length,
      imagesNoAlt: Array.from(document.querySelectorAll('img')).filter(i => !i.hasAttribute('alt')).length,
      links: document.querySelectorAll('a[href]').length,
      buttons: document.querySelectorAll('button').length,
      demos: document.querySelectorAll('.demo').length,
      specs: document.querySelectorAll('.demo__spec').length,
      svgIcons: document.querySelectorAll('svg').length,
      emojiNodes: Array.from(document.querySelectorAll('body *')).filter(el => el.children.length === 0 && /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(el.textContent || '')).length,
      header: !!document.querySelector('#hdr'),
      footer: !!document.querySelector('.ftr'),
      palette: !!document.querySelector('#palette'),
      revealTotal: document.querySelectorAll('.reveal,[data-reveal],.stagger-seq').length,
      revealIn: document.querySelectorAll('.reveal--in').length,
      fontsLoaded: document.fonts ? Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family).filter((v,i,a)=>a.indexOf(v)===i) : [],
      overflowItems: over.slice(0, 12)
    };
  })()`);

  let screenshot = null;
  if (args.shot) {
    let clip = null;
    if (args.full) {
      const layout = await send(ws, 'Page.getLayoutMetrics');
      const size = layout.cssContentSize || layout.contentSize;
      clip = { x: 0, y: 0, width: Math.round(size.width), height: Math.min(Math.round(size.height), 30000), scale: 1 };
    }
    const shot = await send(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: args.full, clip: clip || undefined });
    const outPath = resolve(ROOT, args.shot);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    screenshot = args.shot;
  }

  const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'log-error');
  const consoleWarnings = consoleMessages.filter((m) => m.type === 'warning' || m.type === 'log-warning');

  const report = {
    url: args.url,
    viewport: { w: args.w, h: args.h },
    reducedMotion: args.reduced,
    title: metrics?.title,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    evalResults,
    metrics,
    screenshot,
  };

  console.log(args.json ? JSON.stringify(report, null, 2) : JSON.stringify(report));
  ws.close();
  cleanup(0);
})().catch((err) => {
  console.error('CDP 测试失败：' + err.message);
  cleanup(1);
});
