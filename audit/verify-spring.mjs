/**
 * 内核弹簧与调度器的离线验证（不依赖浏览器 rAF）
 * 做法：替换 requestAnimationFrame/cancelAnimationFrame 为受控队列，
 *      手动按 60fps 推进 tick 的 time 参数，观察弹簧是否收敛。
 * 用法：node audit/verify-spring.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'assets/js/motion.js'), 'utf8');

/* --- 最小 DOM 桩 --- */
function makeEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(),
    style: {
      _p: {},
      setProperty(k, v) { this._p[k] = v; },
      getPropertyValue(k) { return this._p[k] ?? ''; },
      removeProperty(k) { delete this._p[k]; },
    },
    dataset: {},
    children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); },
    },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k] ?? null; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }; },
    focus() {},
  };
  return el;
}

const documentStub = {
  documentElement: makeEl('html'),
  body: makeEl('body'),
  readyState: 'complete',
  createElement: makeEl,
  createElementNS: () => makeEl(),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
  fonts: { check: () => true },
};

/* --- 受控 rAF 队列 --- */
let queue = [];
let now = 0;
const win = {
  document: documentStub,
  location: { href: 'http://localhost/', pathname: '/', origin: 'http://localhost' },
  navigator: { userAgent: 'node', clipboard: null },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } },
  requestAnimationFrame(cb) { queue.push(cb); return queue.length; },
  cancelAnimationFrame() {},
  getComputedStyle: () => ({ getPropertyValue: () => '', transform: 'none' }),
  setTimeout: (fn, ms) => setTimeout(fn, 0),
  clearTimeout,
  innerWidth: 1440,
  innerHeight: 900,
  scrollY: 0,
  scrollTo() {},
  devicePixelRatio: 1,
  performance: { now: () => now },
  CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o); } },
  IntersectionObserver: class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  ResizeObserver: class {
    constructor() {}
    observe() {}
    disconnect() {}
  },
  DOMMatrixReadOnly: undefined,
  isSecureContext: true,
};
win.window = win;
win.self = win;
win.globalThis = win;

const context = vm.createContext(win);
vm.runInContext(src, context, { filename: 'motion.js' });

const ML = win.ML;
if (!ML) {
  console.error('FAIL: motion.js 未导出 window.ML');
  process.exit(1);
}

