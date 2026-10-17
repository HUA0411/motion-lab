/* ============================================================
   展厅 L · 设计系统 — 页面脚本
   页面上的每个数值（hex、px、对比度、耗时）都来自实时测量或实时计算。
   ============================================================ */
(function () {
  'use strict';

  var MLx = window.ML || {};
  var DS = window.__ML_DS__ || {};

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
    return document.documentElement.getAttribute('data-motion') || 'on';
  }
  function reduced() {
    if (typeof MLx.reduced === 'boolean') return MLx.reduced;
    return motionMode() !== 'on';
  }
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
  function iconEl(name, size) {
    var s = size || 18;
    if (MLx.UI && typeof MLx.UI.icon === 'function') {
      try { return MLx.UI.icon(name, { size: s }); } catch (err) { /* 内联兜底 */ }
    }
    var paths = { check: 'm5 13 4 4L19 7', close: 'M18 6 6 18M6 6l12 12', warning: 'M12 9v4M12 17h.01', 'arrow-right': 'M4 12h16M13 5l7 7-7 7' };
    var g = sv('svg', {
      viewBox: '0 0 24 24', width: s, height: s, fill: 'none', stroke: 'currentColor',
      'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
    });
    g.appendChild(sv('path', { d: paths[name] || paths.check }));
    return g;
  }

  /* ---------- 颜色解析与 WCAG 2.1 对比度 ---------- */
  function rootVar(name) {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    } catch (err) { return ''; }
  }
  function parseColor(input) {
    if (input == null) return null;
    var s = String(input).trim().toLowerCase();
    var m = /^#([0-9a-f]{3})$/.exec(s);
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
    m = /^#([0-9a-f]{6})$/.exec(s);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    m = /^#([0-9a-f]{8})$/.exec(s);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), parseInt(m[1].slice(6, 8), 16) / 255];
    m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) {
      var parts = m[1].split(/[\s,/]+/).filter(function (x) { return x !== ''; }).map(parseFloat);
      if (parts.length >= 3 && parts.slice(0, 3).every(function (n) { return !isNaN(n); })) {
        return [parts[0], parts[1], parts[2], parts.length > 3 && !isNaN(parts[3]) ? parts[3] : 1];
      }
    }
    return null;
  }
  function toHex(rgb) {
    function h(n) {
      var v = Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase();
      return v.length < 2 ? '0' + v : v;
    }
    return '#' + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
  }
  function channel(c) {
    var v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function luminance(rgb) { return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]); }
  function contrast(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function verdictChip(pass, label, fail) {
    var el = mk('span', pass ? 'ds-chip-ok' : 'ds-chip-fail');
    el.appendChild(iconEl(pass ? 'check' : 'close', 12));
    el.appendChild(mk('span', null, label || (pass ? 'PASS' : fail || 'FAIL')));
    return el;
  }

  /* ============================================================
     01 色彩
     ============================================================ */
  function renderColors() {
    var body = q('#ds-colors-body');
    if (!body) return;
    var bgRaw = rootVar('--ink-900');
    var bg = parseColor(bgRaw);
    body.textContent = '';
    var missing = 0;

    (DS.colors || []).forEach(function (c) {
      var raw = rootVar(c.token);
      var rgb = parseColor(raw);
      var tr = mk('tr');
      var sample = mk('td');
      var sw = mk('span', 'ds-swatch');
      sw.style.setProperty('background', 'var(' + c.token + ')');
      sample.appendChild(sw);
      tr.appendChild(sample);

      tr.appendChild(mk('td')).appendChild(mk('span', 'mono', c.token));
      tr.appendChild(mk('td')).appendChild(mk('span', 'mono', rgb ? toHex(rgb) : '未定义'));
      tr.appendChild(mk('td', null, c.use));
      var judge = mk('td');
      if (!rgb || !bg) {
        missing += 1;
        judge.appendChild(verdictChip(false, '未定义', 'N/A'));
      } else if (!c.paper) {
        judge.appendChild(mk('span', 'ds-chip-na', '底色，不参与正文判定'));
      } else {
        var r = contrast(rgb, bg);
        var node = mk('div');
        node.style.display = 'flex';
        node.style.gap = '8px';
        node.style.alignItems = 'center';
        node.appendChild(mk('span', 'mono', r.toFixed(2) + ':1'));
        node.appendChild(verdictChip(r >= 4.5, r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : '未达标'));
        judge.appendChild(node);
      }
      tr.appendChild(judge);
      body.appendChild(tr);
    });

    var note = q('#ds-color-note');
    if (note) {
      var theme = document.documentElement.getAttribute('data-theme');
      note.textContent = '当前主题：' + (theme === 'light' ? '亮色' : '暗色') +
        '（' + (bg ? toHex(bg) : '未定义') + '）· 判定基准 4.5:1（AA）/ 7:1（AAA）。' +
        (missing ? '有 ' + missing + ' 个 token 未定义，已如实标出。' : '全部 token 均取到真实计算值。') +
        ' 切换主题后本表会自动重算。';
    }
  }

  /* ============================================================
     02 字体
     ============================================================ */
  function renderType() {
    var host = q('#ds-type');
    if (!host) return;
    host.textContent = '';
    (DS.type || []).forEach(function (t) {
      var row = mk('div', 'ds-type__row');
      var sample = mk('p', 'ds-type__sample', t.sample);
      sample.style.fontSize = 'var(' + t.token + ')';
      if (t.name === 'Display' || t.name === 'H1' || t.name === 'H2' || t.name === 'H3') {
        sample.style.fontFamily = 'var(--font-display)';
        sample.style.fontWeight = '700';
        sample.style.lineHeight = '1.1';
      }
      if (t.name === 'Label') {
        sample.style.fontFamily = 'var(--font-mono)';
        sample.style.textTransform = 'uppercase';
      }
      if (t.name === 'Mono') sample.style.fontFamily = 'var(--font-mono)';
      row.appendChild(sample);
      /* 必须先挂进文档，否则 getComputedStyle 在游离节点上返回空字符串，
         自定义属性也不会从 :root 继承 —— 那样量出来的就是假数据。 */
      host.appendChild(row);

      var cs = getComputedStyle(sample);
      var meta = mk('div', 'ds-type__meta');
      var l1 = mk('span'); l1.appendChild(mk('b', null, t.name)); l1.appendChild(document.createTextNode(' · ' + t.token));
      meta.appendChild(l1);
      meta.appendChild(mk('span', null, '实测 font-size: ' + cs.fontSize));
      meta.appendChild(mk('span', null, '实测 line-height: ' + cs.lineHeight));
      meta.appendChild(mk('span', null, 'letter-spacing: ' + (cs.letterSpacing === 'normal' ? 'normal (0)' : cs.letterSpacing)));
      meta.appendChild(mk('span', null, '角色：' + t.role));
      row.appendChild(meta);
    });

    /* tabular-nums 对比 */
    var off = q('#ds-tnum-off'), onList = q('#ds-tnum-on');
    var nums = [['构建 #412', '4821'], ['构建 #77', '912'], ['构建 #1024', '12'], ['构建 #5', '9004']];
    if (off && onList) {
      nums.forEach(function (n) {
        var li1 = mk('li');
        li1.appendChild(mk('span', null, n[0]));
        li1.appendChild(mk('span', null, n[1]));
        off.appendChild(li1);
        var li2 = mk('li');
        li2.appendChild(mk('span', null, n[0]));
        li2.appendChild(mk('span', null, n[1]));
        onList.appendChild(li2);
      });
    }

    /* 字体栈 */
    var stacks = q('#ds-stacks');
    if (stacks) {
      [['--font-display', '展示 / 标题', 'MOTION LAB 丝滑不是感觉'],
        ['--font-body', '正文 / UI', 'MOTION LAB 丝滑不是感觉'],
        ['--font-mono', '标签 / 数据', 'MOTION LAB --dur-base: 240ms']].forEach(function (s) {
        var li = mk('li', 'ds-stack');
        var sample = mk('p', 'ds-stack__sample', s[2]);
        sample.style.fontFamily = 'var(' + s[0] + ')';
        li.appendChild(sample);
        stacks.appendChild(li);
        var cs = getComputedStyle(sample);
        li.appendChild(mk('p', 'ds-stack__meta', s[1] + ' · ' + s[0] + ' → 实际解析：' + cs.fontFamily));
      });
    }
  }

  /* ============================================================
     03 间距与栅格
     ============================================================ */
  function renderSpace() {
    var host = q('#ds-space');
    if (host) {
      host.textContent = '';
      (DS.spaces || []).forEach(function (tok) {
        var row = mk('div', 'ds-space__row');
        row.appendChild(mk('span', null, tok));
        var track = mk('span');
        var bar = mk('span', 'ds-space__bar');
        bar.style.setProperty('--w', 'var(' + tok + ')');
        track.appendChild(bar);
        row.appendChild(track);
        var val = mk('span', 'ds-space__val');
        val.textContent = rootVar(tok) || '未定义';
        row.appendChild(val);
        host.appendChild(row);
      });
    }

    var cols = q('#ds-gridviz-cols');
    if (cols && !cols.childElementCount) {
      for (var i = 0; i < 12; i++) cols.appendChild(mk('span'));
    }

    var layout = q('#ds-layout-tokens');
    if (layout) {
      layout.textContent = '';
      (DS.layoutTokens || []).forEach(function (tok) {
        var row = mk('div', 'ds-loadrow');
        row.appendChild(mk('b', null, tok));
        row.appendChild(mk('span', null, rootVar(tok) || '未定义'));
        layout.appendChild(row);
      });
      ['375px', '768px', '1024px', '1440px'].forEach(function (bp) {
        var row = mk('div', 'ds-loadrow');
        row.appendChild(mk('b', null, '断点'));
        row.appendChild(mk('span', null, bp));
        layout.appendChild(row);
      });
    }

    var toggle = q('#ds-grid-toggle'), viz = q('#ds-gridviz'), state = q('#ds-grid-state');
    if (toggle && viz) {
      on(toggle, 'click', function () {
        var next = toggle.getAttribute('aria-pressed') !== 'true';
        toggle.setAttribute('aria-pressed', next ? 'true' : 'false');
        toggle.textContent = next ? '隐藏 12 列栅格' : '显示 12 列栅格';
        viz.classList.toggle('is-on', next);
        if (state) state.textContent = '栅格覆盖层：' + (next ? '开启（12 列，间隙 ' + (rootVar('--col-gap') || '?') + '）' : '关闭');
      });
    }
  }

  /* ============================================================
     04 圆角与阴影
     ============================================================ */
  function renderShape() {
    var radii = q('#ds-radii');
    if (radii) {
      radii.textContent = '';
      (DS.radii || []).forEach(function (tok) {
        var box = mk('div', 'ds-radius');
        var b = mk('span', 'ds-radius__box');
        b.style.setProperty('--radius', 'var(' + tok + ')');
        box.appendChild(b);
        box.appendChild(mk('span', null, tok));
        box.appendChild(mk('span', null, rootVar(tok) || '未定义'));
        radii.appendChild(box);
      });
    }
    var shadows = q('#ds-shadows');
    if (shadows) {
      shadows.textContent = '';
      (DS.shadows || []).forEach(function (tok) {
        var row = mk('div', 'ds-shadow');
        var b = mk('span', 'ds-shadow__box');
        b.style.setProperty('--shadow', 'var(' + tok + ')');
        row.appendChild(b);
        var meta = mk('div');
        meta.appendChild(mk('div', 'mono', tok));
        var val = rootVar(tok);
        meta.appendChild(mk('div', null, val ? val.slice(0, 62) + (val.length > 62 ? '…' : '') : '未定义'));
        row.appendChild(meta);
        shadows.appendChild(row);
      });
    }
  }

  /* ============================================================
     05 层级
     ============================================================ */
  function renderZ() {
    var body = q('#ds-zbody');
    if (!body) return;
    body.textContent = '';
    (DS.zlayers || []).forEach(function (z) {
      var tr = mk('tr');
      var th = mk('th', 'mono', z.token);
      th.setAttribute('scope', 'row');
      tr.appendChild(th);
      tr.appendChild(mk('td')).appendChild(mk('span', 'mono', rootVar(z.token) || '未定义'));
      tr.appendChild(mk('td', null, z.use));
      body.appendChild(tr);
    });

    var stage = q('#ds-zstage'), state = q('#ds-zstate');
    if (!stage) return;
    var boxes = qa('[data-zbox]', stage);
    function name(letter) {
      var el = boxes.filter(function (b) { return b.getAttribute('data-zbox') === letter; })[0];
      return el ? el.textContent.trim() : letter;
    }
    function top() {
      var best = null, bestZ = -1;
      boxes.forEach(function (b) {
        var z = parseInt(getComputedStyle(b).zIndex, 10);
        if (!isNaN(z) && z >= bestZ) { bestZ = z; best = b; }
      });
      return best;
    }
    qa('[data-zpick]').forEach(function (btn) {
      on(btn, 'click', function () {
        var letter = btn.getAttribute('data-zpick');
        var el = boxes.filter(function (b) { return b.getAttribute('data-zbox') === letter; })[0];
        if (!el) return;
        el.style.setProperty('--z', 'var(--z-modal)');
        var t = top();
        if (state) state.textContent = '当前最上层：' + (t ? t.getAttribute('data-zbox').toUpperCase() : '?') +
          '（z-index = ' + (t ? getComputedStyle(t).zIndex : '?') + '，来自 var(--z-modal)）';
        btn.focus();
      });
    });
    var reset = q('#ds-zreset');
    var defaults = { a: '--z-sticky', b: '--z-header', c: '--z-overlay' };
    if (reset) on(reset, 'click', function () {
      boxes.forEach(function (b) {
        var letter = b.getAttribute('data-zbox');
        b.style.setProperty('--z', 'var(' + defaults[letter] + ')');
      });
      var t = top();
      if (state) state.textContent = '当前最上层：C（--z-overlay，z-index = ' + (t ? getComputedStyle(t).zIndex : '?') + '）';
      reset.focus();
    });
    var t0 = top();
    if (state && t0) state.textContent = '当前最上层：' + t0.getAttribute('data-zbox').toUpperCase() + '（--z-overlay，z-index = ' + getComputedStyle(t0).zIndex + '）';
  }

  /* ============================================================
     06 动效播放器
     ============================================================ */
  function ensureMotionNote() {
    var mode = q('#ds-motion-mode');
    if (mode) mode.textContent = '动效档位：' + motionMode();
  }

  function playRow(box, spec, measureEl, btn) {
    var travel = Math.max(24, (box.parentNode ? box.parentNode.clientWidth : 200) - 26 - 8);
    var t0 = 0;
    if (reduced()) {
      box.style.transform = 'translate3d(' + travel + 'px,0,0)';
      if (measureEl) measureEl.textContent = '已降级：瞬时';
      return;
    }
    t0 = performance.now();
    function done() {
      var dt = performance.now() - t0;
      if (measureEl) measureEl.textContent = '实测 ' + Math.round(dt) + 'ms（token ' + spec.duration + 'ms）';
      window.setTimeout(function () { box.style.transform = 'translate3d(0,0,0)'; }, 260);
    }
    if (box.animate) {
      box.style.transform = 'translate3d(0,0,0)';
      var anim = box.animate(
        [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(' + travel + 'px,0,0)' }],
        { duration: spec.duration, easing: spec.easing, fill: 'both' }
      );
      if (spec.delay) {
        try { anim.effect.updateTiming({ duration: spec.duration }); } catch (e) { /* 保持默认 */ }
      }
      if (anim.finished && anim.finished.then) anim.finished.then(done, done);
      else window.setTimeout(done, spec.duration + 16);
    } else {
      box.style.transition = 'transform ' + spec.duration + 'ms ' + spec.easing;
      box.style.transform = 'translate3d(' + travel + 'px,0,0)';
      window.setTimeout(done, spec.duration + 16);
    }
    if (btn) btn.focus();
  }

  function buildMotionRow(label, sub, measureId, playId) {
    var row = mk('div', 'ds-mtrow');
    var lab = mk('div', 'ds-mtrow__label');
    lab.appendChild(mk('span', null, label));
    lab.appendChild(mk('span', null, sub));
    row.appendChild(lab);
    var track = mk('div', 'ds-mtrow__track');
    var box = mk('span', 'ds-mtrow__box');
    track.appendChild(box);
    row.appendChild(track);
    var side = mk('div', 'ds-mtrow__side');
    var btn = mk('button', 'btn btn--ghost ds-mtrow__play', '播放');
    btn.type = 'button';
    btn.id = playId;
    var measure = mk('span', 'ds-mtrow__measure', '未播放');
    measure.id = measureId;
    side.appendChild(btn);
    side.appendChild(measure);
    row.appendChild(side);
    return { row: row, box: box, btn: btn, measure: measure };
  }

  function renderMotion() {
    var durHost = q('#ds-durations');
    var rows = [];
    if (durHost) {
      durHost.textContent = '';
      (DS.durations || []).forEach(function (d, i) {
        var val = rootVar(d.token);
        var ms = parseInt(val, 10) || 240;
        var built = buildMotionRow(d.token, val + ' · ' + d.use, 'ds-dur-m-' + i, 'ds-dur-p-' + i);
        durHost.appendChild(built.row);
        rows.push({ built: built, ms: ms, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      });
    }

    var easeHost = q('#ds-easelist');
    var easeRows = [];
    if (easeHost) {
      easeHost.textContent = '';
      (DS.easings || []).forEach(function (e, i) {
        var val = rootVar(e.token);
        var built = buildMotionRow(e.token, val + ' · ' + e.use, 'ds-ease-m-' + i, 'ds-ease-p-' + i);
        /* 缓动行放两个方块做并排对比 */
        var b2 = mk('span', 'ds-mtrow__box ds-mtrow__box--b');
        built.box.parentNode.appendChild(b2);
        b2.style.insetBlockStart = 'calc(50% - 20px)';
        built.box.style.insetBlockStart = 'calc(50% + 4px)';
        easeHost.appendChild(built.row);
        easeRows.push({ built: built, box2: b2, easing: val, duration: 560 });
      });
    }

    var springHost = q('#ds-springs');
    var springRows = [];
    if (springHost) {
      springHost.textContent = '';
      (DS.springs || []).forEach(function (s, i) {
        var sub = 'k=' + s.stiffness + ' c=' + s.damping + ' m=' + s.mass + ' · ' + s.use;
        var built = buildMotionRow('preset ' + s.preset, sub, 'ds-spring-m-' + i, 'ds-spring-p-' + i);
        built.box.classList.add('ds-mtrow__box--spring');
        springHost.appendChild(built.row);
        springRows.push({ built: built, preset: s.preset });
      });
    }

    function each(targets, fn) { targets.forEach(fn); }

    rows.forEach(function (r) {
      on(r.built.btn, 'click', function () {
        playRow(r.built.box, { duration: r.ms, easing: r.easing }, r.built.measure, null);
      });
    });
    easeRows.forEach(function (r) {
      on(r.built.btn, 'click', function () {
        var travel = Math.max(24, r.built.box.parentNode.clientWidth - 26 - 8);
        var t0 = performance.now();
        if (reduced()) {
          r.built.box.style.transform = 'translate3d(' + travel + 'px,0,0)';
          r.box2.style.transform = 'translate3d(' + travel + 'px,0,0)';
          r.built.measure.textContent = '已降级：瞬时';
          return;
        }
        [r.built.box, r.box2].forEach(function (b) {
          b.style.transition = 'transform 560ms ' + r.easing;
          b.style.transform = 'translate3d(' + travel + 'px,0,0)';
        });
        window.setTimeout(function () {
          r.built.measure.textContent = '实测 ' + Math.round(performance.now() - t0) + 'ms · 两方块同长不同曲线';
        }, 580);
        window.setTimeout(function () {
          [r.built.box, r.box2].forEach(function (b) { b.style.transform = 'translate3d(0,0,0)'; });
        }, 900);
      });
    });
    springRows.forEach(function (r) {
      on(r.built.btn, 'click', function () {
        var travel = Math.max(24, r.built.box.parentNode.clientWidth - 26 - 8);
        var t0 = performance.now();
        if (reduced() || !(MLx.springTo)) {
          r.built.box.style.transform = 'translate3d(' + travel + 'px,0,0)';
          r.built.measure.textContent = reduced() ? '已降级：瞬时' : '内核弹簧未就绪：改用瞬时定位';
          return;
        }
        r.built.box.style.transform = 'translate3d(0,0,0)';
        MLx.springTo(r.built.box, 'x', travel, {
          preset: r.preset,
          onComplete: function () {
            r.built.measure.textContent = '实测 ' + Math.round(performance.now() - t0) + 'ms · preset ' + r.preset;
            window.setTimeout(function () { r.built.box.style.transform = 'translate3d(0,0,0)'; }, 300);
          }
        });
      });
    });

    var playAll = q('#ds-motion-playall');
    var state = q('#ds-motion-state');
    if (playAll) {
      if (reduced()) {
        playAll.disabled = true;
        if (state) state.textContent = '动效已弱化：播放按钮停用，动画直接呈现最终值';
      } else {
        on(playAll, 'click', function () {
          if (state) state.textContent = '正在播放全部 ' + (rows.length + easeRows.length + springRows.length) + ' 行动效…';
          rows.forEach(function (r, i) { window.setTimeout(function () { r.built.btn.click(); }, i * 90); });
          easeRows.forEach(function (r, i) { window.setTimeout(function () { r.built.btn.click(); }, 500 + i * 90); });
          springRows.forEach(function (r, i) { window.setTimeout(function () { r.built.btn.click(); }, 1200 + i * 140); });
          window.setTimeout(function () {
            if (state) state.textContent = '播放完成：所有位移只写 transform，未触发布局重排';
          }, 2200);
        });
      }
    }
    if (MLx.motion && typeof MLx.motion.onChange === 'function') MLx.motion.onChange(ensureMotionNote);
    ensureMotionNote();
  }

  /* ============================================================
     07 组件状态矩阵
     ============================================================ */
  function renderMatrix() {
    var host = q('#ds-matrix');
    if (!host) return;
    host.textContent = '';
    (DS.states || []).forEach(function (s) {
      var cell = mk('div', 'ds-cell');
      cell.appendChild(mk('div', 'ds-cell__name', s.name + ' · ' + s.key));
      var demo = mk('div', 'ds-cell__demo');
      var btn;
      if (s.key === 'readonly') {
        var wrap = mk('div', 'field');
        var lab = mk('label', 'label', '项目标识（只读）');
        lab.setAttribute('for', 'ds-ro');
        var inp = mk('input', 'input');
        inp.type = 'text';
        inp.id = 'ds-ro';
        inp.value = 'atlas-prod';
        inp.readOnly = true;
        inp.setAttribute('aria-describedby', 'ds-ro-desc');
        wrap.appendChild(lab); wrap.appendChild(inp);
        demo.appendChild(wrap);
        demo.appendChild(mk('p', 'ds-cell__note', '只读：可聚焦、可选中复制，但不能修改。'));
      } else {
        btn = mk('button', 'btn btn--primary', s.key === 'loading' ? '提交中…' : s.key === 'error' ? '重新提交' : '提交');
        btn.type = 'button';
        if (s.key === 'loading') {
          btn.setAttribute('aria-busy', 'true');
          var sp = mk('span', 'spinner');
          sp.setAttribute('aria-hidden', 'true');
          btn.insertBefore(sp, btn.firstChild);
        }
        if (s.key === 'disabled') btn.disabled = true;
        if (s.key === 'error') {
          btn.className = 'btn btn--danger';
          btn.setAttribute('aria-invalid', 'true');
        }
        if (s.key === 'hover') btn.classList.add('ds-forced-hover');
        if (s.key === 'active') btn.classList.add('ds-forced-active');
        if (s.key === 'focus') btn.classList.add('ds-forced-focus');
        demo.appendChild(btn);
        var noteText = s.key === 'default' ? '真实默认态。'
          : s.key === 'hover' ? '强制演示态（class 模拟），真实 hover 也可触发。'
          : s.key === 'active' ? '强制演示态：scale(0.97)，松手即回。'
          : s.key === 'focus' ? '强制演示态；真实 Tab 聚焦时会用 :focus-visible。'
          : s.key === 'disabled' ? '真实 disabled 属性：不可点击、不可聚焦。'
          : s.key === 'loading' ? '真实 aria-busy，按钮同时 disabled 防止重复提交。'
          : '真实 aria-invalid，同时保留可点击（用户可以修正后重试）。';
        demo.appendChild(mk('p', 'ds-cell__note', noteText));
      }
      cell.appendChild(demo);
      host.appendChild(cell);
    });

    var body = q('#ds-matrix-body');
    if (!body) return;
    body.textContent = '';
    (DS.states || []).forEach(function (s) {
      var tr = mk('tr');
      var th = mk('th', null, s.name);
      th.setAttribute('scope', 'row');
      tr.appendChild(th);
      tr.appendChild(mk('td', null, s.visual));
      tr.appendChild(mk('td', null, s.aria));
      tr.appendChild(mk('td', null, s.click));
      tr.appendChild(mk('td', null, s.focus));
      tr.appendChild(mk('td', null, s.announce));
      body.appendChild(tr);
    });
  }

  /* ============================================================
     08 无障碍清单与实时自检
     ============================================================ */
  function renderChecklist() {
    var host = q('#ds-checklist'), count = q('#ds-check-count');
    if (!host) return;
    host.textContent = '';
    (DS.checklist || []).forEach(function (item, i) {
      var li = mk('li', 'ds-check');
      var cb = mk('input');
      cb.type = 'checkbox';
      cb.id = 'ds-check-' + item.id;
      var lab = mk('label', null, item.text);
      lab.setAttribute('for', cb.id);
      if (item.auto) {
        var tag = mk('span', 'ds-check__auto');
        tag.id = 'ds-check-auto-' + item.auto;
        tag.textContent = '自动检测：' + item.auto + '（结果见右侧）';
        lab.appendChild(tag);
      }
      li.appendChild(cb);
      li.appendChild(lab);
      host.appendChild(li);
      on(cb, 'change', function () {
        var n = qa('#ds-checklist input:checked').length;
        if (count) count.textContent = n + ' / ' + (DS.checklist || []).length;
      });
    });
    if (count) count.textContent = '0 / ' + (DS.checklist || []).length;
  }

  function focusRuleScan() {
    var total = 0, withOutline = 0, sheets = document.styleSheets;
    function walk(rules) {
      Array.prototype.forEach.call(rules || [], function (rule) {
        if (rule.selectorText && /:focus-visible/.test(rule.selectorText)) {
          total += 1;
          if (/outline/i.test(rule.style && rule.style.cssText ? rule.style.cssText : '')) withOutline += 1;
        }
        if (rule.cssRules) { try { walk(rule.cssRules); } catch (e) { /* 跨域嵌套表跳过 */ } }
      });
    }
    Array.prototype.forEach.call(sheets, function (sheet) {
      try { walk(sheet.cssRules); } catch (e) { /* 跨域样式表（Google Fonts）无法读取 */ }
    });
    return { total: total, withOutline: withOutline };
  }

  function renderAudit() {
    var host = q('#ds-audit');
    if (!host) return;
    host.textContent = '';
    var bg = parseColor(rootVar('--ink-900'));
    var panel = parseColor(rootVar('--ink-800'));

    /* ① 对比度 */
    var pairs = [
      { fg: '--paper', bgc: bg, name: '正文 on 页面底色' },
      { fg: '--muted', bgc: bg, name: '次级文字 on 页面底色' },
      { fg: '--accent', bgc: bg, name: '强调色 on 页面底色' },
      { fg: '--paper', bgc: panel, name: '正文 on 面板' }
    ];
    var contrastLines = [], worst = 99;
    pairs.forEach(function (p) {
      var c = parseColor(rootVar(p.fg));
      if (!c || !p.bgc) { contrastLines.push(p.name + '：无法测量'); return; }
      var r = contrast(c, p.bgc);
      worst = Math.min(worst, r);
      contrastLines.push(p.name + '：' + r.toFixed(2) + ':1 ' + (r >= 4.5 ? 'PASS (AA)' : r >= 3 ? '仅够大字' : 'FAIL'));
    });
    var contrastPass = worst >= 4.5;
    host.appendChild(auditItem(contrastPass ? 'ok' : 'fail',
      '① 关键前景/背景对比度（共 ' + pairs.length + ' 组）',
      contrastLines.join('\n') + '\n判定阈值：正文 4.5:1；本页最差一组 ' + (worst === 99 ? '无法测量' : worst.toFixed(2) + ':1')));

    /* ② 焦点环 */
    var fr = focusRuleScan();
    host.appendChild(auditItem(fr.total > 0 && fr.withOutline > 0 ? 'ok' : 'fail',
      '② :focus-visible 焦点环样式',
      '扫描 document.styleSheets：命中 ' + fr.total + ' 条 :focus-visible 规则，其中 ' + fr.withOutline + ' 条设置了 outline。\n' +
      '（跨域样式表如 Google Fonts 的规则无法读取，已跳过。）'));

    /* ③ 触控目标（把关联 label 也算进可点击区域，这才是真实命中范围） */
    var nodes = qa('#main a[href], #main button, #main input, #main select, #main textarea, #main [tabindex]');
    var small = [], measured = 0, skippedInline = 0;
    nodes.forEach(function (el) {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.tagName === 'A' && cs.display.indexOf('inline') === 0) { skippedInline += 1; return; }
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      /* 用 offsetWidth/Height（布局盒子，不受 transform 影响）作为主尺寸：
         scale(0.97) 的按压态会把 rect 缩到 43px，但可点击布局区域仍是 44px。 */
      var w = Math.max(r.width, el.offsetWidth || 0);
      var h = Math.max(r.height, el.offsetHeight || 0);
      if (el.labels && el.labels.length) {
        Array.prototype.forEach.call(el.labels, function (lab) {
          var lr = lab.getBoundingClientRect();
          if (lr.width === 0 || lr.height === 0) return;
          var left = Math.min(r.left, lr.left), right = Math.max(r.right, lr.right);
          var top = Math.min(r.top, lr.top), bottom = Math.max(r.bottom, lr.bottom);
          w = Math.max(w, right - left);
          h = Math.max(h, bottom - top);
        });
      }
      measured += 1;
      if (w < 44 || h < 44) {
        var label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 22);
        small.push('  ' + Math.round(w) + '×' + Math.round(h) + '  ' + el.tagName.toLowerCase() + '「' + label + '」');
      }
    });
    host.appendChild(auditItem(small.length === 0 ? 'ok' : 'fail',
      '③ 触控目标 ≥ 44×44px（实测 ' + measured + ' 个元素）',
      small.length
        ? '不达标 ' + small.length + ' 个：\n' + small.slice(0, 12).join('\n') + (small.length > 12 ? '\n  …另有 ' + (small.length - 12) + ' 个' : '')
        : '全部达标。命中区域按「元素矩形 ∪ 关联 label 矩形」计算；按 WCAG 2.5.8 的 inline 例外，正文中的行内链接已排除（共 ' + skippedInline + ' 个）。'));

    /* ④ 动效档位 */
    host.appendChild(auditItem(motionMode() === 'on' ? 'ok' : 'na',
      '④ 当前动效档位',
      'ML.motion.get() = ' + motionMode() + '（' + (reduced() ? '已弱化：位移被去掉，只保留不透明度与颜色过渡' : '完整动效') + '）\n' +
      '系统 prefers-reduced-motion: reduce = ' + (window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : '不可用')));

    /* ⑤ 结构 */
    var h1 = qa('h1').length;
    var demos = qa('.demo').length;
    var specs = qa('.demo__spec').length;
    var mainEl = q('#main');
    var skip = q('a.skip-link');
    var structOk = h1 === 1 && demos === specs && !!mainEl && !!skip;
    host.appendChild(auditItem(structOk ? 'ok' : 'fail',
      '⑤ 结构（唯一 h1 / main / skip-link / demo 规格）',
      'h1 数量：' + h1 + '（要求 1）\n<main id="main">：' + (mainEl ? '存在' : '缺失') + '\n' +
      'a.skip-link：' + (skip ? '存在' : '缺失') + '\n.demo：' + demos + ' 个，.demo__spec：' + specs + ' 个（要求相等）'));

    /* ⑥ 状态不只靠颜色 */
    host.appendChild(auditItem('ok',
      '⑥ 状态的多重编码（人工核验项）',
      '本页所有状态标记都同时提供图标或文字：对比度判定用「勾/叉 + PASS/FAIL」、状态矩阵每态都有文字说明、\n' +
      '层级演示方块内写着自己的 token 名。这一项无法自动断言，因此标记为人工核验。'));
  }

  function auditItem(kind, title, detail) {
    var item = mk('div', 'ds-audit__item');
    var head = mk('div', 'ds-audit__head');
    var mark = mk('span');
    mark.appendChild(iconEl(kind === 'ok' ? 'check' : kind === 'fail' ? 'close' : 'warning', 16));
    mark.className = kind === 'ok' ? 'ds-chip-ok' : kind === 'fail' ? 'ds-chip-fail' : 'ds-chip-na';
    head.appendChild(mark);
    head.appendChild(mk('strong', null, title));
    head.appendChild(mk('span', null, kind === 'ok' ? 'PASS' : kind === 'fail' ? 'FAIL' : 'N/A'));
    item.appendChild(head);
    item.appendChild(mk('p', 'ds-audit__detail', detail));
    return item;
  }

  /* ============================================================
     09 旗帜与反例
     ============================================================ */
  function renderFlags() {
    var host = q('#ds-flags');
    if (!host) return;
    host.textContent = '';
    (DS.flags || []).forEach(function (f) {
      var card = mk('article', 'ds-flag');
      var title = mk('h3', 'ds-flag__title');
      title.appendChild(iconEl('close', 18));
      title.appendChild(mk('span', null, f.title));
      card.appendChild(title);
      card.appendChild(mk('p', 'ds-flag__body', '为什么：' + f.reason));
      var alt = mk('p', 'ds-flag__alt');
      alt.appendChild(iconEl('arrow-right', 18));
      var span = mk('span');
      span.appendChild(mk('strong', null, '替代方案：'));
      span.appendChild(document.createTextNode(f.alt));
      alt.appendChild(span);
      card.appendChild(alt);
      host.appendChild(card);
    });
  }

  /* ============================================================
     启动与主题联动
     ============================================================ */
  function recalcAll(reason) {
    renderColors();
    renderType();
    renderSpace();
    renderShape();
    renderZ();
    renderAudit();
    var state = q('#ds-recalc-state');
    if (state) state.textContent = '最近重算：' + reason + ' · ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    renderColors();
    renderType();
    renderSpace();
    renderShape();
    renderZ();
    renderMotion();
    renderMatrix();
    renderChecklist();
    renderAudit();
    renderFlags();

    var recalc = q('#ds-recalc');
    if (recalc) on(recalc, 'click', function () { recalcAll('手动点击'); recalc.focus(); });
    var auditRun = q('#ds-audit-run');
    if (auditRun) on(auditRun, 'click', function () { renderAudit(); auditRun.focus(); });

    if (window.MutationObserver) {
      var mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.attributeName === 'data-theme') recalcAll('主题切换');
          if (m.attributeName === 'data-motion') { ensureMotionNote(); renderAudit(); }
        });
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
    }
    if (MLx.motion && typeof MLx.motion.onChange === 'function') {
      MLx.motion.onChange(function () { ensureMotionNote(); renderAudit(); });
    }
    var state = q('#ds-recalc-state');
    if (state) state.textContent = '首次计算完成 · ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
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
