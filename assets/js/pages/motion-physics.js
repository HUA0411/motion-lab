/* 展厅 H · 运动物理
   曲线与小球共用同一物理模型：m·x″ = −k·x − c·x′
   曲线由数值积分（半隐式欧拉 dt=1/480）得出，小球由 ML.spring 用同一组 k/c/m 驱动。 */
(function () {
  'use strict';

  var d = document;

  function q(sel, root) { return ML.q(sel, root || d); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r1(n) { return Math.round(n * 10) / 10; }
  /* setPointerCapture 在指针已释放时可能抛 InvalidPointerId，统一兜底 */
  function cap(el, id) { try { el.setPointerCapture(id); } catch (err) { /* 指针已释放，忽略 */ } }
  function nowMs() { return (window.performance || Date).now(); }
  function reduced() { return ML.reduced === true || (ML.motion && ML.motion.get() !== 'on'); }
  function icon(name, size) { return (ML.UI && ML.UI.icon) ? ML.UI.icon(name, { size: size || 18 }) : d.createElement('span'); }
  function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
  function tokenMs(name, fallback) {
    var v = getComputedStyle(d.documentElement).getPropertyValue(name).trim();
    var n = parseFloat(v);
    if (!isFinite(n)) return fallback;
    return v.indexOf('ms') >= 0 ? n : n * 1000;
  }
  function tokenEase(name, fallback) {
    var v = getComputedStyle(d.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  /* 逐帧循环：优先用内核 ML.schedule（其约定为「回调返回 false 表示完成」），无则退回自递归 ML.raf */
  function loop(step) {
    if (ML.schedule) {
      var off = ML.schedule(function () { return step() !== false; });
      return function stop() { if (off) off(); };
    }
    var stopped = false, cancel = null;
    function tick() {
      if (stopped) return;
      if (step() === false) { stopped = true; return; }
      cancel = ML.raf(tick);
    }
    cancel = ML.raf(tick);
    return function stop() { stopped = true; if (cancel) cancel(); };
  }

  /* 本地弹簧驱动：与内核弹簧同一物理模型（半隐式欧拉 F = −k·x − c·v，dt ≤ 1/30），
     参数与 ML.presets 对齐，句柄接口与内核一致（.stop/.setTarget/.set/.get/.getVelocity/.isRunning）。
     起因：内核 schedule 把「回调返回 false」当作完成，而内核弹簧的 step 在运行中恰好返回 false，
     内核弹簧因此首帧后被移出帧循环（已上报 Lead）。内核修复后本函数可一行切回内核弹簧。 */
  var SPRING_PRESETS = {
    snap: { stiffness: 520, damping: 30, mass: 0.7 },
    standard: { stiffness: 340, damping: 28, mass: 1 },
    soft: { stiffness: 170, damping: 24, mass: 1.2 },
    playful: { stiffness: 420, damping: 24, mass: 1 }
  };
  function createSpring(handle, from, to, opts) {
    var o = opts || {};
    var preset = SPRING_PRESETS[o.preset] || null;
    var k = o.stiffness || (preset ? preset.stiffness : SPRING_PRESETS.standard.stiffness);
    var c = o.damping || (preset ? preset.damping : SPRING_PRESETS.standard.damping);
    var m = o.mass || (preset ? preset.mass : SPRING_PRESETS.standard.mass);
    var restDelta = o.restDelta || 0.001;
    var restSpeed = o.restSpeed || 0.01;
    var value = typeof from === 'number' ? from : 0;
    var velocity = o.velocity || 0;
    var target = to, settleFrames = 0, running = true, last = 0, cancel = null, done = false;

    function complete() {
      if (done) return;
      done = true;
      if (handle.onComplete) handle.onComplete(value);
      else if (o.onComplete) o.onComplete(value);
    }
    if (reduced()) {
      value = target;
      if (handle.onUpdate) handle.onUpdate(value, 0);
      if (handle.onComplete || o.onComplete) window.setTimeout(complete, 0);
      return {
        stop: function () {},
        setTarget: function (v) { target = v; value = v; if (handle.onUpdate) handle.onUpdate(value, 0); },
        set: function (v) { value = v; if (handle.onUpdate) handle.onUpdate(value, 0); },
        get: function () { return value; },
        getVelocity: function () { return 0; },
        isRunning: function () { return false; },
        params: { stiffness: k, damping: c, mass: m }
      };
    }
    function step() {
      if (!running) return false;
      var t = nowMs();
      var dt = Math.min(1 / 30, last ? (t - last) / 1000 : 1 / 60);
      last = t;
      var displacement = value - target;
      velocity += ((-k * displacement - c * velocity) / m) * dt;
      value += velocity * dt;
      if (handle.onUpdate) handle.onUpdate(value, velocity);
      if (Math.abs(velocity) < restSpeed && Math.abs(value - target) < restDelta) settleFrames++;
      else settleFrames = 0;
      if (settleFrames > 2) {
        value = target;
        velocity = 0;
        if (handle.onUpdate) handle.onUpdate(value, 0);
        running = false;
        complete();
        return false;
      }
      return true;
    }
    function start() {
      if (cancel) cancel();
      last = 0;
      done = false;
      cancel = loop(step);
    }
    start();
    return {
      stop: function () { running = false; if (cancel) { cancel(); cancel = null; } },
      setTarget: function (v) {
        target = v;
        settleFrames = 0;
        if (!running) { running = true; start(); }
      },
      set: function (v) { value = v; if (handle.onUpdate) handle.onUpdate(value, 0); },
      get: function () { return value; },
      getVelocity: function () { return velocity; },
      isRunning: function () { return running; },
      params: { stiffness: k, damping: c, mass: m }
    };
  }

  /* ---------------------------------------------------------------- 物理 */
  function simulate(k, c, m, T) {
    var dt = 1 / 480;
    var steps = Math.round((T || 1.4) / dt);
    var xs = new Array(steps + 1), vs = new Array(steps + 1);
    var x = 0, v = 0, t = 0, i, peak = 0, peakT = 0, lastOut = -1, vmax = 0.0001;
    for (i = 0; i <= steps; i++) {
      xs[i] = x; vs[i] = v;
      if (x > peak) { peak = x; peakT = t; }
      if (Math.abs(v) > vmax) vmax = Math.abs(v);
      if (Math.abs(x - 1) > 0.02) lastOut = i;
      var a = (k * (1 - x) - c * v) / m;
      v += a * dt;
      x += v * dt;
      t += dt;
    }
    var ccrit = 2 * Math.sqrt(k * m);
    return {
      k: k, c: c, m: m, dt: dt, T: T || 1.4, xs: xs, vs: vs, vmax: vmax,
      peak: peak, peakT: peakT, overshoot: Math.max(0, (peak - 1) * 100),
      settle: lastOut < 0 ? 0 : lastOut * dt, ccrit: ccrit, zeta: c / ccrit
    };
  }

  function curvePath(samples, count, mapX, mapY, step) {
    var out = '', i, first = true;
    for (i = 0; i <= count; i += step) {
      out += (first ? 'M' : 'L') + r1(mapX(i)) + ' ' + r1(mapY(samples[i]));
      first = false;
    }
    return out;
  }

  function cubicBezier(x1, y1, x2, y2) {
    function cx(t) { return 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t; }
    function cy(t) { return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t; }
    function dcx(t) { return 3 * x1 * (1 - 4 * t + 3 * t * t) + 3 * x2 * (2 * t - 3 * t * t) + 3 * t * t; }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x, i, e, der;
      for (i = 0; i < 8; i++) {
        e = cx(t) - x;
        if (Math.abs(e) < 1e-4) break;
        der = dcx(t);
        if (Math.abs(der) < 1e-6) break;
        t -= e / der;
      }
      for (i = 0; i < 6; i++) {
        e = cx(t) - x;
        if (Math.abs(e) < 1e-5) break;
        t = e > 0 ? t - 0.001 : t + 0.001;
      }
      return cy(clamp(t, 0, 1));
    };
  }

  /* ------------------------------------------------------------ 01 调参器 */
  function bootTuner() {
    var trackEl = q('#mp-track'), ball = q('#mp-ball');
    if (!trackEl || !ball) return;
    var inK = q('#mp-k'), inC = q('#mp-c'), inM = q('#mp-m');
    var nK = q('#mp-k-num'), nC = q('#mp-c-num'), nM = q('#mp-m-num');
    if (!inK || !inC || !inM) return;
    var pathX = q('#mp-curve-x'), pathV = q('#mp-curve-v'), head = q('#mp-head');
    var refTarget = q('#mp-reftarget'), ccritLine = q('#mp-ccrit-line'), cmark = q('#mp-cmark'), under = q('#mp-under'), ccritText = q('#mp-ccrit-text');
    var outZeta = q('#mp-zeta'), outCcrit = q('#mp-ccrit'), outOver = q('#mp-overshoot');
    var outPeakT = q('#mp-peak-t'), outSettle = q('#mp-settle'), status = q('#mp-tuner-status');
    var btnRun = q('#mp-tuner-run'), btnReset = q('#mp-tuner-reset'), btnCrit = q('#mp-tuner-crit');

    var X0 = 40, X1 = 360, XAXIS_Y = 140, CMAX = 70, GAUGE_Y0 = 20, GAUGE_Y1 = 190;
    var sim = null, spring = null, travel = 200, ballX = 0, lastV = 0, t0 = 0, running = false, queue = false;

    function travelPx() { return Math.max(60, (trackEl.clientWidth || 320) - 28 - 22); }
    function scaleOf(s) { return 120 / Math.max(1.1, s.peak * 1.06); }
    function yForX(x, scale) { return clamp(XAXIS_Y - x * scale, 18, 186); }
    function yForC(c) { return GAUGE_Y1 - (clamp(c, 0, CMAX) / CMAX) * (GAUGE_Y1 - GAUGE_Y0); }

    function redraw() {
      var k = parseFloat(inK.value), c = parseFloat(inC.value), m = parseFloat(inM.value);
      sim = simulate(k, c, m, 1.4);
      var scale = scaleOf(sim), n = sim.xs.length - 1;
      var mapX = function (i) { return X0 + (i / n) * (X1 - X0); };
      if (pathX) pathX.setAttribute('d', curvePath(sim.xs, n, mapX, function (x) { return yForX(x, scale); }, 4));
      var vscale = 40 / sim.vmax;
      if (pathV) pathV.setAttribute('d', curvePath(sim.vs, n, mapX, function (v) { return clamp(150 - v * vscale, 108, 190); }, 4));
      if (refTarget) {
        refTarget.setAttribute('y1', r1(yForX(1, scale)));
        refTarget.setAttribute('y2', r1(yForX(1, scale)));
      }
      var cyCrit = yForC(sim.ccrit);
      if (ccritLine) { ccritLine.setAttribute('y1', r1(cyCrit)); ccritLine.setAttribute('y2', r1(cyCrit)); }
      if (ccritText) ccritText.setAttribute('y', r1(clamp(cyCrit - 6, 26, 184)));
      if (under) { under.setAttribute('y', r1(cyCrit)); under.setAttribute('height', r1(Math.max(0, GAUGE_Y1 - cyCrit))); }
      if (cmark) { cmark.setAttribute('cx', 420); cmark.setAttribute('cy', r1(yForC(c))); }
      if (head && !running) {
        var peakIdx = clamp(Math.round(sim.peakT / sim.dt), 0, n);
        head.setAttribute('cx', r1(mapX(peakIdx)));
        head.setAttribute('cy', r1(yForX(sim.xs[peakIdx], scale)));
      }
      setText(outZeta, sim.zeta.toFixed(2) + (sim.c < sim.ccrit ? ' · 欠阻尼' : ' · 临界/过阻尼'));
      setText(outCcrit, sim.ccrit.toFixed(1) + '（当前 c=' + c + '）');
      setText(outOver, sim.overshoot.toFixed(1) + '%');
      setText(outPeakT, sim.peakT.toFixed(2) + 's');
      setText(outSettle, sim.settle.toFixed(2) + 's');
    }

    function place(v) { ball.style.transform = 'translate3d(' + r1(v) + 'px,-50%,0)'; }

    function followHead(elapsed) {
      if (!head || !sim) return;
      var i = clamp(Math.round(elapsed / sim.dt), 0, sim.xs.length - 1);
      var n = sim.xs.length - 1;
      head.setAttribute('cx', r1(X0 + (i / n) * (X1 - X0)));
      head.setAttribute('cy', r1(yForX(sim.xs[i], scaleOf(sim))));
    }

    function params() { return { k: parseFloat(inK.value), c: parseFloat(inC.value), m: parseFloat(inM.value) }; }

    function run() {
      travel = travelPx();
      if (spring) { spring.stop(); spring = null; }
      running = true;
      t0 = nowMs();
      if (reduced()) {
        var pct = [0.18, 0.42, 0.68, 0.88, 1];
        pct.forEach(function (f, idx) {
          window.setTimeout(function () {
            ballX = travel * f;
            place(ballX);
            followHead(idx * 0.12);
          }, 110 * (idx + 1));
        });
        window.setTimeout(function () {
          running = false;
          setText(status, '降级（' + (ML.motion ? ML.motion.get() : 'lite') + '）：5 级逐步跳变 · 整定 ' + sim.settle.toFixed(2) + 's · 过冲 ' + sim.overshoot.toFixed(1) + '%');
        }, 110 * pct.length + 40);
        return;
      }
      var p = params();
      spring = createSpring({
        onUpdate: function (v, vel) {
          ballX = v;
          lastV = vel || 0;
          place(v);
          followHead((nowMs() - t0) / 1000);
        }
      }, 0, travel, {
        stiffness: p.k, damping: p.c, mass: p.m, velocity: 0,
        onComplete: function () {
          running = false; lastV = 0;
          setText(status, '到位 · 整定 ' + sim.settle.toFixed(2) + 's · 过冲 ' + sim.overshoot.toFixed(1) + '% · ζ=' + sim.zeta.toFixed(2));
        }
      });
    }

    function applyParams(rebuild, after) {
      if (queue) return;
      queue = true;
      var un = ML.raf(function () {
        un();
        queue = false;
        travel = travelPx();
        redraw();
        if (rebuild && running && spring && !reduced()) {
          spring.stop();
          var p = params();
          spring = createSpring({
            onUpdate: function (v, vel) {
              ballX = v;
              lastV = vel || 0;
              place(v);
              followHead((nowMs() - t0) / 1000);
            }
          }, clamp(ballX, 0, travel), travel, {
            stiffness: p.k, damping: p.c, mass: p.m, velocity: lastV,
            onComplete: function () { running = false; lastV = 0; }
          });
        }
        setText(status, 'k=' + p2().k + ' c=' + p2().c + ' m=' + p2().m + ' · ζ=' + sim.zeta.toFixed(2) +
          ' · 2√(km)=' + sim.ccrit.toFixed(1) + ' · 过冲 ' + sim.overshoot.toFixed(1) + '%');
        if (after) after();
      });
    }
    function p2() { return params(); }

    function sync(fromEl, toEl) { toEl.value = String(parseFloat(fromEl.value)); }

    ML.on(inK, 'input', function () { sync(inK, nK); applyParams(true); });
    ML.on(inC, 'input', function () { sync(inC, nC); applyParams(true); });
    ML.on(inM, 'input', function () { sync(inM, nM); applyParams(true); });
    [nK, nC, nM].forEach(function (num) {
      ML.on(num, 'change', function () {
        var rng = num === nK ? inK : num === nC ? inC : inM;
        var v = clamp(parseFloat(num.value) || parseFloat(rng.value), parseFloat(rng.min), parseFloat(rng.max));
        num.value = String(v);
        rng.value = String(v);
        applyParams(true);
      });
    });
    if (btnRun) {
      btnRun.appendChild(icon('play', 16));
      ML.on(btnRun, 'click', function () { if (spring) { spring.stop(); spring = null; } ballX = 0; place(0); running = false; run(); });
    }
    if (btnReset) {
      btnReset.appendChild(icon('refresh', 16));
      ML.on(btnReset, 'click', function () {
        if (spring) { spring.stop(); spring = null; }
        running = false; lastV = 0; ballX = 0;
        place(0);
        redraw();
        setText(status, '已复位 · 点「释放小球」开始');
      });
    }
    if (btnCrit) {
      btnCrit.appendChild(icon('sliders', 16));
      ML.on(btnCrit, 'click', function () {
        var p = params();
        var crit = clamp(Math.round(2 * Math.sqrt(p.k * p.m) * 2) / 2, parseFloat(inC.min), parseFloat(inC.max));
        inC.value = String(crit); nC.value = String(crit);
        applyParams(true, function () {
          setText(status, '已切到临界阻尼 c=' + crit + ' = 2√(k·m) · 实测过冲 ' + sim.overshoot.toFixed(1) + '% · ζ=' + sim.zeta.toFixed(2));
        });
      });
    }
    if (ML.observeSize) ML.observeSize(trackEl, function () { travel = travelPx(); redraw(); });
    if (ML.motion && ML.motion.onChange) ML.motion.onChange(function () { redraw(); });
    redraw();
    place(0);
    setText(status, 'k=' + inK.value + ' c=' + inC.value + ' m=' + inM.value + ' · 2√(km)=' + sim.ccrit.toFixed(1) + ' · 点「释放小球」开始');
  }

  /* ------------------------------------------- 02 过冲对比（临界 vs playful） */
  function bootOvershoot() {
    var ballC = q('#mp-ball-crit'), ballP = q('#mp-ball-play'), lane = q('.mp-lane');
    var outC = q('#mp-out-crit'), outP = q('#mp-out-play');
    var run = q('#mp-over-run'), reset = q('#mp-over-reset');
    if (!ballC || !ballP || !lane) return;
    var presetC = (ML.presets && ML.presets.standard) || { stiffness: 340, damping: 28, mass: 1 };
    var presetP = (ML.presets && ML.presets.playful) || { stiffness: 420, damping: 17, mass: 1 };
    var live = [];
    var names = qa('.mp-over__name');
    if (names[0]) names[0].textContent = 'standard · ' + presetC.stiffness + '/' + presetC.damping + '/' + presetC.mass;
    if (names[1]) names[1].textContent = 'playful · ' + presetP.stiffness + '/' + presetP.damping + '/' + presetP.mass;

    function laneW() { return Math.max(60, (lane.clientWidth || 240) - 28); }
    function theory(preset) {
      var s = simulate(preset.stiffness, preset.damping, preset.mass, 1.4);
      return 'ζ=' + s.zeta.toFixed(2) + ' · 理论过冲 ' + s.overshoot.toFixed(1) + '% · 2√(km)=' + s.ccrit.toFixed(1);
    }

    function fire() {
      live.forEach(function (s) { if (s) s.stop(); });
      live = [];
      var travel = laneW();
      [[ballC, presetC, outC], [ballP, presetP, outP]].forEach(function (row) {
        var el = row[0], preset = row[1], out = row[2];
        var peak = 0, t0 = nowMs();
        if (reduced()) {
          el.style.transform = 'translate3d(' + travel + 'px,-50%,0)';
          el.style.opacity = '0.7';
          setText(out, '降级：瞬时到位 · ' + theory(preset));
          return;
        }
        el.style.opacity = '1';
        live.push(createSpring({
          onUpdate: function (v) {
            if (v > peak) peak = v;
            el.style.transform = 'translate3d(' + r1(v) + 'px,-50%,0)';
          }
        }, 0, travel, {
          stiffness: preset.stiffness, damping: preset.damping, mass: preset.mass,
          onComplete: function () {
            var measured = Math.max(0, (peak / travel - 1) * 100);
            setText(out, theory(preset) + ' · 实测过冲 ' + measured.toFixed(1) + '% · ' + Math.round(nowMs() - t0) + 'ms');
          }
        }));
      });
    }

    if (run) { run.appendChild(icon('zap', 16)); ML.on(run, 'click', fire); }
    if (reset) {
      reset.appendChild(icon('refresh', 16));
      ML.on(reset, 'click', function () {
        live.forEach(function (s) { if (s) s.stop(); });
        live = [];
        ballC.style.transform = 'translate3d(0,-50%,0)';
        ballP.style.transform = 'translate3d(0,-50%,0)';
        setText(outC, theory(presetC));
        setText(outP, theory(presetP));
      });
    }
    setText(outC, theory(presetC));
    setText(outP, theory(presetP));
  }

  /* --------------------------------------------------- 03 可打断（速度衔接） */
  function bootInterrupt() {
    var ball = q('#mp-ball-int');
    var trackEl = ball ? ball.parentNode : null;
    var outTarget = q('#mp-int-target'), outV = q('#mp-int-v'), outCount = q('#mp-int-count');
    var status = q('#mp-int-status'), go = q('#mp-int-go'), hit = q('#mp-int-hit'), reset = q('#mp-int-reset');
    if (!ball || !trackEl || !go) return;
    var spring = null, pos = 0, vel = 0, counts = 0, alt = false;

    function travel() { return Math.max(60, (trackEl.clientWidth || 320) - 46); }
    function at(frac) { return 20 + frac * travel(); }
    function place(v) { ball.style.transform = 'translate3d(' + r1(v) + 'px,-50%,0)'; }
    function ensure() {
      if (spring) return spring;
      spring = createSpring({
        onUpdate: function (v, vv) { pos = v; vel = vv || 0; place(v); },
        onComplete: function () { vel = 0; setText(outV, '0 px/s（已停）'); }
      }, pos, pos, { preset: 'soft' });
      return spring;
    }
    if (ML.motion && ML.motion.onChange) ML.motion.onChange(function () { spring = null; });

    ML.on(go, 'click', function () {
      setText(outTarget, 'C');
      if (reduced()) {
        pos = at(0.88); place(pos);
        setText(outV, '0（降级：瞬时到位）');
        setText(status, '降级模式：不做速度衔接，直接跳到目标 C');
        return;
      }
      ensure().setTarget(at(0.88));
      setText(status, '飞向 C · 现在点「中途改目标」观察速度不归零');
    });
    ML.on(hit, 'click', function () {
      counts++;
      setText(outCount, String(counts));
      alt = !alt;
      if (reduced()) {
        pos = at(alt ? 0.12 : 0.88); place(pos);
        setText(outTarget, alt ? 'A' : 'C');
        setText(outV, '0（降级：不做衔接）');
        setText(status, '降级模式：直接跳到 ' + (alt ? 'A' : 'C'));
        return;
      }
      var before = Math.abs(vel);
      ensure().setTarget(at(alt ? 0.12 : 0.88));
      setText(outTarget, alt ? 'A' : 'C');
      setText(outV, Math.round(before) + ' px/s（衔接，未归零）');
      setText(status, '第 ' + counts + ' 次打断：目标改到 ' + (alt ? 'A' : 'C') + '，速度从 ' + Math.round(before) + ' px/s 续算');
    });
    if (reset) {
      reset.appendChild(icon('refresh', 16));
      ML.on(reset, 'click', function () {
        if (spring) { spring.stop(); spring = null; }
        pos = 0; vel = 0; counts = 0; alt = false;
        place(0);
        setText(outCount, '0'); setText(outTarget, '—'); setText(outV, '0 px/s');
        setText(status, '等待开始');
      });
    }
    go.appendChild(icon('arrow-right', 16));
    hit.appendChild(icon('wand', 16));
    place(0);
  }

  /* ------------------------------------------------------ 04 缓动曲线对比 */
  function bootEasing() {
    var pathA = q('#mp-ease-path-a'), pathB = q('#mp-ease-path-b');
    var dotA = q('#mp-ease-dot-a'), dotB = q('#mp-ease-dot-b');
    var selA = q('#mp-ease-a'), selB = q('#mp-ease-b'), dur = q('#mp-ease-dur'), durOut = q('#mp-ease-dur-out');
    var cpA = q('#mp-ease-cp-a'), cpB = q('#mp-ease-cp-b'), midA = q('#mp-ease-mid-a'), midB = q('#mp-ease-mid-b');
    var btn = q('#mp-ease-run');
    if (!pathA || !selA || !selB) return;
    var LIST = [
      ['--ease-out-quint', [0.22, 1, 0.36, 1]],
      ['--ease-out-expo', [0.16, 1, 0.3, 1]],
      ['--ease-in-quad', [0.55, 0.085, 0.68, 0.53]],
      ['--ease-in-out-quart', [0.76, 0, 0.24, 1]],
      ['--ease-spring-soft', [0.34, 1.56, 0.64, 1]],
      ['--ease-snap', [0.2, 0.9, 0.25, 1]],
      ['linear（仅进度条允许）', [0, 0, 1, 1]]
    ];
    var X0 = 40, X1 = 290, Y0 = 220, Y1 = 20;

    function fill(sel, idx) {
      LIST.forEach(function (item, i) {
        var o = d.createElement('option');
        o.value = String(i);
        o.textContent = item[0];
        if (i === idx) o.selected = true;
        sel.appendChild(o);
      });
      sel.value = String(idx);
    }
    fill(selA, 0);
    fill(selB, 4);

    function cpOf(sel) { return LIST[clamp(parseInt(sel.value, 10) || 0, 0, LIST.length - 1)]; }
    function px(x) { return X0 + x * (X1 - X0); }
    function py(y) { return clamp(Y0 - y * (Y0 - Y1), 8, 232); }

    var fnA = null, fnB = null, unraf = null;

    function place(t) {
      dotA.setAttribute('cx', r1(px(t)));
      dotA.setAttribute('cy', r1(py(fnA(t))));
      dotB.setAttribute('cx', r1(px(t)));
      dotB.setAttribute('cy', r1(py(fnB(t))));
    }
    function draw() {
      var a = cpOf(selA), b = cpOf(selB);
      fnA = cubicBezier(a[1][0], a[1][1], a[1][2], a[1][3]);
      fnB = cubicBezier(b[1][0], b[1][1], b[1][2], b[1][3]);
      var da = '', db = '', i, x, first = true;
      for (i = 0; i <= 72; i++) {
        x = i / 72;
        da += (first ? 'M' : 'L') + r1(px(x)) + ' ' + r1(py(fnA(x)));
        db += (first ? 'M' : 'L') + r1(px(x)) + ' ' + r1(py(fnB(x)));
        first = false;
      }
      pathA.setAttribute('d', da);
      pathB.setAttribute('d', db);
      setText(cpA, 'cubic-bezier(' + a[1].join(', ') + ')');
      setText(cpB, 'cubic-bezier(' + b[1].join(', ') + ')');
      setText(midA, fnA(0.5).toFixed(3));
      setText(midB, fnB(0.5).toFixed(3));
      place(0);
    }
    function play() {
      if (unraf) { unraf(); unraf = null; }
      if (reduced()) { place(1); return; }
      var ms = parseFloat(dur.value) || 560;
      var t0 = nowMs();
      unraf = loop(function () {
        var p = clamp((nowMs() - t0) / ms, 0, 1);
        place(p);
        if (p >= 1) { unraf = null; return false; }
        return true;
      });
    }
    ML.on(selA, 'change', draw);
    ML.on(selB, 'change', draw);
    ML.on(dur, 'input', function () { setText(durOut, dur.value + 'ms'); });
    if (btn) { btn.appendChild(icon('play', 16)); ML.on(btn, 'click', play); }
    draw();
    setText(durOut, dur.value + 'ms');
  }

  /* ----------------------------------------------------------- 05 时长阶梯 */
  function bootDurations() {
    var list = q('#mp-durs-list'), status = q('#mp-durs-status'), run = q('#mp-durs-run');
    if (!list || !run) return;
    var DURS = [['--dur-instant', 80], ['--dur-fast', 150], ['--dur-base', 240], ['--dur-slow', 360], ['--dur-slower', 560]];
    var rows = [];
    var ease = tokenEase('--ease-out-quint', 'cubic-bezier(.22,1,.36,1)');
    DURS.forEach(function (item) {
      var ms = tokenMs(item[0], item[1]);
      var li = d.createElement('li');
      li.className = 'mp-durs__row';
      var tok = d.createElement('span');
      tok.className = 'mp-durs__tok';
      tok.textContent = item[0];
      var val = d.createElement('span');
      val.className = 'mp-durs__val';
      val.textContent = Math.round(ms) + 'ms';
      var rail = d.createElement('span');
      rail.className = 'mp-durs__rail';
      var fill = d.createElement('span');
      fill.className = 'mp-durs__fill';
      var chip = d.createElement('span');
      chip.className = 'mp-durs__chip';
      rail.appendChild(fill); rail.appendChild(chip);
      var out = d.createElement('span');
      out.className = 'mp-durs__ms';
      out.textContent = '—';
      li.appendChild(tok); li.appendChild(val); li.appendChild(rail); li.appendChild(out);
      list.appendChild(li);
      rows.push({ ms: ms, chip: chip, fill: fill, out: out });
    });

    function fire() {
      var t0 = nowMs();
      rows.forEach(function (row) {
        var dist = Math.max(30, (row.chip.parentNode.clientWidth || 160) - 26);
        if (reduced()) {
          row.chip.style.transition = 'none';
          row.fill.style.transition = 'none';
          row.chip.style.transform = 'translate3d(' + dist + 'px,0,0)';
          row.fill.style.transform = 'scaleX(1)';
          setText(row.out, '0ms（降级）');
          return;
        }
        row.chip.style.transition = 'transform ' + row.ms + 'ms ' + ease;
        row.fill.style.transition = 'transform ' + row.ms + 'ms ' + ease;
        row.chip.style.transform = 'translate3d(0,0,0)';
        row.fill.style.transform = 'scaleX(0)';
        void row.chip.offsetWidth;
        row.chip.style.transform = 'translate3d(' + dist + 'px,0,0)';
        row.fill.style.transform = 'scaleX(1)';
        var measured = false;
        var done = function () {
          if (measured) return;
          measured = true;
          setText(row.out, Math.round(nowMs() - t0) + 'ms');
        };
        ML.once(row.chip, 'transitionend', done);
        window.setTimeout(done, row.ms + 90);
      });
      setText(status, '同步触发 ' + rows.length + ' 档 · 最长 ' + Math.round(rows[rows.length - 1].ms) + 'ms · token 实测值 ' +
        rows.map(function (r) { return Math.round(r.ms); }).join(' / ') + 'ms');
    }
    if (run) { run.appendChild(icon('zap', 16)); ML.on(run, 'click', fire); }
    setText(status, '等待同步触发 · token 实测值 ' + rows.map(function (r) { return Math.round(r.ms); }).join(' / ') + 'ms');
  }

  /* ----------------------------------------------------- 06 退出快于进入 */
  function bootExit() {
    var panelIn = q('#mp-exit-in'), panelOut = q('#mp-exit-out'), btn = q('#mp-exit-toggle');
    var outIn = q('#mp-exit-in-ms'), outOut = q('#mp-exit-out-ms'), outRatio = q('#mp-exit-ratio');
    if (!panelIn || !panelOut || !btn) return;
    var boxIn = q('.mp-exit__box', panelIn);
    var mIn = 0, mOut = 0, dir = 'in';

    function toggle() {
      var open = panelIn.getAttribute('data-open') === 'true';
      var next = open ? 'false' : 'true';
      if (reduced()) {
        panelIn.setAttribute('data-open', next);
        panelOut.setAttribute('data-open', next);
        if (open) setText(outOut, '0ms（降级：仅不透明度）');
        else setText(outIn, '0ms（降级：仅不透明度）');
        setText(outRatio, '降级：不做位移，比例不适用');
      } else {
        dir = open ? 'out' : 'in';
        var t0 = nowMs(), done = false;
        var finish = function () {
          if (done) return;
          done = true;
          var ms = Math.round(nowMs() - t0);
          if (dir === 'in') { mIn = ms; setText(outIn, ms + 'ms'); }
          else { mOut = ms; setText(outOut, ms + 'ms'); }
          if (mIn && mOut) setText(outRatio, (mOut / mIn).toFixed(2) + '（目标 0.68）');
        };
        if (boxIn) {
          ML.once(boxIn, 'transitionend', finish);
          window.setTimeout(finish, 760);
        }
        panelIn.setAttribute('data-open', next);
        panelOut.setAttribute('data-open', next);
      }
      btn.textContent = open ? '显示两侧' : '隐藏两侧';
      btn.setAttribute('aria-pressed', String(!open));
    }
    btn.appendChild(icon('play', 16));
    ML.on(btn, 'click', toggle);
  }

  /* ------------------------------------------------------------ 07 stagger */
  function bootStagger() {
    var grid = q('#mp-stagger-grid'), range = q('#mp-stagger-range'), out = q('#mp-stagger-out');
    var status = q('#mp-stagger-status'), run = q('#mp-stagger-run');
    if (!grid || !range) return;
    var cells = [], n = 12, base = tokenMs('--dur-base', 240), i;
    for (i = 0; i < n; i++) {
      var li = d.createElement('li');
      li.className = 'mp-stagger__cell';
      li.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      grid.appendChild(li);
      cells.push(li);
    }
    function play() {
      var st = parseFloat(range.value) || 0;
      var total = Math.round(base + (n - 1) * st);
      cells.forEach(function (cell) {
        cell.classList.remove('is-in');
        cell.style.transitionDelay = reduced() ? '0ms' : '0ms';
      });
      void grid.offsetWidth;
      cells.forEach(function (cell, idx) {
        if (reduced()) { cell.classList.add('is-in'); return; }
        cell.style.transitionDelay = (idx * st) + 'ms';
        cell.classList.add('is-in');
      });
      setText(status, '总时长 ≈ ' + total + 'ms = ' + Math.round(base) + 'ms + (' + n + '−1) × ' + st + 'ms' +
        (reduced() ? ' · 降级：同时淡入（仅不透明度）' : ''));
    }
    ML.on(range, 'input', function () {
      setText(out, range.value + 'ms');
      setText(status, 'stagger=' + range.value + 'ms · 总时长 ≈ ' + Math.round(base + (n - 1) * (parseFloat(range.value) || 0)) + 'ms');
    });
    if (run) { run.appendChild(icon('play', 16)); ML.on(run, 'click', play); }
    play();
  }

  /* --------------------------------------------------------- 08 1:1 跟随手指 */
  function bootFollow() {
    var pad = q('#mp-pad'), puck = q('#mp-puck'), lag = q('#mp-lag');
    var posOut = q('#mp-follow-pos'), lagOut = q('#mp-follow-lag'), srcOut = q('#mp-follow-src'), status = q('#mp-follow-status');
    if (!pad || !puck || !lag) return;
    var px = 12, py = 12, lagX = 12, lagY = 12, dragging = false, activeId = null;
    var springX = null, springY = null;

    function bounds() {
      return { w: Math.max(0, (pad.clientWidth || 300) - 28), h: Math.max(0, (pad.clientHeight || 240) - 28) };
    }
    function writePuck() { puck.style.transform = 'translate3d(' + r1(px) + 'px,' + r1(py) + 'px,0)'; }
    function writeLag() {
      lag.style.transform = 'translate3d(' + r1(lagX + 11) + 'px,' + r1(lagY + 11) + 'px,0)';
      var dx = px - lagX, dy = py - lagY;
      setText(lagOut, Math.round(Math.sqrt(dx * dx + dy * dy)) + ' px');
    }
    function ensureSprings() {
      if (!springX) {
        springX = createSpring({ onUpdate: function (x) { lagX = x; writeLag(); } }, lagX, px, { preset: 'soft' });
      }
      if (!springY) {
        springY = createSpring({ onUpdate: function (y) { lagY = y; writeLag(); } }, lagY, py, { preset: 'soft' });
      }
    }
    if (ML.motion && ML.motion.onChange) ML.motion.onChange(function () { springX = null; springY = null; });

    function drive(x, y) {
      var b = bounds();
      px = clamp(x, 0, b.w);
      py = clamp(y, 0, b.h);
      writePuck();
      setText(posOut, Math.round(px) + ', ' + Math.round(py));
      if (reduced()) {
        lagX = px; lagY = py;
        writeLag();
      } else {
        ensureSprings();
        springX.setTarget(px);
        springY.setTarget(py);
      }
    }
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      activeId = e.pointerId;
      if (pad.setPointerCapture) cap(pad, e.pointerId);
      setText(srcOut, e.pointerType === 'touch' ? '触摸' : '指针');
      var r = pad.getBoundingClientRect();
      drive(e.clientX - r.left - 14, e.clientY - r.top - 14);
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging || (activeId !== null && e.pointerId !== activeId)) return;
      var r = pad.getBoundingClientRect();
      drive(e.clientX - r.left - 14, e.clientY - r.top - 14);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      activeId = null;
      setText(status, '已松手 · 拖尾球继续用 soft(170/24/1.2) 弹簧收敛');
    }
    ML.on(pad, 'pointerdown', onDown);
    ML.on(pad, 'pointermove', onMove);
    ML.on(pad, 'pointerup', onUp);
    ML.on(pad, 'pointercancel', onUp);
    ML.on(puck, 'keydown', function (e) {
      var step = e.shiftKey ? 32 : 8, dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      setText(srcOut, '键盘' + (e.shiftKey ? ' Shift 4×' : ''));
      drive(px + dx, py + dy);
      setText(status, '方向键移动 ' + step + 'px · 位置 ' + Math.round(px) + ', ' + Math.round(py));
    });
    if (ML.observeSize) ML.observeSize(pad, function () {
      var b = bounds();
      px = clamp(px, 0, b.w);
      py = clamp(py, 0, b.h);
      writePuck();
    });
    writePuck();
    writeLag();
  }

  /* --------------------------------------------------------- 09 惯性滚动 */
  function bootInertia() {
    var view = q('#mp-iview'), track = q('#mp-itrack');
    var status = q('#mp-inertia-status'), meter = q('#mp-inertia-meter');
    var vOut = q('#mp-inertia-v'), v0Out = q('#mp-inertia-v0'), distOut = q('#mp-inertia-dist');
    var up = q('#mp-inertia-up'), down = q('#mp-inertia-down');
    if (!view || !track) return;
    var ITEM = 56, N = 14, i;
    for (i = 0; i < N; i++) {
      var li = d.createElement('li');
      li.className = 'mp-inertia__item';
      var idx = d.createElement('span');
      idx.className = 'mp-inertia__idx';
      idx.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
      var label = d.createElement('span');
      label.textContent = '条目 ' + (i + 1) + ' · 摩擦衰减 v ← v × 0.94^(60·dt)';
      li.appendChild(idx); li.appendChild(label);
      track.appendChild(li);
    }
    var y = 0, v = 0, drag = false, activeId = null, lastY = 0, lastT = 0, travelled = 0;
    var spring = null, un = null;

    function maxY() { return 0; }
    function minY() { return Math.min(0, (view.clientHeight || 260) - N * ITEM); }
    function indexOf(yy) { return Math.round(-yy / ITEM) + 1; }
    function nearestTarget(yy) { return clamp(Math.round(yy / ITEM) * ITEM, minY(), maxY()); }
    function place() { track.style.transform = 'translate3d(0,' + r1(y) + 'px,0)'; }
    function paintMeter() { if (meter) meter.style.transform = 'scaleX(' + r1(clamp(Math.abs(v) / 2600, 0, 1)) + ')'; }
    function paintReadout() {
      setText(vOut, Math.round(v) + ' px/s');
      setText(distOut, Math.round(Math.abs(travelled)) + ' px');
      paintMeter();
    }
    function stopAll() {
      if (un) { un(); un = null; }
      if (spring) { spring.stop(); spring = null; }
    }
    function snapTo(target, note) {
      stopAll();
      var from = y;
      if (reduced() || Math.abs(from - target) < 0.5) {
        y = target; place(); v = 0; paintReadout();
        setText(status, note + ' · 已定位第 ' + indexOf(target) + ' 项');
        return;
      }
      spring = createSpring({ onUpdate: function (val) { y = val; place(); } }, from, target, {
        preset: 'standard',
        onComplete: function () {
          y = target; place(); v = 0; paintReadout();
          spring = null;
          setText(status, note + ' · 已吸附第 ' + indexOf(target) + ' 项');
        }
      });
      setText(status, note + ' · 弹簧回弹中');
    }
    function inertia() {
      var last = nowMs();
      un = loop(function () {
        var now = nowMs();
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        v *= Math.pow(0.94, dt * 60);
        var dy = v * dt;
        y += dy;
        travelled += Math.abs(dy);
        place();
        paintReadout();
        if (y > maxY() || y < minY()) {
          un = null;
          v = 0;
          snapTo(nearestTarget(y), '触边界 · 橡皮筋回弹');
          return false;
        }
        if (Math.abs(v) < 8) {
          un = null;
          v = 0;
          snapTo(nearestTarget(y), '速度衰减到阈值以下');
          return false;
        }
        setText(status, '惯性滑行中 · v=' + Math.round(v) + ' px/s · 每帧 ×0.94^(60·dt)');
        return true;
      });
    }
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stopAll();
      drag = true;
      activeId = e.pointerId;
      if (view.setPointerCapture) cap(view, e.pointerId);
      lastY = e.clientY;
      lastT = nowMs();
      v = 0;
      travelled = 0;
      e.preventDefault();
    }
    function onMove(e) {
      if (!drag || (activeId !== null && e.pointerId !== activeId)) return;
      var now = nowMs();
      var dy = e.clientY - lastY;
      var dt = Math.max(1, now - lastT) / 1000;
      v = (dy / dt) * 0.85 + v * 0.15;
      lastY = e.clientY;
      lastT = now;
      y += dy;
      var top = maxY(), bottom = minY();
      if (y > top) y = top + (y - top) * 0.35;
      if (y < bottom) y = bottom + (y - bottom) * 0.35;
      travelled += Math.abs(dy);
      place();
      paintReadout();
      setText(status, '拖动中 · 越界位移 ×0.35（橡皮筋）');
    }
    function onUp() {
      if (!drag) return;
      drag = false;
      activeId = null;
      setText(v0Out, Math.round(v) + ' px/s');
      if (reduced() || Math.abs(v) < 40) {
        snapTo(nearestTarget(y), '降级/低速：直接定位');
        setText(status, '降级/低速 · 第 ' + indexOf(y) + ' 项（键盘与按钮同样可用）');
        return;
      }
      inertia();
    }
    ML.on(view, 'pointerdown', onDown);
    ML.on(view, 'pointermove', onMove);
    ML.on(view, 'pointerup', onUp);
    ML.on(view, 'pointercancel', onUp);
    ML.on(view, 'keydown', function (e) {
      var dir = 0;
      if (e.key === 'ArrowDown') dir = 1;
      else if (e.key === 'ArrowUp') dir = -1;
      else if (e.key === 'PageDown') dir = 3;
      else if (e.key === 'PageUp') dir = -3;
      else if (e.key === 'Home') { e.preventDefault(); snapTo(maxY(), 'Home'); return; }
      else if (e.key === 'End') { e.preventDefault(); snapTo(minY(), 'End'); return; }
      else return;
      e.preventDefault();
      var target = clamp((Math.round(y / ITEM) + dir) * ITEM, minY(), maxY());
      snapTo(target, '键盘');
    });
    if (up) ML.on(up, 'click', function () { view.focus(); snapTo(clamp((Math.round(y / ITEM) + 1) * ITEM, minY(), maxY()), '按钮'); });
    if (down) ML.on(down, 'click', function () { view.focus(); snapTo(clamp((Math.round(y / ITEM) - 1) * ITEM, minY(), maxY()), '按钮'); });
    place();
    paintReadout();
    setText(status, '拖动列表后松手；或聚焦列表用上下方向键');
  }

  /* -------------------------------------------------------- 10 抛掷与吸附 */
  function bootThrow() {
    var rail = q('#mp-throw-rail'), card = q('#mp-throw-card'), slots = q('#mp-slots');
    var status = q('#mp-throw-status'), vOut = q('#mp-throw-v'), projOut = q('#mp-throw-proj'), slotOut = q('#mp-throw-slot');
    if (!rail || !card || !slots) return;
    var SLOTS = 5, x = 12, v = 0, drag = false, activeId = null, lastX = 0, lastT = 0, spring = null;
    var slotEls = [], i;
    for (i = 0; i < SLOTS; i++) {
      var s = d.createElement('span');
      s.className = 'mp-slot';
      s.textContent = '#' + (i + 1);
      slots.appendChild(s);
      slotEls.push(s);
    }
    function travel() { return Math.max(80, (rail.clientWidth || 320) - 96 - 24); }
    function slotX(idx) { return 12 + (travel() / (SLOTS - 1)) * idx; }
    function maxX() { return travel() + 12; }
    function layoutSlots() {
      var w = rail.clientWidth || 320;
      slotEls.forEach(function (el, k) { el.style.left = ((slotX(k) + 48) / w * 100) + '%'; });
    }
    function place() { card.style.transform = 'translate3d(' + r1(x) + 'px,-50%,0)'; }
    function stopSpring() { if (spring) { spring.stop(); spring = null; } }
    function highlight(idx) { slotEls.forEach(function (el, k) { el.classList.toggle('is-hit', k === idx); }); }
    function currentIdx() { return clamp(Math.round((x - 12) / (travel() / (SLOTS - 1))), 0, SLOTS - 1); }
    function snapTo(idx) {
      highlight(idx);
      setText(slotOut, '#' + (idx + 1));
      if (reduced()) {
        x = slotX(idx); place();
        setText(status, '降级：直接跳到 #' + (idx + 1) + '（键盘 ←→ + Enter 同样可用）');
        return;
      }
      stopSpring();
      spring = createSpring({ onUpdate: function (val) { x = val; place(); } }, x, slotX(idx), {
        preset: 'standard',
        onComplete: function () { x = slotX(idx); place(); spring = null; setText(status, '已吸附到 #' + (idx + 1)); }
      });
    }
    function release() {
      var proj = v * 0.18;
      var projected = clamp(x + proj, 0, maxX());
      var idx = clamp(Math.round((projected - 12) / (travel() / (SLOTS - 1))), 0, SLOTS - 1);
      setText(vOut, Math.round(v) + ' px/s');
      setText(projOut, Math.round(proj) + ' px（v × 0.18s）');
      setText(status, '释放 v=' + Math.round(v) + ' px/s → 预测 ' + Math.round(projected) + 'px → 判定 #' + (idx + 1));
      snapTo(idx);
    }
    ML.on(card, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = true;
      activeId = e.pointerId;
      stopSpring();
      if (card.setPointerCapture) cap(card, e.pointerId);
      lastX = e.clientX;
      lastT = nowMs();
      v = 0;
      e.preventDefault();
    });
    ML.on(card, 'pointermove', function (e) {
      if (!drag || (activeId !== null && e.pointerId !== activeId)) return;
      var now = nowMs();
      var dx = e.clientX - lastX;
      var dt = Math.max(1, now - lastT) / 1000;
      v = (dx / dt) * 0.8 + v * 0.2;
      lastX = e.clientX;
      lastT = now;
      x += dx;
      if (x < 0) x = x * 0.35;
      if (x > maxX()) x = maxX() + (x - maxX()) * 0.35;
      place();
      setText(vOut, Math.round(v) + ' px/s');
      setText(status, '拖动中 · 松手按速度判定落点');
    });
    function endDrag() { if (drag) { drag = false; activeId = null; release(); } }
    ML.on(card, 'pointerup', endDrag);
    ML.on(card, 'pointercancel', endDrag);

    var keyT = [];
    ML.on(card, 'keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var now = nowMs();
        keyT.push(now);
        if (keyT.length > 3) keyT.shift();
        var idx = clamp(currentIdx() + (e.key === 'ArrowRight' ? 1 : -1), 0, SLOTS - 1);
        v = 0;
        snapTo(idx);
        setText(status, '键盘移动 → #' + (idx + 1) + '，Enter 以合成速度抛掷');
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var synth = 600;
        if (keyT.length >= 2) {
          var span = (keyT[keyT.length - 1] - keyT[0]) / 1000;
          if (span > 0.02) synth = clamp((travel() / (SLOTS - 1)) * (keyT.length - 1) / span, 120, 4000);
        }
        v = synth;
        release();
      }
    });
    if (ML.observeSize) ML.observeSize(rail, function () { layoutSlots(); x = slotX(currentIdx()); place(); });
    layoutSlots();
    place();
    highlight(0);
  }

  /* ------------------------------------------------------ 11 动效三档对比 */
  function bootLevels() {
    var wrap = q('#mp-levels-panels'), run = q('#mp-levels-run'), status = q('#mp-levels-status'), global = q('#mp-levels-global');
    if (!wrap) return;
    var MODES = [
      { id: 'on', label: 'on · 完整（transform 弹簧）' },
      { id: 'lite', label: 'lite · 精简（仅不透明度）' },
      { id: 'off', label: 'off · 关闭（瞬时）' }
    ];
    var panels = MODES.map(function (mode) {
      var box = d.createElement('div');
      box.className = 'mp-lv mp-lv--' + mode.id;
      var name = d.createElement('p');
      name.className = 'mp-lv__name';
      name.textContent = mode.label;
      var lane = d.createElement('div');
      lane.className = 'mp-lv__lane';
      var ball = d.createElement('span');
      ball.className = 'mp-lv__ball';
      lane.appendChild(ball);
      var ms = d.createElement('p');
      ms.className = 'mp-lv__ms';
      ms.textContent = '实测 —';
      box.appendChild(name); box.appendChild(lane); box.appendChild(ms);
      wrap.appendChild(box);
      return { mode: mode, lane: lane, ball: ball, ms: ms, spring: null, timer: 0 };
    });

    function fire() {
      panels.forEach(function (p) {
        if (p.spring) { p.spring.stop(); p.spring = null; }
        if (p.timer) { window.clearTimeout(p.timer); p.timer = 0; }
        var dist = Math.max(20, (p.lane.clientWidth || 180) - 22 - 12);
        var t0 = nowMs();
        var id = p.mode.id;
        if (id === 'off') {
          p.ball.style.transition = 'none';
          p.ball.style.transform = 'translate3d(' + dist + 'px,-50%,0)';
          p.ball.style.opacity = '1';
          setText(p.ms, '实测 0ms（瞬时切换）');
          return;
        }
        if (id === 'lite' || reduced()) {
          if (id === 'on') p.ball.style.transform = 'translate3d(0,-50%,0)';
          p.ball.style.transition = 'opacity var(--dur-base) var(--ease-in-out-quart), background var(--dur-base) var(--ease-in-out-quart)';
          p.ball.style.opacity = '0.25';
          void p.ball.offsetWidth;
          p.ball.style.opacity = '1';
          p.timer = window.setTimeout(function () {
            setText(p.ms, '实测 ' + Math.round(nowMs() - t0) + 'ms（仅不透明度' + (id === 'on' && reduced() ? ' · 全局降级' : '') + '）');
          }, Math.round(tokenMs('--dur-base', 240)));
          return;
        }
        p.ball.style.transition = 'none';
        p.ball.style.transform = 'translate3d(0,-50%,0)';
        p.ball.style.opacity = '1';
        p.spring = createSpring({
          onUpdate: function (val) { p.ball.style.transform = 'translate3d(' + r1(val) + 'px,-50%,0)'; }
        }, 0, dist, {
          preset: 'standard',
          onComplete: function () {
            setText(p.ms, '实测 ' + Math.round(nowMs() - t0) + 'ms（transform 弹簧）');
            p.spring = null;
          }
        });
      });
    }
    if (run) { run.appendChild(icon('zap', 16)); ML.on(run, 'click', fire); }
    if (global) ML.on(global, 'click', function () {
      fire();
      setText(status, '已按三档各自逻辑重播（不改动站点全局设置）');
    });
    function paintGlobal() {
      var m = ML.motion ? ML.motion.get() : 'on';
      var sys = ML.motion && ML.motion.isSystem ? ML.motion.isSystem() : false;
      setText(status, '全局动效档位：' + m + '（' + (sys ? '跟随系统' : '手动选择') + '）· 本 demo 的三个面板固定演示各自档位');
    }
    if (ML.motion && ML.motion.onChange) ML.motion.onChange(paintGlobal);
    paintGlobal();
  }

  /* -------------------------------------------------- 12 transform vs width */
  function bootPerf() {
    var good = q('#mp-bar-good'), bad = q('#mp-bar-bad'), run = q('#mp-perf-run'), status = q('#mp-perf-status');
    var gF = q('#mp-good-frames'), gA = q('#mp-good-avg'), gM = q('#mp-good-max'), gD = q('#mp-good-drop');
    var bF = q('#mp-bad-frames'), bA = q('#mp-bad-avg'), bM = q('#mp-bad-max'), bD = q('#mp-bad-drop');
    if (!good || !bad || !run) return;
    var PHASE = 1000;
    var ease = cubicBezier(0.76, 0, 0.24, 1);
    var easeCss = tokenEase('--ease-in-out-quart', 'cubic-bezier(.76,0,.24,1)');
    var un = null;

    function reset() {
      if (un) { un(); un = null; }
      good.style.transition = 'none';
      bad.style.transition = 'none';
      good.style.transform = 'translate3d(6px,-50%,0)';
      bad.style.left = '6px';
      bad.style.width = '56px';
      void good.offsetWidth;
    }
    function sample(ms, onFrame, onDone) {
      var frames = 0, sum = 0, worst = 0, drops = 0;
      var last = nowMs(), t0 = last;
      un = loop(function () {
        var now = nowMs();
        var dt = now - last;
        last = now;
        frames++; sum += dt;
        if (dt > worst) worst = dt;
        if (dt > 20) drops++;
        var p = clamp((now - t0) / ms, 0, 1);
        onFrame(p);
        if (p < 1) return true;
        un = null;
        onDone({ frames: frames, avg: frames ? sum / frames : 0, worst: worst, drops: drops });
        return false;
      });
    }
    function runIt() {
      reset();
      var laneW = Math.max(140, (good.parentNode ? good.parentNode.clientWidth : 320) - 12);
      var dist = Math.max(40, laneW - 68);
      setText(status, '采样中：transform 侧 1.0s …');
      sample(PHASE, function (p) {
        good.style.transform = 'translate3d(' + r1(6 + dist * ease(p)) + 'px,-50%,0)';
      }, function (s) {
        setText(gF, String(s.frames));
        setText(gA, r1(s.avg) + 'ms');
        setText(gM, r1(s.worst) + 'ms');
        setText(gD, String(s.drops));
        if (reduced()) {
          setText(bF, '—'); setText(bA, '降级未运行'); setText(bM, '—'); setText(bD, '—');
          setText(status, 'transform 侧 ' + s.frames + ' 帧 / 平均 ' + r1(s.avg) + 'ms / 最差 ' + r1(s.worst) + 'ms · 降级：未运行 left+width 反模式');
          return;
        }
        setText(status, '采样中：left + width 侧 1.0s …（会触发布局重算）');
        bad.style.transition = 'width ' + PHASE + 'ms ' + easeCss;
        void bad.offsetWidth;
        bad.style.width = (56 + dist) + 'px';
        sample(PHASE, function () { }, function (s2) {
          setText(bF, String(s2.frames));
          setText(bA, r1(s2.avg) + 'ms');
          setText(bM, r1(s2.worst) + 'ms');
          setText(bD, String(s2.drops));
          setText(status, '每侧各采样 1.0s · transform：' + s.frames + ' 帧 / 平均 ' + r1(s.avg) + 'ms / 最差 ' + r1(s.worst) +
            'ms → left+width：' + s2.frames + ' 帧 / 平均 ' + r1(s2.avg) + 'ms / 最差 ' + r1(s2.worst) +
            'ms（反模式，仅本 demo 对照用）');
        });
      });
    }
    if (run) { run.appendChild(icon('play', 16)); ML.on(run, 'click', runIt); }
    reset();
    setText(status, '等待运行 · 每侧采样 1000ms，共 2000ms');
  }

  function boot() {
    if (!window.ML) return;
    var list = [bootTuner, bootOvershoot, bootInterrupt, bootEasing, bootDurations, bootExit, bootStagger, bootFollow, bootInertia, bootThrow, bootLevels, bootPerf];
    list.forEach(function (fn) { try { fn(); } catch (err) { /* 单个 demo 失败不阻塞其它 */ } });
  }

  d.addEventListener('ml:ready', boot, { once: true });
})();
