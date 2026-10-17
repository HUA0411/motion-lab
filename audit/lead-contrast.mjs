/**
 * 全站文字对比度扫描（自建，独立于验证员工具）
 * 用法：
 *   node audit/lead-contrast.mjs                 # 暗色
 *   node audit/lead-contrast.mjs --theme light   # 亮色
 *   node audit/lead-contrast.mjs --theme dark --page index
 *
 * 判定：WCAG 2.1 AA —— 普通文字 4.5:1，大字号(≥24px 或 ≥18.66px 粗体) 3:1。
 * 仅统计「真正渲染出来的文字节点」：有可见文本、有尺寸、未被 opacity:0 / visibility:hidden / display:none 隐藏。
 * 背景采用「向上取第一个不透明祖先背景」+ 半透明层叠近似（逐层 alpha 合成）。
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('../tools/node_modules/ws');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CHROME = [
  `${process.env.USERPROFILE}\\.agent-browser\\browsers\\chrome-155.0.8059.39\\chrome.exe`,
  `${process.env.USERPROFILE}\\.agent-browser\\browsers\\chrome-152.0.7977.64\\chrome.exe`,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const PAGES = [
  'index', 'atlas', 'micro-interactions', 'states-feedback', 'scroll-motion', 'page-transitions',
  'navigation', 'forms', 'gestures', 'motion-physics', 'feedback', 'accessibility', 'data-viz', 'design-system',
];

const argv = process.argv.slice(2);
const theme = argv.includes('--theme') ? argv[argv.indexOf('--theme') + 1] : 'dark';
const only = argv.includes('--page') ? argv[argv.indexOf('--page') + 1] : null;
const base = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://127.0.0.1:8912';
const pages = only ? [only] : PAGES;

const SCAN = String.raw`(() => {
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (fg, bg) => {
    const a = lum(fg), b = lum(bg);
    return a > b ? (a + 0.05) / (b + 0.05) : (b + 0.05) / (a + 0.05);
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const htmlBg = parse(getComputedStyle(document.documentElement).backgroundColor);
  const canvas = htmlBg && htmlBg.a > 0 ? htmlBg : bodyBg;

  function effectiveBg(el) {
    const stack = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const bi = cs.backgroundImage;
      const bc = parse(cs.backgroundColor);
      if (bc && bc.a > 0) stack.push(bc);
      if (bc && bc.a === 1) break;
      if (bi && bi !== 'none' && /gradient/.test(bi)) { stack.push({ unknown: true }); break; }
      node = node.parentElement;
    }
    let bg = canvas.a > 0 ? canvas : { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].unknown) return null;
      bg = over(stack[i], bg);
    }
    return bg;
  }

  const results = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 300) continue;
    const el = n.parentElement;
    if (!el) continue;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'svg') continue;
    if (el.closest('[aria-hidden="true"], .visually-hidden, .sr-only, .grain')) continue;
    /* 已知例外：分段控件的激活项文字压在绝对定位的 .tabbar__indicator（强调色）之上，
       实际前景/背景 = --ink-900 on --accent（暗 6.93:1 / 亮 4.63:1，均达标）。
       扫描器按「祖先背景」计算会误判，故此处按指示器底色计算。 */
    const indicatorHost = el.closest('.tabbar');
    if (indicatorHost && el.classList.contains('is-active') && indicatorHost.querySelector('.tabbar__indicator')) {
      const cs0 = getComputedStyle(el);
      const fg0 = parse(cs0.color);
      const bg0 = parse(getComputedStyle(indicatorHost.querySelector('.tabbar__indicator')).backgroundColor);
      if (fg0 && bg0 && bg0.a === 1) {
        const fgc0 = fg0.a < 1 ? over(fg0, bg0) : fg0;
        const size0 = parseFloat(cs0.fontSize);
        const need0 = size0 >= 24 ? 3 : 4.5;
        const rr0 = Math.round(ratio(fgc0, bg0) * 100) / 100;
        const key0 = cs0.color + '|indicator|' + size0;
        if (!seen.has(key0)) {
          seen.add(key0);
          results.push({
            el: 'button.tabbar__item.is-active',
            text: (n.nodeValue || '').trim().slice(0, 28),
            color: cs0.color,
            bg: 'rgb(' + Math.round(bg0.r) + ',' + Math.round(bg0.g) + ',' + Math.round(bg0.b) + ')',
            size: size0, weight: 400, large: size0 >= 24, need: need0, ratio: rr0, pass: rr0 >= need0 - 0.005,
          });
        }
        continue;
      }
    }
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    let op = 1, p = el;
    while (p) { op *= parseFloat(getComputedStyle(p).opacity || '1'); p = p.parentElement; }
    if (op < 0.15) continue;
    const fgRaw = parse(cs.color);
    if (!fgRaw) continue;
    const fg = op < 1 ? { ...over(fgRaw, { r: 0, g: 0, b: 0, a: 1 }), a: 1 } : fgRaw;
    const bg = effectiveBg(el);
    if (!bg) continue;
    const fgc = fg.a < 1 ? over(fg, bg) : fg;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const rr = Math.round(ratio(fgc, bg) * 100) / 100;
    const key = cs.color + '|' + (bg.r + ',' + bg.g + ',' + bg.b) + '|' + size + '|' + tag;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      el: (el.className && typeof el.className === 'string' ? tag.toLowerCase() + '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : tag.toLowerCase()),
      text: text.slice(0, 28),
      color: cs.color,
      bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
      size, weight, large, need, ratio: rr, pass: rr >= need - 0.005,
    });
  }
  return { results };
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9700 + Math.floor(Math.random() * 200);
const profile = `${process.env.TEMP}\\ml-contrast-${Date.now()}`;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--force-color-profile=srgb',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