/** 推进 n 帧（每帧 16.667ms） */
function advance(frames) {
  for (let i = 0; i < frames; i++) {
    now += 1000 / 60;
    const snapshot = queue;
    queue = [];
    for (const cb of snapshot) cb(now);
  }
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

/* ---- 1. 弹簧收敛 ---- */
{
  const values = [];
  const h = ML.spring({ onUpdate: (v) => values.push(v) }, 0, 120, { preset: 'standard', restDelta: 0.01 });
  advance(240);
  const last = values[values.length - 1];
  check(
    'spring(standard) 收敛到目标',
    values.length > 20 && Math.abs(last - 120) < 0.05,
    `帧数=${values.length} 末值=${last?.toFixed(4)} 目标=120`
  );
  check('spring 句柄收敛后 isRunning=false', h.isRunning() === false, `isRunning=${h.isRunning()}`);
}

/* ---- 2. 首帧位移符合半隐式欧拉公式 ---- */
{
  const values = [];
  ML.spring({ onUpdate: (v) => values.push(v) }, 0, 120, { preset: 'standard' });
  advance(1);
  const expected = (340 * 120 / 1) * (1 / 60) * (1 / 60); // a=40800 → v=680 → x=11.333
  check('首帧位移与积分公式一致', Math.abs(values[0] - expected) < 0.01, `实测=${values[0].toFixed(3)} 期望=${expected.toFixed(3)}`);
  advance(239);
}

/* ---- 3. 可打断 / 速度衔接 ---- */
{
  const values = [];
  const h = ML.spring({ onUpdate: (v) => values.push(v) }, 0, 400, { preset: 'standard' });
  advance(12);
  const beforeSwitch = h.get();
  const velocityAtSwitch = h.getVelocity();
  const framesBefore = values.length;
  h.setTarget(120);
  advance(240);
  const afterSwitchValues = values.slice(framesBefore);
  check(
    '弹簧中途改目标：新目标生效、峰值不越过 400、且速度连续（首帧位移不为 0）',
    Math.abs(h.get() - 120) < 0.05 &&
      Math.max(...values) <= 400.01 &&
      afterSwitchValues.length > 5 &&
      Math.abs(afterSwitchValues[1] - afterSwitchValues[0]) > 0.5,
    `切换点=${beforeSwitch.toFixed(2)} 速度=${velocityAtSwitch.toFixed(1)} 末值=${h.get().toFixed(3)} 峰值=${Math.max(...values).toFixed(2)}`
  );
}

/* ---- 4. 多实例互不干扰（同帧取消不再误删其他任务）---- */
{
  const a = [];
  const b = [];
  const ha = ML.spring({ onUpdate: (v) => a.push(v) }, 0, 100, { preset: 'snap' });
  const hb = ML.spring({ onUpdate: (v) => b.push(v) }, 0, 200, { preset: 'soft' });
  advance(6);
  ha.stop();
  advance(200);
  check('取消一个弹簧不影响另一个', b.length > 20 && Math.abs(hb.get() - 200) < 0.05, `b帧数=${b.length} b末值=${hb.get().toFixed(3)} a帧数=${a.length}`);
}

/* ---- 5. schedule 任务约定 ---- */
{
  let ticks = 0;
  let finished = false;
  ML.schedule(() => {
    ticks++;
    if (ticks >= 10) return false; // false = 完成
    return true;
  }, () => {
    finished = true;
  });
  advance(40);
  check('schedule: fn 返回 false 时结束并调用 onDone', ticks === 10 && finished, `ticks=${ticks} onDone=${finished}`);
}

/* ---- 6. 两个 schedule 任务同帧互相取消 ----
   回归用例：A 在回调内取消 B，B 不应再执行，且 A 自身不应被误删 */
{
  let aTicks = 0;
  let bTicks = 0;
  const cancelB = ML.schedule(() => { bTicks++; return true; });
  ML.schedule(() => {
    aTicks++;
    if (aTicks === 3) cancelB();
    if (aTicks >= 8) return false;
    return true;
  });
  advance(30);
  check('同帧互相取消不误删', aTicks === 8 && bTicks <= 3, `aTicks=${aTicks} bTicks=${bTicks}`);
}

/* ---- 7. 缓动函数端点与单调性 ---- */
{
  const e = ML.ease.outQuint;
  const monotonic = Array.from({ length: 21 }, (_, i) => e(i / 20)).every((v, i, arr) => i === 0 || v >= arr[i - 1] - 1e-9);
  check('ease.outQuint 端点与单调性', Math.abs(e(0)) < 1e-6 && Math.abs(e(1) - 1) < 1e-6 && monotonic, `e(0)=${e(0)} e(1)=${e(1).toFixed(6)} 单调=${monotonic}`);
}

/* ---- 8. presets 阻尼比与设计意图一致 ---- */
{
  const zeta = (p) => p.damping / (2 * Math.sqrt(p.stiffness * p.mass));
  const zStandard = zeta(ML.presets.standard);
  const zSoft = zeta(ML.presets.soft);
  const zPlayful = zeta(ML.presets.playful);
  const zSnap = zeta(ML.presets.snap);
  check(
    '阻尼比梯度正确：playful < standard < soft，且 snap 最硬',
    zPlayful < zStandard && zStandard < zSoft && zSoft < 1 && zSnap > zPlayful,
    `ζ: snap=${zSnap.toFixed(3)} playful=${zPlayful.toFixed(3)} standard=${zStandard.toFixed(3)} soft=${zSoft.toFixed(3)}`
  );
}

/* ---- 9. 过冲：playful 应有可测过冲（3–10%），standard 不应过冲 ---- */
{
  const std = [];
  ML.spring({ onUpdate: (v) => std.push(v) }, 0, 100, { preset: 'standard' });
  advance(300);
  const play = [];
  ML.spring({ onUpdate: (v) => play.push(v) }, 0, 100, { preset: 'playful' });
  advance(300);
  const stdOver = (Math.max(...std) - 100) / 100;
  const playOver = (Math.max(...play) - 100) / 100;
  check(
    'standard 无过冲 / playful 有 3–10% 过冲',
    stdOver < 0.01 && playOver > 0.03 && playOver < 0.1,
    `standard=${(stdOver * 100).toFixed(2)}% playful=${(playOver * 100).toFixed(2)}%`
  );
}

/* ---- 10. reduced 档位下弹簧瞬时到位 ---- */
{
  ML.motion.set('off');
  const vals = [];
  ML.spring({ onUpdate: (v) => vals.push(v) }, 0, 88, { preset: 'standard' });
  advance(2);
  const ok = vals.length >= 1 && Math.abs(vals[vals.length - 1] - 88) < 1e-6;
  ML.motion.set('system');
  check('data-motion=off 时弹簧瞬时到位', ok, `更新次数=${vals.length} 末值=${vals[vals.length - 1]}`);
}

const failed = results.filter((r) => !r.pass);
console.log('');
console.log(`==== 汇总：${results.length - failed.length}/${results.length} PASS ====`);
if (failed.length) {
  failed.forEach((f) => console.log(`  FAIL: ${f.name} — ${f.detail}`));
  process.exit(1);
}
process.exit(0);
