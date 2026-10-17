/* ============================================================
   展厅 K · 数据可视化 — 页面脚本
   全部 SVG 手写，无任何图表库；数据内联且确定性可复现。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 0. 内核适配层 ---------- */
  var MLx = window.ML || {};
  function q(sel, root) {
    if (typeof MLx.q === 'function') return MLx.q(sel, root);
    return (root || document).querySelector(sel);
  }
  function qa(sel, root) {
    if (typeof MLx.qa === 'function') return MLx.qa(sel, root);
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function on(t, type, fn, opts) {
    if (typeof MLx.on === 'function') return MLx.on(t, type, fn, opts);
    if (t && t.addEventListener) t.addEventListener(type, fn, opts);
    return function () {};
  }
  function motionMode() {
    if (MLx.motion && typeof MLx.motion.get === 'function') return MLx.motion.get();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'lite';
    return 'on';
  }
  function reduced() {
    if (typeof MLx.reduced === 'boolean') return MLx.reduced;
    return motionMode() !== 'on';
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    return e;
  }

  /* ---------- 1. 弹簧驱动（优先内核，缺失时退化为 rAF 缓出） ---------- */
  function drive(from, to, preset, onUpdate, onDone) {
    if (MLx.spring && typeof MLx.spring === 'function') {
      var finished = false;
      function done() { if (!finished) { finished = true; if (onDone) onDone(); } }
      var h = MLx.spring({
        onUpdate: function (v) { onUpdate(v); },
        onComplete: done
      }, from, to, { preset: preset || 'standard', onComplete: done });
      if (h && typeof h.stop === 'function') return h;
      return { stop: function () {} };
    }
    var t0 = null, dur = 640, id = 0;
    id = window.requestAnimationFrame(function step(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp((ts - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 5);
      onUpdate(lerp(from, to, e));
      if (p < 1) id = window.requestAnimationFrame(step);
      else if (onDone) onDone();
    });
    return { stop: function () { window.cancelAnimationFrame(id); } };
  }

  /* ---------- 2. 数据层：确定性伪随机 + 真实聚合 ---------- */
  var VIZ = window.__ML_VIZ__ || {};
  var SERIES = VIZ.series || [{ key: 's1', name: '系列一', color: 'var(--accent)', dash: 'none', marker: 'circle' }];
  var AREA_SERIES = VIZ.areaSeries || SERIES.slice(1, 3);

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  var DAILY = (function () {
    var rnd = mulberry32(VIZ.seed || 1);
    var n = VIZ.days || 365;
    var out = { dates: [], labels: [], series: { direct: [], search: [], referral: [] } };
    var t0 = Date.UTC(2024, 0, 1);
    for (var i = 0; i < n; i++) {
      var d = new Date(t0 + i * 86400000);
      var dow = d.getUTCDay();
      var weekend = (dow === 0 || dow === 6) ? 0.78 : 1;
      var t = i / n;
      var direct = (2950 + 520 * Math.sin(i / 58 * Math.PI * 2) + 1400 * t + (rnd() - 0.5) * 260) * weekend;
      var search = (1850 + 700 * Math.sin(i / 41 * Math.PI * 2 + 1.1) + 1500 * t + (rnd() - 0.5) * 220) * weekend;
      var spike = rnd() > 0.94 ? 1.9 : 1;
      var referral = (760 + 300 * Math.sin(i / 23 * Math.PI * 2 + 2.4) + 360 * t + (rnd() - 0.5) * 180) * spike;
      out.dates.push(d);
      out.labels.push(pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()));
      out.series.direct.push(Math.round(direct));
      out.series.search.push(Math.round(search));
      out.series.referral.push(Math.round(referral));
    }
    return out;
  })();

  function aggregate(daily, grain) {
    var keys = Object.keys(daily.series);
    var groups = [];
    if (grain === 'month') {
      var seen = {};
      daily.dates.forEach(function (d, i) {
        var k = d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1);
        if (!seen[k]) { seen[k] = { label: k, idx: [] }; groups.push(seen[k]); }
        seen[k].idx.push(i);
      });
    } else if (grain === 'week') {
      for (var i = 0; i < daily.dates.length; i += 7) {
        var chunk = [];
        for (var j = i; j < Math.min(i + 7, daily.dates.length); j++) chunk.push(j);
        groups.push({ label: daily.labels[chunk[0]] + ' 起', idx: chunk });
      }
    } else {
      daily.dates.forEach(function (d, i) { groups.push({ label: daily.labels[i], idx: [i] }); });
    }

    var out = { grain: grain, labels: [], avg: {}, sum: {}, count: groups.length };
    keys.forEach(function (k) { out.avg[k] = []; out.sum[k] = []; });
    groups.forEach(function (g) {
      out.labels.push(g.label);
      keys.forEach(function (k) {
        var total = 0;
        g.idx.forEach(function (i) { total += daily.series[k][i]; });
        out.sum[k].push(total);
        out.avg[k].push(total / g.idx.length);
      });
    });
    return out;
  }

  function syntheticSeries(n, seed, base, amp, drift) {
    var rnd = mulberry32(seed);
    var arr = [];
    for (var i = 0; i < n; i++) {
      arr.push(base + amp * Math.sin(i / 37 * Math.PI * 2) + drift * (i / n) + (rnd() - 0.5) * amp * 0.5 + (rnd() > 0.97 ? amp * 1.6 : 0));
    }
    return arr;
  }
  function bucketize(arr, target) {
    var size = Math.max(1, Math.ceil(arr.length / target));
    var out = [], sums = [], counts = [];
    for (var i = 0; i < arr.length; i += size) {
      var slice = arr.slice(i, i + size);
      var s = slice.reduce(function (a, b) { return a + b; }, 0);
      sums.push(s); counts.push(slice.length);
      out.push(s / slice.length);
    }
    return { values: out, sums: sums, counts: counts, bucketSize: size, buckets: out.length };
  }
  function maxDeviation(raw, bucketed) {
    var worst = 0;
    raw.forEach(function (v, i) {
      var b = bucketed.values[Math.floor(i / bucketed.bucketSize)];
      worst = Math.max(worst, Math.abs(v - b));
    });
    return worst;
  }

  /* ---------- 3. 数值与坐标工具 ---------- */
  function fmtShort(v) {
    var a = Math.abs(v);
    if (a >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (a >= 10000) return Math.round(v / 1000) + 'k';
    if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
    return String(Math.round(v * 10) / 10);
  }
  function fmtFull(v) {
    var r = Math.round(v * 10) / 10;
    return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function niceTicks(min, max, count) {
    if (max === min) { max = min + 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var start = Math.ceil(min / step) * step;
    var out = [];
    for (var v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  }
  function profileOf(w) {
    if (w < 520) return { W: 400, H: 270, pad: { t: 20, r: 12, b: 38, l: 48 }, fs: 13, xLabels: 4 };
    return { W: 760, H: 300, pad: { t: 24, r: 18, b: 38, l: 56 }, fs: 12, xLabels: 7 };
  }
  function polyline(pts) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join(' ');
  }

  /* ---------- 4. 实时播报 ---------- */
  var live = null;
  function announce(msg) {
    if (!live) {
      live = mk('div', 'visually-hidden');
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    live.textContent = '';
    window.setTimeout(function () { live.textContent = msg; }, 30);
  }

  /* ---------- 5. 每图进入视口后绘制 ---------- */
  function whenVisible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.disconnect(); cb(); }
      });
    }, { threshold: 0.25 });
    io.observe(el);
  }

  /* ============================================================
     6. 图表实例
     ============================================================ */
  function Chart(root) {
    var inst = {
      root: root,
      kind: root.getAttribute('data-chart'),
      svg: q('[data-svg]', root),
      plot: q('[data-plot]', root),
      tip: q('[data-tip]', root),
      legendHost: q('[data-legend]', root),
      tableWrap: q('[data-tablewrap]', root),
      tableBtn: q('[data-table-toggle]', root),
      note: q('[data-chart-note]', root),
      stat: q('[data-stat]', root),
      hidden: {},
      active: -1,
      hit: [],
      marks: [],
      activeLayer: null,
      lastW: 0,
      rendered: false
    };
    if (inst.tableBtn && inst.tableWrap) {
      var id = 'dv-tbl-' + inst.kind;
      inst.tableWrap.id = id;
      inst.tableBtn.setAttribute('aria-controls', id);
    }
    return inst;
  }

  function setNote(inst, text) { if (inst.note) inst.note.textContent = text; }

  function buildLegend(inst, list) {
    if (!inst.legendHost) return;
    inst.legendHost.textContent = '';
    list.forEach(function (s) {
      var b = mk('button', 'dv-legend__item');
      b.type = 'button';
      b.setAttribute('aria-pressed', inst.hidden[s.key] ? 'false' : 'true');
      var mark = sv('svg', { class: 'dv-legend__mark', viewBox: '0 0 26 14', 'aria-hidden': 'true' });
      mark.appendChild(sv('line', { x1: 1, y1: 7, x2: 25, y2: 7, stroke: s.color, 'stroke-dasharray': s.dash === 'none' ? '' : s.dash, 'stroke-linecap': s.dash === '2 5' ? 'round' : 'butt' }));
      if (s.marker === 'circle') mark.appendChild(sv('circle', { cx: 13, cy: 7, r: 3, fill: s.color }));
      if (s.marker === 'square') mark.appendChild(sv('rect', { x: 10, y: 4, width: 6, height: 6, fill: s.color }));
      if (s.marker === 'triangle') mark.appendChild(sv('polygon', { points: '13,3.4 16.6,10.6 9.4,10.6', fill: s.color }));
      b.appendChild(mark);
      b.appendChild(mk('span', null, s.name));
      on(b, 'click', function () {
        inst.hidden[s.key] = !inst.hidden[s.key];
        render(inst, false, true);
        b.focus();
      });
      inst.legendHost.appendChild(b);
    });
  }

  function markerFor(s, x, y, cls) {
    var size = 3.2;
    if (s.marker === 'square') return sv('rect', { class: cls, x: x - size, y: y - size, width: size * 2, height: size * 2, fill: s.color });
    if (s.marker === 'triangle') return sv('polygon', { class: cls, points: (x) + ',' + (y - size * 1.3) + ' ' + (x + size * 1.25) + ',' + (y + size) + ' ' + (x - size * 1.25) + ',' + (y + size), fill: s.color });
    return sv('circle', { class: cls, cx: x, cy: y, r: size, fill: s.color });
  }

  function buildTable(inst, caption, headers, rows, note) {
    if (!inst.tableWrap) return;
    inst.tableWrap.textContent = '';
    var t = mk('table', 'dv-table');
    if (inst.tableWrap.id) t.id = inst.tableWrap.id + '-t';
    var cap = mk('caption', null, caption);
    t.appendChild(cap);
    var thead = mk('thead'), tr = mk('tr');
    headers.forEach(function (h) { var th = mk('th', null, h); th.setAttribute('scope', 'col'); tr.appendChild(th); });
    thead.appendChild(tr); t.appendChild(thead);
    var tbody = mk('tbody');
    rows.forEach(function (r) {
      var row = mk('tr');
      var th = mk('th', null, r[0]);
      th.setAttribute('scope', 'row');
      row.appendChild(th);
      r.slice(1).forEach(function (c) { row.appendChild(mk('td', null, c)); });
      tbody.appendChild(row);
    });
    t.appendChild(tbody);
    inst.tableWrap.appendChild(t);
    if (note) inst.tableWrap.appendChild(mk('p', 'a11y-note', note));
  }

  var MAX_ROWS = 120;
  function rowsNote(total) {
    return total > MAX_ROWS
      ? '表中共 ' + total + ' 行，为保证滚动与读屏性能此处渲染前 ' + MAX_ROWS + ' 行；完整数据可由同一份内联数组重算得到。'
      : '表中为全部 ' + total + ' 行数据。';
  }

  /* ---------- 6.1 tooltip 与键盘 ---------- */
  function positionTip(inst, h) {
    if (!inst.tip) return;
    var r = inst.svg.getBoundingClientRect();
    var vb = inst.svg.viewBox.baseVal;
    if (!vb || !vb.width) return;
    var kx = r.width / vb.width, ky = r.height / vb.height;
    var left = clamp(h.x * kx, 90, Math.max(90, r.width - 90));
    var top = clamp(h.y * ky, 0, r.height);
    inst.tip.style.left = left + 'px';
    inst.tip.style.top = top + 'px';
  }

  function activeLayer(inst) {
    if (!inst.activeLayer || !inst.activeLayer.parentNode) {
      inst.activeLayer = sv('g', { class: 'dv-active-layer' });
      inst.svg.appendChild(inst.activeLayer);
    }
    return inst.activeLayer;
  }

  function showTip(inst, i) {
    if (i < 0 || i >= inst.hit.length) { hideTip(inst); return; }
    inst.active = i;
    var h = inst.hit[i];
    if (!inst.tip) return;
    inst.tip.textContent = '';
    inst.tip.appendChild(mk('p', 'dv-tip__title', h.title));
    var visible = h.rows.filter(function (r) { return !inst.hidden[r.key]; });
    visible.forEach(function (r) {
      var row = mk('div', 'dv-tip__row');
      var dot = mk('i');
      dot.style.setProperty('background', r.color);
      row.appendChild(dot);
      row.appendChild(mk('span', null, r.name));
      row.appendChild(mk('span', 'dv-tip__val', r.text));
      inst.tip.appendChild(row);
    });
    if (h.tip) inst.tip.appendChild(mk('p', 'dv-tip__tip', h.tip));
    inst.tip.hidden = false;

    var layer = activeLayer(inst);
    layer.textContent = '';
    if (h.kind === 'crosshair') {
      layer.appendChild(sv('line', { class: 'dv-crosshair', x1: h.x, y1: h.top, x2: h.x, y2: h.bottom }));
      visible.forEach(function (r) {
        if (r.y == null) return;
        layer.appendChild(sv('circle', { class: 'dv-active', cx: h.x, cy: r.y, r: 5 }));
      });
    } else if (h.kind === 'cell') {
      layer.appendChild(sv('rect', { class: 'dv-active', x: h.x - h.w / 2, y: h.y - h.h / 2, width: h.w, height: h.h, fill: 'none' }));
    } else if (h.kind === 'bar') {
      layer.appendChild(sv('rect', { class: 'dv-active', x: h.x - h.w / 2, y: h.y, width: h.w, height: h.h, fill: 'none' }));
    } else if (h.kind === 'point') {
      layer.appendChild(sv('circle', { class: 'dv-active', cx: h.x, cy: h.y, r: 6 }));
    }
    positionTip(inst, h);

    var summary = h.title + '：' + visible.map(function (r) { return r.name + ' ' + r.text; }).join('，');
    inst.svg.setAttribute('aria-label', summary);
    announce(summary);
  }

  function hideTip(inst) {
    inst.active = -1;
    if (inst.tip) inst.tip.hidden = true;
    if (inst.activeLayer) inst.activeLayer.textContent = '';
    if (inst.baseLabel) inst.svg.setAttribute('aria-label', inst.baseLabel);
  }

  function bindKeyboard(inst) {
    if (!inst.svg) return;
    inst.baseLabel = inst.svg.getAttribute('aria-label') || '';
    on(inst.svg, 'keydown', function (e) {
      if (!inst.hit.length) return;
      var i = inst.active < 0 ? -1 : inst.active;
      var stepY = inst.stepY || 1;
      var n = inst.hit.length;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        showTip(inst, (i + 1 + n) % n);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        showTip(inst, (i + stepY + n) % n);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        showTip(inst, i <= 0 ? n - 1 : i - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        showTip(inst, i - stepY < 0 ? (i - stepY + n * 2) % n : i - stepY);
      } else if (e.key === 'Home') {
        e.preventDefault(); showTip(inst, 0);
      } else if (e.key === 'End') {
        e.preventDefault(); showTip(inst, n - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault(); hideTip(inst);
      }
    });
    on(inst.svg, 'blur', function () { hideTip(inst); });
  }

  /* ---------- 6.2 绘制动画 ---------- */
  function applyDraw(item, v) {
    if (item.type === 'clip') {
      item.el.setAttribute('width', String(Math.max(0.01, item.w * v)));
    } else if (item.type === 'bar') {
      var base = item.base;
      item.el.setAttribute('transform', 'translate(0,' + base + ') scale(1,' + Math.max(0.0001, v) + ') translate(0,' + (-base) + ')');
    } else if (item.type === 'dash') {
      item.el.setAttribute('stroke-dashoffset', String(item.len * (1 - v)));
    } else if (item.type === 'opacity') {
      item.el.setAttribute('opacity', String(item.from + (1 - item.from) * v));
    } else if (item.type === 'sweep') {
      item.el.setAttribute('stroke-dasharray', String(item.len * v) + ' ' + item.circ);
    }
  }

  function runDraw(inst) {
    var items = inst.marks;
    if (!items.length) return;
    if (reduced()) {
      items.forEach(function (it) { applyDraw(it, 1); });
      return;
    }
    var spread = 0.6;
    if (inst.handle && typeof inst.handle.stop === 'function') inst.handle.stop();
    inst.handle = drive(0, 1, inst.preset || 'standard', function (v) {
      var t = v * (1 + spread);
      items.forEach(function (it) {
        applyDraw(it, clamp((t - (it.delay || 0)) / 1, 0, 1));
      });
    });
  }

  /* ============================================================
     7. 各类图表渲染
     ============================================================ */
  var GRAIN = { current: 'day' };
  var grainData = { day: null };
  function dataFor(grain) {
    if (!grainData[grain]) grainData[grain] = aggregate(DAILY, grain);
    return grainData[grain];
  }

  function axisY(g, P, min, max, plotH, plotW) {
    niceTicks(min, max, 4).forEach(function (t) {
      var y = P.pad.t + plotH - (t - min) / (max - min) * plotH;
      if (y < P.pad.t - 1 || y > P.pad.t + plotH + 1) return;
      g.appendChild(sv('line', { class: 'dv-grid', x1: P.pad.l, y1: y, x2: P.pad.l + plotW, y2: y }));
      var tx = sv('text', { class: 'dv-tick', x: P.pad.l - 8, y: y + 4, 'text-anchor': 'end' });
      tx.textContent = fmtShort(t);
      g.appendChild(tx);
    });
  }

  function axisX(g, P, labels, xOf, plotH) {
    var step = Math.max(1, Math.ceil(labels.length / P.xLabels));
    labels.forEach(function (lb, i) {
      if (i % step !== 0 && i !== labels.length - 1) return;
      var tx = sv('text', { class: 'dv-tick', x: xOf(i), y: P.pad.t + plotH + 20, 'text-anchor': 'middle' });
      tx.textContent = lb;
      g.appendChild(tx);
    });
  }

  function boundsOf(data, keys, hidden) {
    var min = Infinity, max = -Infinity;
    keys.forEach(function (k) {
      if (hidden[k]) return;
      data.avg[k].forEach(function (v) { if (v < min) min = v; if (v > max) max = v; });
    });
    if (!isFinite(min)) { min = 0; max = 1; }
    var padY = (max - min) * 0.12 || 1;
    return { min: Math.max(0, min - padY), max: max + padY };
  }

  function renderLine(inst, list, isArea) {
    var data = dataFor(GRAIN.current);
    var P = profileOf(inst.plot.clientWidth || 700);
    var labels = data.labels;
    var plotW = P.W - P.pad.l - P.pad.r;
    var plotH = P.H - P.pad.t - P.pad.b;
    var keys = list.map(function (s) { return s.key; }).filter(function (k) { return !inst.hidden[k]; });
    var b = boundsOf(data, keys.length ? keys : list.map(function (s) { return s.key; }), inst.hidden);
    var min = b.min, max = b.max;
    var n = labels.length;
    function xOf(i) { return P.pad.l + (n === 1 ? plotW / 2 : i * plotW / (n - 1)); }
    function yOf(v) { return P.pad.t + plotH - (v - min) / (max - min) * plotH; }

    inst.svg.setAttribute('viewBox', '0 0 ' + P.W + ' ' + P.H);
    inst.svg.textContent = '';
    inst.marks = [];
    inst.hit = [];
    inst.active = -1;
    inst.activeLayer = null;

    var gRoot = sv('g', { 'font-size': P.fs });
    inst.svg.appendChild(gRoot);

    axisY(gRoot, P, min, max, plotH, plotW);
    axisX(gRoot, P, labels, xOf, plotH);
    gRoot.appendChild(sv('line', { class: 'dv-axis', x1: P.pad.l, y1: P.pad.t + plotH, x2: P.pad.l + plotW, y2: P.pad.t + plotH }));
    gRoot.appendChild(sv('line', { class: 'dv-axis', x1: P.pad.l, y1: P.pad.t, x2: P.pad.l, y2: P.pad.t + plotH }));

    var clipId = 'dv-clip-' + inst.kind;
    var defs = sv('defs');
    var clip = sv('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    var clipRect = sv('rect', { x: P.pad.l - 3, y: P.pad.t - 16, width: 1, height: plotH + 32 });
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    inst.svg.appendChild(defs);
    inst.marks.push({ type: 'clip', el: clipRect, w: plotW + 6, delay: 0 });

    var layer = sv('g', { 'clip-path': 'url(#' + clipId + ')' });
    gRoot.appendChild(layer);

    var visible = list.filter(function (s) { return !inst.hidden[s.key]; });
    visible.forEach(function (s, si) {
      var pts = data.avg[s.key].map(function (v, i) { return [xOf(i), yOf(v)]; });
      if (isArea) {
        var baseY = P.pad.t + plotH;
        var dArea = polyline(pts) + ' L' + pts[pts.length - 1][0].toFixed(2) + ' ' + baseY + ' L' + pts[0][0].toFixed(2) + ' ' + baseY + ' Z';
        var area = sv('path', { class: 'dv-area', d: dArea, fill: s.color, 'fill-opacity': 0, opacity: 0 });
        layer.appendChild(area);
        inst.marks.push({ type: 'opacity', el: area, from: 0, delay: 0.05 * si });
        area.setAttribute('fill-opacity', '0.2');
      }
      var path = sv('path', { class: 'dv-series', d: polyline(pts), stroke: s.color, 'stroke-dasharray': s.dash === 'none' ? '' : s.dash });
      layer.appendChild(path);
      if (n <= 40) {
        pts.forEach(function (p, i) {
          if (i % Math.max(1, Math.ceil(n / 24)) !== 0 && i !== n - 1) return;
          layer.appendChild(markerFor(s, p[0], p[1], 'dv-marker'));
        });
      }
    });

    /* 直接标注：首个可见系列的最新值 */
    if (visible.length) {
      var s0 = visible[0];
      var lastX = xOf(n - 1), lastY = yOf(data.avg[s0.key][n - 1]);
      var pill = sv('g', { opacity: 0 });
      var anchor = lastX > P.pad.l + plotW - 70 ? 'end' : 'start';
      var px = anchor === 'end' ? lastX - 10 : lastX + 8;
      var label = sv('text', { class: 'dv-label--value', x: px, y: lastY - 10, 'text-anchor': anchor });
      label.textContent = fmtShort(data.avg[s0.key][n - 1]);
      pill.appendChild(label);
      gRoot.appendChild(pill);
      inst.marks.push({ type: 'opacity', el: pill, from: 0, delay: 0.8 });
    }

    /* hit 数据：每个 x 一个点，含所有可见系列 */
    labels.forEach(function (lb, i) {
      var rows = visible.map(function (s) {
        return {
          key: s.key, name: s.name, color: s.color,
          y: yOf(data.avg[s.key][i]),
          text: fmtShort(data.avg[s.key][i]) + '（合计 ' + fmtShort(data.sum[s.key][i]) + '）'
        };
      });
      inst.hit.push({
        kind: 'crosshair', x: xOf(i), y: yOf(data.avg[visible[0] ? visible[0].key : list[0].key][i]),
        top: P.pad.t, bottom: P.pad.t + plotH,
        title: (GRAIN.current === 'day' ? '2024-' : '') + lb,
        rows: rows,
        tip: GRAIN.current === 'day' ? '单位：千次请求／日' : '单位：千次请求／日均，括号内为区间合计'
      });
    });

    if (inst.stat) inst.stat.textContent = fmtFull(data.avg[visible[0] ? visible[0].key : list[0].key][n - 1]);
    setNote(inst, '粒度 ' + GRAIN.current + ' · ' + n + ' 个数据点 · ' + visible.length + '/' + list.length + ' 系列可见');

    /* 数据表替代 */
    var headers = ['时间', '直接访问（日均）', '搜索（日均）', '推荐（日均）'];
    var rows = labels.slice(0, MAX_ROWS).map(function (lb, i) {
      return [lb, fmtFull(data.avg.direct[i]), fmtFull(data.avg.search[i]), fmtFull(data.avg.referral[i])];
    });
    buildTable(inst, '折线图数据表：' + GRAIN.current + ' 粒度，共 ' + n + ' 行', headers, rows, rowsNote(n));
  }

  function renderBar(inst, opts) {
    var cfg = opts || {};
    var items = (cfg.items || []).slice();
    if (inst.sortDesc !== false) items.sort(function (a, b) { return b.value - a.value; });
    var P = profileOf(inst.plot.clientWidth || 700);
    var plotW = P.W - P.pad.l - P.pad.r;
    var plotH = P.H - P.pad.t - P.pad.b;
    var max = Math.max.apply(null, items.map(function (d) { return d.value; })) * 1.12;

    inst.svg.setAttribute('viewBox', '0 0 ' + P.W + ' ' + P.H);
    inst.svg.textContent = '';
    inst.marks = [];
    inst.hit = [];
    inst.active = -1;
    inst.activeLayer = null;

    var g = sv('g', { 'font-size': P.fs });
    inst.svg.appendChild(g);
    var baseY = P.pad.t + plotH;
    axisY(g, P, 0, max, plotH, plotW);
    g.appendChild(sv('line', { class: 'dv-axis', x1: P.pad.l, y1: baseY, x2: P.pad.l + plotW, y2: baseY }));

    var slot = plotW / items.length;
    var bw = Math.min(56, slot * 0.58);
    items.forEach(function (d, i) {
      var x = P.pad.l + slot * (i + 0.5);
      var h = (d.value / max) * plotH;
      var rect = sv('rect', { class: 'dv-bar', x: x - bw / 2, y: baseY - h, width: bw, height: h, rx: 4, fill: cfg.color || 'var(--accent)' });
      g.appendChild(rect);
      inst.marks.push({ type: 'bar', el: rect, base: baseY, delay: i * 0.05 });

      var val = sv('text', { class: 'dv-label--value', x: x, y: baseY - h - 8, 'text-anchor': 'middle', opacity: 0 });
      val.textContent = fmtShort(d.value);
      g.appendChild(val);
      inst.marks.push({ type: 'opacity', el: val, from: 0, delay: 0.5 + i * 0.03 });

      var lb = sv('text', { class: 'dv-tick', x: x, y: baseY + 20, 'text-anchor': 'middle' });
      lb.textContent = d.label;
      g.appendChild(lb);

      inst.hit.push({
        kind: 'bar', x: x, y: baseY - h, w: bw, h: h,
        title: d.label,
        rows: [{ key: 'v', name: cfg.valueName || '数值', color: cfg.color || 'var(--accent)', text: fmtFull(d.value), y: null }],
        tip: d.tip || ''
      });
    });

    if (inst.stat) inst.stat.textContent = fmtFull(items[0].value);
    setNote(inst, items.length + ' 个分类 · ' + (inst.sortDesc !== false ? '按数值降序' : '原顺序'));
    buildTable(inst, (cfg.caption || '柱状图数据表') + '（' + items.length + ' 行）',
      ['分类', cfg.valueName || '数值'],
      items.map(function (d) { return [d.label, fmtFull(d.value)]; }),
      '表中为全部 ' + items.length + ' 行，点击表头以外的排序按钮可切换排序方式。');
  }

  function renderStacked(inst, cfg) {
    var quarters = cfg.quarters, parts = cfg.parts;
    var visible = parts.filter(function (p) { return !inst.hidden[p.key]; });
    var P = profileOf(inst.plot.clientWidth || 700);
    var plotW = P.W - P.pad.l - P.pad.r;
    var plotH = P.H - P.pad.t - P.pad.b;

    inst.svg.setAttribute('viewBox', '0 0 ' + P.W + ' ' + P.H);
    inst.svg.textContent = '';
    inst.marks = [];
    inst.hit = [];
    inst.active = -1;
    inst.activeLayer = null;

    var g = sv('g', { 'font-size': P.fs });
    inst.svg.appendChild(g);
    var baseY = P.pad.t + plotH;

    niceTicks(0, 100, 4).forEach(function (t) {
      var y = baseY - (t / 100) * plotH;
      g.appendChild(sv('line', { class: 'dv-grid', x1: P.pad.l, y1: y, x2: P.pad.l + plotW, y2: y }));
      var tx = sv('text', { class: 'dv-tick', x: P.pad.l - 8, y: y + 4, 'text-anchor': 'end' });
      tx.textContent = t + '%';
      g.appendChild(tx);
    });
    g.appendChild(sv('line', { class: 'dv-axis', x1: P.pad.l, y1: baseY, x2: P.pad.l + plotW, y2: baseY }));

    var slot = plotW / quarters.length;
    var bw = Math.min(64, slot * 0.54);

    quarters.forEach(function (qn, qi) {
      var base = 0;
      var x = P.pad.l + slot * (qi + 0.5);
      var rows = [];
      visible.forEach(function (p, pi) {
        var share = p.values[qi];
        var h = (share / 100) * plotH;
        var y = baseY - (base + share) / 100 * plotH;
        var rect = sv('rect', {
          class: 'dv-bar', x: x - bw / 2, y: y, width: bw, height: h,
          fill: p.color, fillOpacity: 0.92
        });
        rect.setAttribute('data-seg', p.key);
        g.appendChild(rect);
        /* 段落内部实现 scaleY：以该段自身下沿为原点 */
        rect.setAttribute('transform', 'translate(0,' + (y + h) + ') scale(1,0.0001) translate(0,' + (-(y + h)) + ')');
        inst.marks.push({ type: 'bar', el: rect, base: y + h, delay: qi * 0.06 + pi * 0.04 });

        if (share >= 10) {
          var t = sv('text', { class: 'dv-label--value', x: x, y: y + h / 2 + 4, 'text-anchor': 'middle', opacity: 0 });
          t.textContent = Math.round(share) + '%';
          g.appendChild(t);
          inst.marks.push({ type: 'opacity', el: t, from: 0, delay: 0.5 + qi * 0.03 });
        }
        rows.push({ key: p.key, name: p.name, color: p.color, text: share.toFixed(1) + '%', y: y + h / 2 });
        base += share;
      });
      var ql = sv('text', { class: 'dv-tick', x: x, y: baseY + 20, 'text-anchor': 'middle' });
      ql.textContent = qn.label;
      g.appendChild(ql);

      inst.hit.push({
        kind: 'bar', x: x, y: P.pad.t, w: bw, h: plotH, title: qn.label + '（合计 ' + fmtFull(qn.total) + '）',
        rows: rows, tip: '数值为构成占比（%），合计恒为 100%'
      });
    });

    setNote(inst, quarters.length + ' 个季度 · ' + visible.length + '/' + parts.length + ' 个构成项可见');
    buildTable(inst, '100% 堆叠柱数据表（占比 %，括号内为绝对值）',
      ['季度', '基础设施', '服务器', '可观测', '人工'],
      quarters.map(function (qn, qi) {
        return [qn.label + '（合计 ' + fmtFull(qn.total) + '）'].concat(parts.map(function (p) {
          return p.values[qi].toFixed(1) + '%（' + fmtFull(p.abs[qi]) + '）';
        }));
      }),
      '表中为全部 ' + quarters.length + ' 行。');
  }

  function renderDonut(inst, cfg, asStack) {
    var parts = cfg.parts.slice().sort(function (a, b) { return b.value - a.value; });
    var total = parts.reduce(function (a, b) { return a + b.value; }, 0);
    inst.hit = [];
    inst.active = -1;
    inst.activeLayer = null;
    inst.svg.textContent = '';
    inst.marks = [];

    if (asStack) {
      /* 替代视图：100% 堆叠柱（环形图的强制兜底） */
      inst.svg.setAttribute('viewBox', '0 0 400 300');
      var g2 = sv('g', { 'font-size': 13 });
      inst.svg.appendChild(g2);
      var x0 = 40, w = 320, h = 64, y0 = 110;
      var acc = 0;
      parts.forEach(function (p, i) {
        var share = p.value / total * 100;
        var x = x0 + acc / 100 * w;
        var sw = share / 100 * w;
        var rect = sv('rect', { x: x, y: y0, width: sw, height: h, fill: p.color, rx: 2 });
        g2.appendChild(rect);
        /* 用 clip 宽度做属性插值：水平揭示 */
        rect.setAttribute('width', '0.1');
        inst.marks.push({ type: 'clip', el: rect, w: sw, delay: i * 0.06 });
        if (share >= 8) {
          var t = sv('text', { class: 'dv-label--value', x: x + sw / 2, y: y0 + h / 2 + 5, 'text-anchor': 'middle', opacity: 0 });
          t.textContent = share.toFixed(0) + '%';
          g2.appendChild(t);
          inst.marks.push({ type: 'opacity', el: t, from: 0, delay: 0.5 + i * 0.03 });
        }
        acc += share;
        inst.hit.push({
          kind: 'bar', x: x + sw / 2, y: y0, w: sw, h: h, title: p.name,
          rows: [{ key: p.key, name: p.name, color: p.color, text: share.toFixed(1) + '%（' + fmtFull(p.value) + '）', y: null }],
          tip: '替代视图：100% 堆叠柱，与环形图同源同值'
        });
      });
      var cap = sv('text', { class: 'dv-label', 'text-anchor': 'middle', x: 200, y: 84 });
      cap.textContent = '100% 堆叠柱替代视图（环形图的无障碍兜底）';
      g2.appendChild(cap);
      var cap2 = sv('text', { class: 'dv-tick', 'text-anchor': 'middle', x: 200, y: 208 });
      cap2.textContent = '总和 = ' + fmtFull(total) + '　·　最大扇区已在左侧按 12 点方向起排';
      g2.appendChild(cap2);
      setNote(inst, '替代视图已启用');
      buildDonutTable(inst, parts, total);
      return;
    }

    inst.svg.setAttribute('viewBox', '0 0 360 300');
    var g = sv('g', { 'font-size': 12 });
    inst.svg.appendChild(g);
    var cx = 180, cy = 148, r = 100, sw = 34;
    var circ = 2 * Math.PI * r;
    g.appendChild(sv('circle', { class: 'dv-donut-track', cx: cx, cy: cy, r: r, 'stroke-width': sw }));

    var acc = 0;
    parts.forEach(function (p, i) {
      var share = p.value / total;
      var len = share * circ;
      var arc = sv('circle', {
        class: 'dv-donut-seg', cx: cx, cy: cy, r: r, stroke: p.color, 'stroke-width': sw,
        'stroke-dasharray': '0 ' + circ, 'stroke-dashoffset': String(-acc * circ),
        transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
      });
      g.appendChild(arc);
      inst.marks.push({ type: 'sweep', el: arc, len: len, circ: circ, delay: i * 0.07 });

      var mid = acc + share / 2;
      var ang = mid * Math.PI * 2 - Math.PI / 2;
      var lx = cx + Math.cos(ang) * (r + sw / 2 + 14);
      var ly = cy + Math.sin(ang) * (r + sw / 2 + 14);
      var anchor = Math.cos(ang) > 0.15 ? 'start' : (Math.cos(ang) < -0.15 ? 'end' : 'middle');
      var t = sv('text', { class: 'dv-label--value', x: lx, y: ly + 4, 'text-anchor': anchor, opacity: 0 });
      t.textContent = (share * 100).toFixed(1) + '%';
      g.appendChild(t);
      inst.marks.push({ type: 'opacity', el: t, from: 0, delay: 0.55 + i * 0.04 });

      inst.hit.push({
        kind: 'point', x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, title: p.name,
        rows: [{ key: p.key, name: p.name, color: p.color, text: (share * 100).toFixed(1) + '%（' + fmtFull(p.value) + '）', y: null }],
        tip: '最大扇区自 12 点方向起排；百分比已直接标注'
      });
      acc += share;
    });

    var t1 = sv('text', { class: 'dv-label', x: cx, y: cy - 6, 'text-anchor': 'middle' });
    t1.textContent = fmtShort(total);
    t1.setAttribute('font-size', '22');
    g.appendChild(t1);
    var t2 = sv('text', { class: 'dv-tick', x: cx, y: cy + 16, 'text-anchor': 'middle' });
    t2.textContent = '总请求（千次）';
    g.appendChild(t2);

    setNote(inst, parts.length + ' 个扇区 · 最大扇区自 12 点方向起排');
    buildDonutTable(inst, parts, total);
  }

  function buildDonutTable(inst, parts, total) {
    buildTable(inst, '环形图数据表：占比与绝对值（' + parts.length + ' 行，按占比降序）',
      ['渠道', '请求量（千次）', '占比'],
      parts.map(function (p) { return [p.name, fmtFull(p.value), (p.value / total * 100).toFixed(1) + '%']; }),
      '环形图在无障碍评级中为 C 级，因此本页强制提供：① 100% 堆叠柱替代视图 ② 本百分比数据表 ③ 每片直接标注。');
  }

  function renderHeatmap(inst, cfg) {
    var rows = cfg.rows, cols = cfg.cols, value = cfg.value;
    var P = profileOf(inst.plot.clientWidth || 700);
    var padL = P.W < 520 ? 40 : 52;
    var padT = 24, padB = 34, padR = 12;
    var plotW = P.W - padL - padR;
    var plotH = P.H - padT - padB;
    var cw = plotW / cols, ch = plotH / rows;
    var max = 0, min = Infinity;
    for (var ri = 0; ri < rows; ri++) for (var ci = 0; ci < cols; ci++) {
      var v = value(ri, ci);
      if (v > max) max = v;
      if (v < min) min = v;
    }

    inst.svg.setAttribute('viewBox', '0 0 ' + P.W + ' ' + P.H);
    inst.svg.textContent = '';
    inst.marks = [];
    inst.hit = [];
    inst.active = -1;
    inst.activeLayer = null;
    var g = sv('g', { 'font-size': P.fs });
    inst.svg.appendChild(g);

    for (var r = 0; r < rows; r++) {
      var ly = sv('text', { class: 'dv-tick', x: padL - 8, y: padT + ch * r + ch / 2 + 4, 'text-anchor': 'end' });
      ly.textContent = cfg.rowLabels[r];
      g.appendChild(ly);
    }
    var step = P.W < 520 ? 6 : 3;
    for (var c = 0; c < cols; c += step) {
      var lx = sv('text', { class: 'dv-tick', x: padL + cw * c + cw / 2, y: padT + plotH + 20, 'text-anchor': 'middle' });
      lx.textContent = String(c).padStart(2, '0');
      g.appendChild(lx);
    }

    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        var vv = value(r2, c2);
        var t = max === min ? 0 : (vv - min) / (max - min);
        var rect = sv('rect', {
          class: 'dv-cell', x: padL + cw * c2 + 1, y: padT + ch * r2 + 1,
          width: Math.max(1, cw - 2), height: Math.max(1, ch - 2),
          rx: 2, fill: 'var(--accent)', opacity: 0
        });
        rect.setAttribute('fill-opacity', String(0.1 + t * 0.85));
        g.appendChild(rect);
        inst.marks.push({ type: 'opacity', el: rect, from: 0, delay: clamp((r2 * cols + c2) / (rows * cols) * 0.5, 0, 0.5) });
        inst.hit.push({
          kind: 'cell', x: padL + cw * c2 + cw / 2, y: padT + ch * r2 + ch / 2, w: cw - 2, h: ch - 2,
          title: cfg.rowLabels[r2] + ' ' + String(c2).padStart(2, '0') + ':00',
          rows: [{ key: 'v', name: '请求强度', color: 'var(--accent)', text: fmtFull(vv) + ' 相对单位', y: null }],
          tip: '亮度编码 ' + Math.round(0.1 * 100) + '%–' + '95%：极值已在图上直接标注'
        });
      }
    }

    /* 极值直接在图上标注 */
    var ext = [];
    for (var r3 = 0; r3 < rows; r3++) for (var c3 = 0; c3 < cols; c3++) ext.push({ r: r3, c: c3, v: value(r3, c3) });
    ext.sort(function (a, b) { return b.v - a.v; });
    [ext[0], ext[ext.length - 1]].forEach(function (e, i) {
      var tx = sv('text', { class: 'dv-label--value', x: padL + cw * e.c + cw / 2, y: padT + ch * e.r - 6, 'text-anchor': 'middle', opacity: 0 });
      tx.textContent = (i === 0 ? '峰值 ' : '谷值 ') + fmtShort(e.v);
      g.appendChild(tx);
      inst.marks.push({ type: 'opacity', el: tx, from: 0, delay: 0.7 });
    });

    var legendY = padT + plotH + 30;
    var steps = 5;
    for (var si = 0; si < steps; si++) {
      g.appendChild(sv('rect', {
        x: padL + si * 22, y: legendY, width: 20, height: 8, rx: 2,
        fill: 'var(--accent)', 'fill-opacity': String(0.1 + (si / (steps - 1)) * 0.85)
      }));
    }
    var lgTxt = sv('text', { class: 'dv-tick', x: padL + steps * 22 + 8, y: legendY + 8 });
    lgTxt.textContent = '低 ' + fmtShort(min) + ' → 高 ' + fmtShort(max);
    g.appendChild(lgTxt);

    setNote(inst, rows * cols + ' 个格子 · 亮度 ' + fmtShort(min) + '–' + fmtShort(max));
    inst.stepY = cols;
    buildTable(inst, '热力图数据表：' + rows + ' 行 × ' + cols + ' 列，共 ' + rows * cols + ' 格（此处按行汇总）',
      ['星期'].concat(cfg.hourHeaders),
      cfg.rowLabels.map(function (rl, ri) {
        return [rl].concat(cfg.hourHeaders.map(function (h, ci) { return fmtShort(value(ri, ci)); }));
      }),
      '完整 ' + (rows * cols) + ' 格数据在同一张表中逐格给出；键盘方向键可在图上两维移动读取。');
  }

  function renderRing(inst, value, len) {
    var cx = 150, cy = 150, r = 104, sw = 26;
    var circ = 2 * Math.PI * r;
    inst.svg.setAttribute('viewBox', '0 0 300 300');
    inst.svg.textContent = '';
    inst.marks = [];
    inst.hit = [];
    inst.active = -1;
    inst.activeLayer = null;
    var g = sv('g', { 'font-size': 13 });
    inst.svg.appendChild(g);
    g.appendChild(sv('circle', { class: 'dv-ring-track', cx: cx, cy: cy, r: r, 'stroke-width': sw }));

    var arcLen = circ * (value / 100);
    var seg = sv('circle', {
      class: 'dv-ring-seg', cx: cx, cy: cy, r: r, 'stroke-width': sw,
      'stroke-dasharray': '0 ' + circ, 'stroke-dashoffset': '0',
      transform: 'rotate(-90 ' + cx + ' ' + cy + ')'
    });
    g.appendChild(seg);
    inst.marks.push({ type: 'sweep', el: seg, len: arcLen, circ: circ, delay: 0 });

    var t1 = sv('text', { class: 'dv-label', x: cx, y: cy + 2, 'text-anchor': 'middle', 'font-size': '40' });
    t1.textContent = Math.round(value) + '%';
    g.appendChild(t1);
    var t2 = sv('text', { class: 'dv-tick', x: cx, y: cy + 26, 'text-anchor': 'middle' });
    t2.textContent = '本季度交付完成度';
    g.appendChild(t2);

    inst.hit.push({
      kind: 'point', x: cx, y: cy, title: '完成度',
      rows: [{ key: 'v', name: '已完成', color: 'var(--accent)', text: Math.round(value) + '%', y: null }],
      tip: '同一数值同时以 role="progressbar" 暴露给读屏软件'
    });
    setNote(inst, (len || '') + '');
    inst._value = value;
    inst._seg = seg;
    inst._circ = circ;
  }

  function renderGauge(inst, value) {
    var x0 = 24, x1 = 296, y0 = 186, r = 136;
    var L = Math.PI * r;
    inst.svg.setAttribute('viewBox', '0 0 320 220');
    inst.svg.textContent = '';
    inst.marks = [];
    inst.hit = [];
    inst.active = -1;
    inst.activeLayer = null;
    var g = sv('g', { 'font-size': 12 });
    inst.svg.appendChild(g);

    var d = 'M' + x0 + ' ' + y0 + ' A' + r + ' ' + r + ' 0 0 1 ' + x1 + ' ' + y0;
    g.appendChild(sv('path', { class: 'dv-gauge-track', d: d, 'stroke-width': 22 }));

    var zones = [
      { from: 0, to: 40, color: 'var(--danger)', name: '低' },
      { from: 40, to: 75, color: 'var(--warning)', name: '中' },
      { from: 75, to: 100, color: 'var(--success)', name: '高' }
    ];
    zones.forEach(function (z) {
      var segLen = L * (z.to - z.from) / 100;
      g.appendChild(sv('path', {
        class: 'dv-gauge-zones', d: d, 'stroke-width': 22, stroke: z.color, 'stroke-opacity': 0.35,
        'stroke-dasharray': segLen + ' ' + L, 'stroke-dashoffset': String(-L * z.from / 100)
      }));
      var midT = (z.from + z.to) / 2 / 100;
      var ang = Math.PI - Math.PI * midT;
      var lx = 160 + Math.cos(ang) * (r + 22);
      var ly = y0 - Math.sin(ang) * (r + 22);
      var t = sv('text', { class: 'dv-tick', x: lx, y: ly + 4, 'text-anchor': 'middle' });
      t.textContent = z.name + ' ' + z.from + '–' + z.to;
      g.appendChild(t);
    });

    var progLen = L * value / 100;
    var prog = sv('path', {
      class: 'dv-ring-seg', d: d, 'stroke-width': 10, stroke: 'var(--accent)',
      'stroke-dasharray': '0 ' + L, 'stroke-linecap': 'round'
    });
    g.appendChild(prog);
    inst.marks.push({ type: 'sweep', el: prog, len: progLen, circ: L, delay: 0 });

    var ang2 = Math.PI - Math.PI * (value / 100);
    var nx = 160 + Math.cos(ang2) * (r - 26);
    var ny = y0 - Math.sin(ang2) * (r - 26);
    var needle = sv('line', { class: 'dv-needle', x1: 160, y1: y0, x2: nx, y2: ny });
    g.appendChild(needle);
    inst.marks.push({ type: 'opacity', el: needle, from: 0, delay: 0.4 });
    g.appendChild(sv('circle', { class: 'dv-needle-hub', cx: 160, cy: y0, r: 6 }));

    var tv = sv('text', { class: 'dv-gauge-value dv-label', x: 160, y: y0 - 26, 'text-anchor': 'middle', 'font-size': '34' });
    tv.textContent = Math.round(value);
    g.appendChild(tv);
    var tl = sv('text', { class: 'dv-gauge-zone-label dv-tick', x: 160, y: y0 - 6, 'text-anchor': 'middle' });
    tl.textContent = value < 40 ? '低区间' : value < 75 ? '中区间' : '高区间';
    g.appendChild(tl);

    inst.hit.push({
      kind: 'point', x: 160, y: y0 - 40, title: '健康度评分',
      rows: [{ key: 'v', name: '评分', color: 'var(--accent)', text: String(Math.round(value)) + ' / 100', y: null }],
      tip: '区间含义以文字标注：0–39 低、40–74 中、75–100 高'
    });
    setNote(inst, '当前 ' + Math.round(value) + ' · ' + (value < 40 ? '低' : value < 75 ? '中' : '高') + '区间');
  }

  function renderSparkline(host, cfg) {
    host.textContent = '';
    var marks = [];
    cfg.items.forEach(function (item, idx) {
      var card = mk('div', 'dv-spark');
      var head = mk('div', 'dv-spark__head');
      head.appendChild(mk('p', 'dv-spark__name', item.name));
      var val = mk('span', 'dv-spark__val', fmtFull(item.values[item.values.length - 1]));
      head.appendChild(val);
      card.appendChild(head);

      var first = item.values[0], last = item.values[item.values.length - 1];
      var delta = first === 0 ? 0 : (last - first) / first * 100;
      var dcls = delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';
      var deltaEl = mk('span', 'dv-spark__delta dv-spark__delta--' + dcls);
      deltaEl.appendChild(mk('span', null, delta > 1 ? '上升' : delta < -1 ? '下降' : '持平'));
      deltaEl.appendChild(mk('span', 'tnum', (delta > 0 ? '+' : '') + delta.toFixed(1) + '%'));
      card.appendChild(deltaEl);

      var W = 260, H = 48, pad = 4;
      var svg = sv('svg', { class: 'dv-spark__svg', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', role: 'img', 'aria-label': item.name + '：从 ' + fmtFull(first) + ' 到 ' + fmtFull(last) + '，' + (delta > 1 ? '上升' : delta < -1 ? '下降' : '持平') + ' ' + Math.abs(delta).toFixed(1) + '%' });
      var mn = Math.min.apply(null, item.values), mx = Math.max.apply(null, item.values);
      var pts = item.values.map(function (v, i) {
        return [pad + i * (W - pad * 2) / (item.values.length - 1), H - pad - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * (H - pad * 2)];
      });
      var path = sv('path', { class: 'dv-series', d: polyline(pts), stroke: item.color, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
      svg.appendChild(path);
      svg.appendChild(sv('circle', { class: 'dv-spark-dot', cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 3, fill: item.color }));
      var pathLen = pts.reduce(function (a, p, i) {
        if (!i) return 0;
        var dx = p[0] - pts[i - 1][0], dy = p[1] - pts[i - 1][1];
        return a + Math.sqrt(dx * dx + dy * dy);
      }, 0);
      path.setAttribute('stroke-dasharray', String(pathLen));
      path.setAttribute('stroke-dashoffset', String(pathLen));
      marks.push({ type: 'dash', el: path, len: pathLen, delay: idx * 0.12 });
      card.appendChild(svg);
      card.appendChild(mk('p', 'a11y-note', item.note));
      host.appendChild(card);
    });
    if (reduced()) marks.forEach(function (m) { applyDraw(m, 1); });
    else drive(0, 1, 'standard', function (v) {
      marks.forEach(function (m) { applyDraw(m, clamp((v - m.delay) / 0.8, 0, 1)); });
    });
  }

  /* ============================================================
     8. 各 demo 装配
     ============================================================ */
  var charts = [];

  var BAR_DATA = [
    { label: '直接', value: 4280 }, { label: '搜索', value: 3910 }, { label: '推荐', value: 2140 },
    { label: '邮件', value: 1620 }, { label: '社交', value: 1180 }, { label: '广告', value: 940 },
    { label: '其他', value: 410 }
  ];

  var STACK_PARTS = [
    { key: 'base', name: '基础设施', color: 'var(--accent)', values: [38, 34, 31, 29, 26, 24], abs: [1210, 1265, 1300, 1330, 1395, 1420] },
    { key: 'srv', name: '服务器', color: 'var(--info)', values: [27, 29, 30, 31, 32, 33], abs: [860, 1080, 1258, 1420, 1717, 1953] },
    { key: 'obs', name: '可观测', color: 'var(--success)', values: [21, 23, 25, 26, 28, 29], abs: [669, 856, 1048, 1192, 1502, 1716] },
    { key: 'ops', name: '人工', color: 'var(--warning)', values: [14, 14, 14, 14, 14, 14], abs: [446, 521, 587, 642, 751, 829] }
  ];
  var STACK_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q1′', 'Q2′'].map(function (l, i) {
    var total = STACK_PARTS.reduce(function (a, p) { return a + p.abs[i]; }, 0);
    return { label: l, total: total };
  });

  var DONUT_PARTS = [
    { key: 'direct', name: '直接访问', color: 'var(--accent)', value: 4280 },
    { key: 'search', name: '搜索', color: 'var(--info)', value: 3910 },
    { key: 'referral', name: '推荐', color: 'var(--success)', value: 2140 },
    { key: 'mail', name: '邮件', color: 'var(--warning)', value: 1620 },
    { key: 'other', name: '其他', color: 'var(--danger)', value: 1050 }
  ];

  var HEAT_ROWS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var HEAT_COLS = 24;
  var HEAT = (function () {
    var rnd = mulberry32(77);
    var m = [];
    for (var r = 0; r < 7; r++) {
      var row = [];
      for (var c = 0; c < 24; c++) {
        var work = r < 5 ? 1 : 0.55;
        var peak = Math.exp(-Math.pow(c - 10.5, 2) / 26) + Math.exp(-Math.pow(c - 15.5, 2) / 20) * 0.85;
        row.push(Math.round((30 + 220 * peak * work + rnd() * 26) * 10) / 10);
      }
      m.push(row);
    }
    return m;
  })();

  function render(inst, silent, keepFocus) {
    if (!inst.svg || !inst.plot) return;
    var w = inst.plot.clientWidth || 700;
    inst.lastW = w;
    if (inst.kind === 'line' || inst.kind === 'area') renderLine(inst, inst.kind === 'line' ? SERIES : AREA_SERIES, inst.kind === 'area');
    else if (inst.kind === 'bar') renderBar(inst, { items: BAR_DATA, valueName: '请求量（千次）', caption: '柱状图数据表', color: 'var(--accent)' });
    else if (inst.kind === 'stacked') renderStacked(inst, { quarters: STACK_QUARTERS, parts: STACK_PARTS });
    else if (inst.kind === 'donut') renderDonut(inst, { parts: DONUT_PARTS }, inst.altView === true);
    else if (inst.kind === 'heatmap') renderHeatmap(inst, { rows: 7, cols: HEAT_COLS, rowLabels: HEAT_ROWS, hourHeaders: Array.apply(null, Array(HEAT_COLS)).map(function (_, i) { return String(i).padStart(2, '0'); }), value: function (r, c) { return HEAT[r][c]; } });
    inst.rendered = true;
    if (silent) {
      inst.marks.forEach(function (it) { applyDraw(it, 1); });
    } else {
      runDraw(inst);
    }
    if (!keepFocus) hideTip(inst);
  }

  var CHART_PRESET = {
    line: 'standard',
    area: 'soft',
    bar: 'snap',
    stacked: 'standard',
    donut: 'playful',
    heatmap: 'standard'
  };

  function initCharts() {
    qa('[data-chart]').forEach(function (root) {
      var kind = root.getAttribute('data-chart');
      if (kind === 'sparkline' || kind === 'aggregate' || kind === 'ring' || kind === 'gauge') return;
      var inst = Chart(root);
      inst.preset = CHART_PRESET[kind] || 'standard';
      charts.push(inst);
      bindKeyboard(inst);
      render(inst, true);
      whenVisible(root, function () { render(inst, false); });
      var obs = function () {
        var w = inst.plot.clientWidth || 0;
        if (Math.abs(w - inst.lastW) > 40) render(inst, true, true);
      };
      if (MLx.observeSize) MLx.observeSize(inst.plot, obs);
      else if ('ResizeObserver' in window) new ResizeObserver(obs).observe(inst.plot);

      if (inst.tableBtn && inst.tableWrap) {
        on(inst.tableBtn, 'click', function () {
          var open = inst.tableWrap.hidden;
          inst.tableWrap.hidden = !open;
          inst.tableBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          inst.tableBtn.textContent = open ? '收起数据表' : '查看数据表';
        });
      }
    });

    /* 图例 */
    charts.forEach(function (inst) {
      if (inst.kind === 'line') buildLegend(inst, SERIES);
      if (inst.kind === 'area') buildLegend(inst, AREA_SERIES);
      if (inst.kind === 'stacked') buildLegend(inst, STACK_PARTS);
      if (inst.kind === 'donut') buildLegend(inst, DONUT_PARTS.map(function (p) { return { key: p.key, name: p.name, color: p.color, dash: 'none', marker: 'circle' }; }));
    });

    /* 环形图替代视图 */
    var donut = charts.filter(function (c) { return c.kind === 'donut'; })[0];
    var altBtn = q('[data-donut-alt]');
    if (donut && altBtn) {
      on(altBtn, 'click', function () {
        donut.altView = !donut.altView;
        altBtn.setAttribute('aria-pressed', donut.altView ? 'true' : 'false');
        altBtn.textContent = donut.altView ? '返回环形视图' : '替代视图：100% 堆叠柱';
        render(donut, false);
        altBtn.focus();
      });
    }

    /* 柱状排序 */
    var bar = charts.filter(function (c) { return c.kind === 'bar'; })[0];
    var sortBtn = q('[data-bar-sort]');
    if (bar && sortBtn) {
      on(sortBtn, 'click', function () {
        bar.sortDesc = bar.sortDesc === false;
        sortBtn.setAttribute('aria-pressed', bar.sortDesc ? 'true' : 'false');
        sortBtn.textContent = bar.sortDesc ? '按数值降序' : '回到原始顺序';
        render(bar, false);
        sortBtn.focus();
      });
    }
  }

  /* ---------- 粒度切换 ---------- */
  function initGrain() {
    var group = q('#dv-grain'), note = q('#dv-grain-note');
    if (!group) return;
    var btns = qa('[data-grain]', group);
    function select(g, focus) {
      GRAIN.current = g;
      btns.forEach(function (b) {
        var sel = b.getAttribute('data-grain') === g;
        b.setAttribute('aria-checked', sel ? 'true' : 'false');
        if (sel && focus) b.focus();
      });
      var data = dataFor(g);
      if (note) {
        note.textContent = '当前粒度：' + (g === 'day' ? '日（365 点）' : g === 'week' ? '周（53 点）' : '月（12 点）') +
          '。聚合方式为桶内日均值（合计值见各图数据表），因此坐标轴量级在切换时保持可比。桶数：' + data.count + '。';
      }
      charts.forEach(function (inst) {
        if (inst.kind === 'line' || inst.kind === 'area') render(inst, false);
      });
      announce('粒度已切换为' + (g === 'day' ? '日' : g === 'week' ? '周' : '月') + '，数据点 ' + data.count + ' 个');
    }
    btns.forEach(function (b, i) {
      on(b, 'click', function () { select(b.getAttribute('data-grain'), false); });
      on(b, 'keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var next = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
        select(btns[next].getAttribute('data-grain'), true);
      });
    });
  }

  /* ---------- Sparkline ---------- */
  function initSparks() {
    var host = q('#chart-spark');
    if (!host) return;
    var items = [
      { name: '构建时长', values: syntheticSeries(24, 11, 180, 26, -40), color: 'var(--accent)', note: '单位：秒 · 24 次构建，末值相比首次下降明显' },
      { name: '首屏 LCP', values: syntheticSeries(24, 22, 1.9, 0.34, -0.5).map(function (v) { return Math.round(v * 100) / 100; }), color: 'var(--info)', note: '单位：秒 · 越低越好，注意 sparkline 无法表达"指标方向"' },
      { name: '错误率', values: syntheticSeries(24, 33, 0.42, 0.16, 0.22).map(function (v) { return Math.round(v * 1000) / 1000; }), color: 'var(--danger)', note: '单位：% · 末值上升，用符号 + 文字 + 颜色三重编码' }
    ];
    renderSparkline(host, { items: items });
    if (MLx.observeSize) MLx.observeSize(host, function () {});
  }

  /* ---------- 进度环 ---------- */
  function initRing() {
    var root = q('#chart-ring');
    if (!root) return;
    var inst = Chart(root);
    inst.kind = 'ring';
    var input = q('#ring-input'), valueEl = q('#ring-value'), bar = q('#ring-bar'), status = q('#ring-status'), barRole = q('.dv-progress');
    function apply(v, animate) {
      if (animate && !reduced()) {
        drive(inst._value == null ? 0 : inst._value, v, 'snap', function (x) { paint(x); });
      } else {
        paint(v);
      }
      inst._value = v;
      if (valueEl) valueEl.textContent = Math.round(v) + '%';
      if (bar) bar.style.setProperty('--dv-value', String(v / 100));
      if (barRole) barRole.setAttribute('aria-valuenow', String(Math.round(v)));
      if (status) status.textContent = Math.round(v) + ' / 100 · 剩余 ' + (100 - Math.round(v)) + ' 项。';
    }
    function paint(v) {
      var circ = 2 * Math.PI * 104;
      if (inst._seg) {
        inst._seg.setAttribute('stroke-dasharray', (circ * v / 100) + ' ' + circ);
      }
      var t1 = q('text', inst.svg);
      if (t1 && t1.getAttribute('font-size') === '40') t1.textContent = Math.round(v) + '%';
    }
    renderRing(inst, 73, '73 / 100');
    bindKeyboard(inst);
    whenVisible(root, function () {
      if (reduced()) { paint(73); return; }
      var circ = 2 * Math.PI * 104;
      if (inst._seg) inst._seg.setAttribute('stroke-dasharray', '0 ' + circ);
      drive(0, 73, 'snap', function (v) { paint(v); });
    });
    if (input) on(input, 'input', function () { apply(parseFloat(input.value), false); });
    apply(73, false);
  }

  /* ---------- 仪表盘 ---------- */
  function initGauge() {
    var root = q('#chart-gauge');
    if (!root) return;
    var inst = Chart(root);
    inst.kind = 'gauge';
    var input = q('#gauge-input'), valueEl = q('#gauge-value'), status = q('#gauge-status');
    renderGauge(inst, 82);
    bindKeyboard(inst);
    function update(v, animate) {
      if (animate && !reduced()) drive(inst._v == null ? 0 : inst._v, v, 'standard', function (x) { repaint(x); });
      else repaint(v);
      inst._v = v;
      if (valueEl) valueEl.textContent = String(Math.round(v));
      if (status) status.textContent = '当前 ' + Math.round(v) + '：' + (v < 40 ? '低' : v < 75 ? '中' : '高') + '区间（' + (v < 40 ? '需要干预' : v < 75 ? '观察' : '健康') + '）。';
    }
    function repaint(v) {
      var L = Math.PI * 136;
      var prog = q('.dv-ring-seg', inst.svg);
      if (prog) prog.setAttribute('stroke-dasharray', (L * v / 100) + ' ' + L);
      var ang = Math.PI - Math.PI * (v / 100);
      var nx = 160 + Math.cos(ang) * (136 - 26);
      var ny = 186 - Math.sin(ang) * (136 - 26);
      var needle = q('.dv-needle', inst.svg);
      if (needle) { needle.setAttribute('x2', nx); needle.setAttribute('y2', ny); }
      var tv = q('.dv-gauge-value', inst.svg);
      if (tv) tv.textContent = String(Math.round(v));
      var tl = q('.dv-gauge-zone-label', inst.svg);
      if (tl) tl.textContent = v < 40 ? '低区间' : v < 75 ? '中区间' : '高区间';
    }
    whenVisible(root, function () { update(82, true); });
    if (input) on(input, 'input', function () { update(parseFloat(input.value), false); });
    update(82, false);
  }

  /* ---------- 三态 ---------- */
  function initStates() {
    var box = q('#dv-statebox'), status = q('#dv-state-status'), group = q('#dv-statedemo'), replay = q('#dv-state-replay');
    if (!box) return;
    var panels = qa('[data-state-panel]', box);
    var btns = group ? qa('[data-state]', group) : [];
    var timers = [];

    /* 正常态里放一个真实图表：迷你柱状 */
    var readyHost = q('#dv-state-ready-chart');
    if (readyHost) {
      var W = 640, H = 180, pad = { t: 20, r: 12, b: 30, l: 44 };
      var s = sv('svg', { class: 'dv-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '迷你柱状图：七个渠道请求量', style: 'max-height:200px' });
      var g = sv('g', { 'font-size': 12 });
      s.appendChild(g);
      var max = Math.max.apply(null, BAR_DATA.map(function (d) { return d.value; })) * 1.15;
      var plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
      var baseY = pad.t + plotH;
      niceTicks(0, max, 3).forEach(function (t) {
        var y = baseY - t / max * plotH;
        g.appendChild(sv('line', { class: 'dv-grid', x1: pad.l, y1: y, x2: pad.l + plotW, y2: y }));
        var tx = sv('text', { class: 'dv-tick', x: pad.l - 8, y: y + 4, 'text-anchor': 'end' });
        tx.textContent = fmtShort(t);
        g.appendChild(tx);
      });
      var slot = plotW / BAR_DATA.length;
      BAR_DATA.forEach(function (d, i) {
        var h = d.value / max * plotH;
        var x = pad.l + slot * (i + 0.5);
        g.appendChild(sv('rect', { class: 'dv-bar', x: x - 18, y: baseY - h, width: 36, height: h, rx: 3 }));
        var lb = sv('text', { class: 'dv-tick', x: x, y: baseY + 18, 'text-anchor': 'middle' });
        lb.textContent = d.label;
        g.appendChild(lb);
      });
      g.appendChild(sv('line', { class: 'dv-axis', x1: pad.l, y1: baseY, x2: pad.l + plotW, y2: baseY }));
      readyHost.appendChild(s);
    }

    function show(name) {
      timers.forEach(function (t) { window.clearTimeout(t); });
      timers = [];
      panels.forEach(function (p) {
        var active = p.getAttribute('data-state-panel') === name;
        p.hidden = !active;
        p.classList.remove('dv-state--fade');
        if (active && !reduced()) {
          void p.offsetWidth;
          p.classList.add('dv-state--fade');
        }
      });
      btns.forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-state') === name ? 'true' : 'false'); });
      if (name === 'loading') {
        box.setAttribute('aria-busy', 'true');
        if (status) status.textContent = '当前状态：加载中（aria-busy="true"，骨架与最终图表同高）。';
        timers.push(window.setTimeout(function () { show('ready'); }, 1200));
      } else {
        box.setAttribute('aria-busy', 'false');
        if (status) {
          status.textContent = name === 'empty'
            ? '当前状态：空。已确认不是加载失败，并给出两条可执行的下一步。'
            : name === 'error'
              ? '当前状态：错误。保留上一份成功快照，提供重试 / 快照 / 帮助三条路径。'
              : '当前状态：正常。图表与数据表入口同时可用。';
        }
      }
      announce('图表状态切换为：' + (name === 'empty' ? '空状态' : name === 'loading' ? '加载中' : name === 'error' ? '错误' : '正常'));
    }

    btns.forEach(function (b) {
      on(b, 'click', function () { show(b.getAttribute('data-state')); });
    });
    if (replay) on(replay, 'click', function () {
      var cur = btns.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; })[0];
      show(cur ? cur.getAttribute('data-state') : 'error');
    });
    qa('[data-error-action]').forEach(function (b) {
      on(b, 'click', function () {
        var a = b.getAttribute('data-error-action');
        if (status) {
          status.textContent = a === 'retry'
            ? '已发起第 3 次重试（退避 1600ms）…'
            : a === 'snapshot'
              ? '正在显示 2024-11-08 03:12 的成功快照，并明确标注"数据时间为过去"。'
              : '503 表示服务暂时不可用，通常是上游依赖过载；重试前应先看退避曲线。';
        }
        announce(status ? status.textContent : '');
      });
    });
    qa('[data-empty-action]').forEach(function (b) {
      on(b, 'click', function () {
        var a = b.getAttribute('data-empty-action');
        if (status) status.textContent = a === 'range'
          ? '时间范围已扩大到 12 个月，重新查询中…（若仍为空，说明该区间确实没有采集）'
          : '已创建采集规则，首个数据点将在约 5 分钟后出现。';
        announce(status ? status.textContent : '');
      });
    });
    show('error');
  }

  /* ---------- 大数聚合 ---------- */
  function initAggregate() {
    var root = q('#chart-agg');
    if (!root) return;
    var inst = Chart(root);
    inst.kind = 'aggregate';
    var gen = q('#dv-agg-gen'), toggle = q('#dv-agg-toggle'), note = q('#dv-agg-note');
    var raw = null, bucketed = null, showAgg = false;
    bindKeyboard(inst);

    function compute() {
      raw = syntheticSeries(1200, 909, 420, 130, 90);
      bucketed = bucketize(raw, (VIZ.thresholds && VIZ.thresholds.bucketTarget) || 60);
      inst.dev = maxDeviation(raw, bucketed);
    }

    function paint(mode) {
      var W = 760, H = 260, pad = { t: 24, r: 18, b: 30, l: 56 };
      var P = profileOf(inst.plot.clientWidth || 700);
      inst.svg.setAttribute('viewBox', '0 0 ' + P.W + ' ' + P.H);
      inst.svg.textContent = '';
      inst.marks = [];
      inst.hit = [];
      inst.active = -1;
      inst.activeLayer = null;
      var g = sv('g', { 'font-size': P.fs });
      inst.svg.appendChild(g);
      if (!raw) return;
      var plotW = P.W - pad.l - pad.r, plotH = P.H - pad.t - pad.b;
      var src = mode === 'agg' ? bucketed.values : raw;
      var mn = Math.min.apply(null, bucketed.values.concat(raw.slice(0, 40))), mx = Math.max.apply(null, bucketed.values.concat(raw.slice(0, 40)));
      var lo = Math.min.apply(null, bucketed.values) * 0.9, hi = Math.max.apply(null, bucketed.values) * 1.1;
      var baseY = pad.t + plotH;
      function xOf(i, n) { return pad.l + i * plotW / (n - 1); }
      function yOf(v) { return pad.t + plotH - (v - lo) / (hi - lo) * plotH; }

      niceTicks(lo, hi, 4).forEach(function (t) {
        var y = yOf(t);
        if (y < pad.t - 1 || y > baseY + 1) return;
        g.appendChild(sv('line', { class: 'dv-grid', x1: pad.l, y1: y, x2: pad.l + plotW, y2: y }));
        var tx = sv('text', { class: 'dv-tick', x: pad.l - 8, y: y + 4, 'text-anchor': 'end' });
        tx.textContent = fmtShort(t);
        g.appendChild(tx);
      });
      g.appendChild(sv('line', { class: 'dv-axis', x1: pad.l, y1: baseY, x2: pad.l + plotW, y2: baseY }));

      if (mode === 'raw') {
        var pts = raw.map(function (v, i) { return [xOf(i, raw.length), yOf(v)]; });
        var p1 = sv('path', { class: 'dv-series', d: polyline(pts), stroke: 'var(--info)', 'stroke-width': 1, opacity: 0.75 });
        var len1 = pts.reduce(function (a, p, i) { if (!i) return 0; var dx = p[0] - pts[i - 1][0], dy = p[1] - pts[i - 1][1]; return a + Math.sqrt(dx * dx + dy * dy); }, 0);
        p1.setAttribute('stroke-dasharray', String(len1));
        p1.setAttribute('stroke-dashoffset', String(len1));
        g.appendChild(p1);
        inst.marks.push({ type: 'dash', el: p1, len: len1, delay: 0 });
        var lab = sv('text', { class: 'dv-label--value', x: pad.l + 6, y: pad.t + 14 });
        lab.textContent = '原始 1200 点（等距抽样显示，逐点 tooltip 无意义）';
        g.appendChild(lab);
      } else {
        var bpts = bucketed.values.map(function (v, i) { return [xOf(i, bucketed.values.length), yOf(v)]; });
        var p2 = sv('path', { class: 'dv-series', d: polyline(bpts), stroke: 'var(--accent)', 'stroke-width': 2.5 });
        var len2 = bpts.reduce(function (a, p, i) { if (!i) return 0; var dx = p[0] - bpts[i - 1][0], dy = p[1] - bpts[i - 1][1]; return a + Math.sqrt(dx * dx + dy * dy); }, 0);
        p2.setAttribute('stroke-dasharray', String(len2));
        p2.setAttribute('stroke-dashoffset', String(len2));
        g.appendChild(p2);
        inst.marks.push({ type: 'dash', el: p2, len: len2, delay: 0 });
        bpts.forEach(function (p, i) { g.appendChild(sv('circle', { cx: p[0], cy: p[1], r: 2.6, fill: 'var(--accent)' })); });
        var mxI = bucketed.values.indexOf(Math.max.apply(null, bucketed.values));
        var lab2 = sv('text', { class: 'dv-label--value', x: bpts[mxI][0], y: bpts[mxI][1] - 10, 'text-anchor': 'middle' });
        lab2.textContent = '峰值 ' + fmtShort(bucketed.values[mxI]);
        g.appendChild(lab2);
      }

      var n = mode === 'agg' ? bucketed.values.length : raw.length;
      var rows = [];
      for (var i = 0; i < n; i += Math.max(1, Math.ceil(n / 60))) {
        rows.push(mode === 'agg'
          ? ['桶 ' + (i + 1) + '（' + bucketed.bucketSize + ' 点）', fmtFull(bucketed.values[i]), fmtFull(bucketed.sums[i]), String(bucketed.counts[i])]
          : ['点 ' + (i + 1), fmtFull(raw[i]), '—', '1']);
      }
      inst.hit = rows.map(function (r, i) {
        return {
          kind: 'point', x: pad.l + plotW * (i / Math.max(1, rows.length - 1)), y: pad.t + plotH / 2, title: r[0],
          rows: [{ key: 'v', name: mode === 'agg' ? '桶均值' : '原始值', color: 'var(--accent)', text: r[1], y: null }],
          tip: mode === 'agg' ? '桶内 ' + bucketed.bucketSize + ' 点的均值；合计 ' + r[2] : '原始点，逐点 tooltip 仅用于核对'
        };
      });
      buildTable(inst, '聚合视图数据表（每桶 ' + bucketed.bucketSize + ' 点，共 ' + bucketed.buckets + ' 桶）',
        ['桶', '均值', '合计', '点数'], rows,
        '原始 1200 点不逐点列出：>10000 点时连桶值都不渲染，只在区间层交互并给出聚合公式。');
      setNote(inst, (mode === 'agg' ? '聚合视图 ' + bucketed.buckets + ' 桶' : '原始视图 1200 点') + ' · 最大偏差 ' + (Math.round(inst.dev * 100) / 100));
    }

    if (gen) on(gen, 'click', function () {
      compute();
      showAgg = false;
      if (toggle) { toggle.setAttribute('aria-pressed', 'false'); toggle.textContent = '切换原始 / 聚合视图'; }
      if (note) {
        note.textContent = '已生成 1200 点 → 聚合为 ' + bucketed.buckets + ' 桶（每桶 ' + bucketed.bucketSize + ' 点）· 最大偏差 ' +
          (Math.round(inst.dev * 100) / 100) + ' · 误差 ' + (inst.dev / (Math.max.apply(null, raw) || 1) * 100).toFixed(2) + '% 峰值';
      }
      paint('raw');
      announce('已生成 1200 点并聚合为 ' + bucketed.buckets + ' 个桶');
    });
    if (toggle) on(toggle, 'click', function () {
      if (!raw) { if (note) note.textContent = '请先生成 1200 点。'; return; }
      showAgg = !showAgg;
      toggle.setAttribute('aria-pressed', showAgg ? 'true' : 'false');
      toggle.textContent = showAgg ? '显示原始 1200 点' : '显示聚合 60 桶';
      paint(showAgg ? 'agg' : 'raw');
      toggle.focus();
    });

    /* 初始给一个空态提示 */
    var g0 = sv('g', { 'font-size': 13 });
    inst.svg.setAttribute('viewBox', '0 0 760 260');
    var t0 = sv('text', { x: 380, y: 130, 'text-anchor': 'middle', class: 'dv-tick' });
    t0.textContent = '尚未生成数据 —— 点击「生成 1200 点」开始';
    g0.appendChild(t0);
    inst.svg.appendChild(g0);
    if (MLx.observeSize) MLx.observeSize(inst.plot, function () { if (raw) paint(showAgg ? 'agg' : 'raw'); });
  }

  /* ============================================================
     9. 启动
     ============================================================ */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    initCharts();
    initGrain();
    initSparks();
    initRing();
    initGauge();
    initStates();
    initAggregate();
    setNoteAll();
  }
  function setNoteAll() {
    charts.forEach(function (inst) { if (!inst.note || !inst.note.textContent) setNote(inst, inst.rendered ? '已渲染' : '待渲染'); });
  }

  document.addEventListener('ml:ready', boot, { once: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.setTimeout(boot, 0); }, { once: true });
  } else {
    window.setTimeout(boot, 0);
  }
  window.addEventListener('load', function () {
    window.setTimeout(function () { if (!booted) boot(); }, 300);
  }, { once: true });
})();