let id = 0;
const pending = new Map();
function send(ws, method, params) {
  const i = ++id;
  return new Promise((res, rej) => {
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error('timeout ' + method)); } }, 30000);
  });
}

async function waitTarget() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const t = list.find((x) => x.type === 'page');
      if (t) return t;
    } catch {}
    await sleep(150);
  }
  throw new Error('chrome 未就绪');
}

const report = { theme, pages: {}, fails: [], total: 0 };

const target = await waitTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  }
});
await send(ws, 'Runtime.enable');
await send(ws, 'Page.enable');
await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

for (const page of pages) {
  try {
    await send(ws, 'Page.navigate', { url: `${base}/${page}.html` });
    await sleep(1900);
    /* 设置主题（走内核 API，避免闪动与首帧未应用） */
    await send(ws, 'Runtime.evaluate', {
      expression: `ML.theme.set('${theme}', {instant:true}); ML.motion.set('off');
        document.querySelectorAll('.reveal,.stagger-seq,.reveal-mask').forEach(function(e){e.classList.add('reveal--in');e.classList.add('seq--in');});
        document.querySelectorAll('[style*="opacity"]').forEach(function(e){if(parseFloat(getComputedStyle(e).opacity)<0.15)e.style.opacity='1';});
        'ok'`,
      awaitPromise: true,
    });
    await sleep(700);
    const out = await send(ws, 'Runtime.evaluate', { expression: SCAN, returnByValue: true, awaitPromise: true });
    const data = out.result.value || { results: [] };
    const fails = data.results.filter((x) => !x.pass);
    report.pages[page] = { checked: data.results.length, fails: fails.length };
    report.total += data.results.length;
    fails.forEach((f) => report.fails.push({ page, ...f }));
    console.error(`[${theme}] ${page}: checked=${data.results.length} FAIL=${fails.length}${fails.length ? ' :: ' + fails.slice(0, 6).map((f) => `${f.el} ${f.ratio}<${f.need} "${f.text}"`).join(' | ') : ''}`);
  } catch (e) {
    console.error(`[${theme}] ${page}: ERROR ${e.message}`);
    report.pages[page] = { error: e.message };
  }
}

console.log(JSON.stringify(report, null, 2));
try { chrome.kill('SIGKILL'); } catch {}
process.exit(report.fails.length ? 1 : 0);
