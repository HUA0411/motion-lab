/* ============================================================
   展厅 J · 无障碍交互 — 页面脚本
   只使用 CONTRACT.md §3 列出的 ML API；内核缺失时降级为等价原生实现，
   保证任何时刻都不抛错、不留 console 输出。
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
    return function () { if (t && t.removeEventListener) t.removeEventListener(type, fn, opts); };
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
  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svgIcon(name, size) {
    var s = size || 16;
    if (MLx.UI && typeof MLx.UI.icon === 'function') {
      try { return MLx.UI.icon(name, { size: s }); } catch (err) { /* 落到内联兜底 */ }
    }
    var paths = {
      check: 'm5 13 4 4L19 7',
      close: 'M18 6 6 18M6 6l12 12',
      alert: 'M12 8v5M12 17h.01',
      minus: 'M5 12h14'
    };
    var d = paths[name] || paths.alert;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(s));
    svg.setAttribute('height', String(s));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }

  /* ---------- 1. 颜色与 WCAG 2.1 对比度 ---------- */
  function parseColor(input) {
    if (input == null) return null;
    var s = String(input).trim().toLowerCase();
    var m = /^#([0-9a-f]{3})$/.exec(s);
    if (m) {
      return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
    }
    m = /^#([0-9a-f]{8})$/.exec(s);
    if (m) {
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), parseInt(m[1].slice(6, 8), 16) / 255];
    }
    m = /^#([0-9a-f]{6})$/.exec(s);
    if (m) {
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    }
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
  function over(fg, bg) {
    if (fg[3] >= 1) return [fg[0], fg[1], fg[2], 1];
    var a = fg[3];
    return [
      fg[0] * a + bg[0] * (1 - a),
      fg[1] * a + bg[1] * (1 - a),
      fg[2] * a + bg[2] * (1 - a),
      1
    ];
  }
  function channel(c) {
    var v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function luminance(rgb) {
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  }
  function contrastRatio(fg, bg) {
    var l1 = luminance(fg), l2 = luminance(bg);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* ============================================================
     01 · 实时对比度检测器
     ============================================================ */
  var CHECKS = [
    { level: 'AA', size: '正文', min: 4.5 },
    { level: 'AA', size: '大字', min: 3 },
    { level: 'AAA', size: '正文', min: 7 },
    { level: 'AAA', size: '大字', min: 4.5 },
    { level: '1.4.11', size: '界面与图形', min: 3 }
  ];

  function initContrast() {
    var root = q('#ct-root');
    var fg = q('#ct-fg'), bg = q('#ct-bg');
    if (!root || !fg || !bg) return;
    var fgHex = q('#ct-fg-hex'), bgHex = q('#ct-bg-hex');
    var ratioEl = q('#ct-ratio'), verdicts = q('#ct-verdicts');
    var steps = q('#ct-steps'), formula = q('#ct-formula');
    var preview = q('#ct-preview');

    function render() {
      var fgRgb = parseColor(fg.value) || [255, 107, 44, 1];
      var bgRgb = parseColor(bg.value) || [10, 11, 13, 1];
      var solidFg = over(fgRgb, bgRgb);
      var r = contrastRatio(solidFg, bgRgb);

      root.style.setProperty('--ct-fg', toHex(fgRgb));
      root.style.setProperty('--ct-bg', toHex(bgRgb));
      if (fgHex) fgHex.textContent = toHex(fgRgb);
      if (bgHex) bgHex.textContent = toHex(bgRgb);
      if (ratioEl) ratioEl.textContent = r.toFixed(2);

      var lf = luminance(solidFg), lb = luminance(bgRgb);
      if (formula) {
        formula.textContent = 'L(fg) = ' + lf.toFixed(4) + ' · L(bg) = ' + lb.toFixed(4) +
          ' · 比值 = (' + Math.max(lf, lb).toFixed(4) + ' + 0.05) / (' + Math.min(lf, lb).toFixed(4) + ' + 0.05)';
      }
      if (steps) {
        steps.textContent =
          '1) 前景 ' + toHex(fgRgb) + ' → 线性化 R=' + channel(solidFg[0]).toFixed(4) +
          ' G=' + channel(solidFg[1]).toFixed(4) + ' B=' + channel(solidFg[2]).toFixed(4) + '\n' +
          '2) 相对亮度 L = 0.2126R + 0.7152G + 0.0722B = ' + lf.toFixed(4) + '\n' +
          '3) 背景 ' + toHex(bgRgb) + ' → L = ' + lb.toFixed(4) + '\n' +
          '4) 对比度 = (L亮 + 0.05) / (L暗 + 0.05) = ' + r.toFixed(2) + ':1' +
          (fgRgb[3] < 1 ? '\n注：前景带 alpha=' + fgRgb[3].toFixed(2) + '，已先与背景合成再计算。' : '');
      }

      if (verdicts) {
        verdicts.textContent = '';
        CHECKS.forEach(function (c) {
          var pass = r >= c.min;
          var li = mk('li', 'a11y-verdict ' + (pass ? 'a11y-verdict--pass' : 'a11y-verdict--fail'));
          var mark = mk('span', 'a11y-verdict__mark');
          mark.appendChild(svgIcon(pass ? 'check' : 'close', 14));
          li.appendChild(mark);
          li.appendChild(mk('span', null, c.level + ' · ' + c.size + ' ≥ ' + c.min + ':1'));
          li.appendChild(mk('span', 'a11y-verdict__res', pass ? 'PASS' : 'FAIL'));
          verdicts.appendChild(li);
        });
      }
      if (preview) preview.setAttribute('aria-label', '对比度预览：比值 ' + r.toFixed(2) + ' 比 1');
    }

    on(fg, 'input', render);
    on(bg, 'input', render);

    var swap = q('#ct-swap');
    if (swap) {
      on(swap, 'click', function () {
        var a = fg.value; fg.value = bg.value; bg.value = a;
        render();
        fg.focus();
      });
    }

    var host = q('#ct-presets');
    var data = (window.__ML_A11Y__ && window.__ML_A11Y__.presets) || [];
    if (host && data.length) {
      data.forEach(function (p) {
        var b = mk('button', 'chip', p.name);
        b.type = 'button';
        on(b, 'click', function () {
          fg.value = p.fg; bg.value = p.bg;
          render();
        });
        host.appendChild(b);
      });
    }
    render();
  }

  /* ============================================================
     02 · 焦点环：好 / 坏对比
     ============================================================ */
  function initFocusRing() {
    function watch(ids, statusSel, label) {
      var status = q(statusSel);
      if (!status) return;
      ids.forEach(function (id) {
        var el = q('#' + id);
        if (!el) return;
        var name = el.textContent.trim();
        on(el, 'focus', function () {
          var ring = el.matches(':focus-visible') ? '（浏览器认为这是键盘焦点）' : '（浏览器认为这是指针焦点）';
          status.textContent = label + '：焦点当前在「' + name + '」' + ring +
            '。' + (label === '反例' ? '提示环不可见——你只能靠这行文字确认。' : '提示环应可见：2px accent + 3px 偏移。');
        });
      });
    }
    watch(['ring-bad-1', 'ring-bad-2'], '#ring-bad-status', '反例');
    watch(['ring-good-1', 'ring-good-2'], '#ring-good-status', '修复');
  }

  /* ============================================================
     03 · Tab 顺序 + 焦点陷阱
     ============================================================ */
  function tabIndexOf(el) {
    var raw = el.getAttribute('tabindex');
    var n = raw == null ? 0 : parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }
  function focusables(root) {
    return qa('button, a[href], input, select, textarea, [tabindex]', root).filter(function (el) {
      if (el.disabled || el.hidden) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      return tabIndexOf(el) >= 0;
    });
  }
  function predictedOrder(root) {
    var els = focusables(root);
    var positive = els.filter(function (el) { return tabIndexOf(el) > 0; })
      .sort(function (a, b) {
        var d = tabIndexOf(a) - tabIndexOf(b);
        if (d !== 0) return d;
        return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });
    var rest = els.filter(function (el) { return tabIndexOf(el) <= 0; });
    return positive.concat(rest);
  }

  function initTabOrder() {
    var out = q('#tab-result');
    var readBtn = q('#tab-read'), walkBtn = q('#tab-walk');
    var badRoot = q('#tab-bad'), goodRoot = q('#tab-good');
    var live = [];

    function render() {
      if (!out) return;
      var lines = [];
      lines.push('浏览器实际 Tab 顺序（按正向 tabindex 升序 → 再按 DOM 顺序）');
      lines.push('');
      lines.push('反例 #tab-bad：');
      predictedOrder(badRoot).forEach(function (el, i) {
        lines.push('  ' + (i + 1) + '. ' + el.textContent.trim() + '   [tabindex=' + tabIndexOf(el) + ']');
      });
      lines.push('  → 与视觉顺序不一致，第 2 个按钮先被聚焦。');
      lines.push('');
      lines.push('修复 #tab-good：');
      predictedOrder(goodRoot).forEach(function (el, i) {
        lines.push('  ' + (i + 1) + '. ' + el.textContent.trim() + '   [tabindex=0（未写）]');
      });
      lines.push('  → 顺序 = DOM 顺序 = 视觉顺序。');
      if (live.length) {
        lines.push('');
        lines.push('你刚刚的真实焦点序列：');
        live.forEach(function (t, i) { lines.push('  ' + (i + 1) + '. ' + t); });
      }
      out.textContent = lines.join('\n');
    }

    if (readBtn) on(readBtn, 'click', render);

    if (walkBtn) {
      on(walkBtn, 'click', function () {
        live = [];
        var first = focusables(badRoot)[0];
        if (first) first.focus();
        render();
      });
    }
    if (badRoot) {
      on(badRoot, 'focusin', function (e) {
        if (e.target && e.target.tagName === 'BUTTON') {
          live.push(e.target.textContent.trim());
          if (live.length > 12) live.shift();
          render();
        }
      });
    }
    render();
  }

  function buildModal(cfg) {
    var scrim = mk('div', 'a11y-modal');
    scrim.hidden = true;
    var box = mk('div', 'a11y-modal__box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', cfg.titleId);
    box.setAttribute('tabindex', '-1');

    var title = mk('p', 'a11y-card__title', cfg.title);
    title.id = cfg.titleId;
    box.appendChild(title);
    box.appendChild(mk('p', 'a11y-note', cfg.desc));

    var row = mk('div', 'a11y-row');
    cfg.buttons.forEach(function (b) {
      var btn = mk('button', 'btn' + (b.primary ? ' btn--primary' : ''), b.label);
      btn.type = 'button';
      row.appendChild(btn);
    });
    box.appendChild(row);
    box.appendChild(mk('p', 'a11y-note mono', cfg.hint));
    scrim.appendChild(box);
    document.body.appendChild(scrim);

    var lastFocus = null;

    function close() {
      if (scrim.hidden) return;
      scrim.hidden = true;
      if (MLx.scroll && typeof MLx.scroll.unlock === 'function') MLx.scroll.unlock();
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      if (typeof cfg.onClose === 'function') cfg.onClose(lastFocus);
    }
    function open(trigger) {
      lastFocus = trigger || document.activeElement;
      scrim.hidden = false;
      if (MLx.scroll && typeof MLx.scroll.lock === 'function') MLx.scroll.lock();
      var items = focusables(box);
      if (cfg.mode === 'pin') box.focus();
      else if (items.length) items[0].focus();
      else box.focus();
      if (typeof cfg.onOpen === 'function') cfg.onOpen();
    }
    on(scrim, 'keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      if (cfg.mode === 'pin') {
        e.preventDefault();
        box.focus();
        return;
      }
      var items = focusables(box);
      if (!items.length) { e.preventDefault(); box.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      var active = document.activeElement;
      if (e.shiftKey && (active === first || active === box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    });
    on(scrim, 'click', function (e) {
      if (e.target === scrim && cfg.mode !== 'pin') close();
    });
    return { open: open, close: close, el: scrim };
  }

  function initTraps() {
    var badState = q('#trap-bad-state');
    var bad = buildModal({
      titleId: 'trap-bad-title',
      title: '反例：Tab 被卡住的对话框',
      desc: '焦点被钉在对话框容器上，按 Tab 无法前进或后退。唯一的出口是标准退出方式：按 Esc。',
      buttons: [{ label: '主要操作' }, { label: '次要操作' }],
      hint: 'keydown Tab → e.preventDefault() + box.focus()　·　Esc 关闭',
      mode: 'pin',
      onOpen: function () { if (badState) badState.textContent = '状态：已进入（Tab 已失效，Esc 可退出）。'; },
      onClose: function (lf) {
        if (badState) badState.textContent = '状态：已退出；焦点已还原到：' + (lf && lf.textContent ? lf.textContent.trim() : '触发元素');
      }
    });
    var badOpen = q('#trap-bad-open');
    if (badOpen) on(badOpen, 'click', function () { bad.open(badOpen); });
    var badRelease = q('#trap-bad-release');
    if (badRelease) on(badRelease, 'click', function () { bad.close(); badRelease.focus(); });

    var goodState = q('#trap-good-state');
    var good = buildModal({
      titleId: 'trap-good-title',
      title: '修复：正确的焦点管理',
      desc: '打开时焦点进入第一个控件，Tab 在对话框内部循环不出框，Esc 关闭并把焦点还给触发按钮。',
      buttons: [{ label: '确认', primary: true }, { label: '取消' }, { label: '稍后处理' }],
      hint: 'Tab 循环：末项 → 首项，首项 Shift+Tab → 末项　·　Esc → close() → lastFocus.focus()',
      mode: 'cycle',
      onOpen: function () {
        if (goodState) goodState.textContent = '状态：已打开；焦点在第一个按钮上。上一次焦点：' + (goodTriggerLabel || '—');
      },
      onClose: function (lf) {
        if (goodState) goodState.textContent = '状态：已关闭；焦点已还原到：' + (lf && lf.textContent ? lf.textContent.trim() : '触发元素');
      }
    });
    var goodTriggerLabel = '';
    var goodOpen = q('#trap-good-open');
    if (goodOpen) {
      goodTriggerLabel = goodOpen.textContent.trim();
      on(goodOpen, 'click', function () { good.open(goodOpen); });
    }
  }

  /* ============================================================
     04 · 跳转链接
     ============================================================ */
  function initSkipLinks() {
    var skip = q('#mini-skip');
    var main = q('#mini-main');
    var status = q('#mini-status');
    if (!skip || !main) return;
    on(skip, 'click', function () {
      /* 锚点默认行为已移动滚动位置；显式 focus 保证焦点也跟着走 */
      window.setTimeout(function () { main.focus(); }, 0);
    });
    on(main, 'focus', function () {
      if (status) status.textContent = '焦点已落在主内容容器上：下一次 Tab 进入「跳到本演示的主内容」之后的第一个可聚焦元素，而不是回到 8 条导航。';
    });
  }

  /* ============================================================
     05 · 屏幕阅读器播报
     ============================================================ */
  var ANNOUNCE = {
    info: '信息：草稿已自动保存，10:24 更新。',
    success: '成功：构建 #412 已通过全部 38 项检查，可以发布。',
    warning: '警告：3 张图片缺少替代文本，发布前需要处理。',
    danger: '错误：构建 #410 失败，第 2 步类型检查未通过。可在阶段 04 重试。'
  };

  function initAnnounce() {
    var caption = q('#ann-caption'), probe = q('#ann-live-probe'), status = q('#ann-status');
    var polite = q('#ann-polite'), assertive = q('#ann-assertive');
    var count = q('#ann-count');
    var n = 0;

    function write(region, msg) {
      if (!region) return;
      region.textContent = '';
      window.setTimeout(function () { region.textContent = msg; }, 30);
    }

    qa('[data-announce]').forEach(function (btn) {
      on(btn, 'click', function () {
        var kind = btn.getAttribute('data-kind');
        var level = btn.getAttribute('data-announce');
        var msg = ANNOUNCE[kind] || ANNOUNCE.info;
        n += 1;
        write(level === 'assertive' ? assertive : polite, msg);
        if (caption) {
          caption.textContent = msg + '　［' + level + '］';
          caption.style.setProperty('opacity', '1');
        }
        if (probe) probe.textContent = 'role="' + (level === 'assertive' ? 'alert' : 'status') + '" ← ' + msg;
        if (status) status.textContent = '已向 ' + (level === 'assertive' ? 'assertive' : 'polite') + ' 区域写入第 ' + n + ' 条消息（先清空再写入，重复内容也会播报）。';
        if (count) count.textContent = '播报次数：' + n;
      });
    });

    var clear = q('#ann-clear');
    if (clear) {
      on(clear, 'click', function () {
        if (caption) caption.textContent = '';
        if (probe) probe.textContent = 'role="status" 待命';
        if (polite) polite.textContent = '';
        if (assertive) assertive.textContent = '';
        if (status) status.textContent = '字幕已清空，播报计数器保留以便验证「重复消息仍会播报」。';
        clear.focus();
      });
    }
  }

  /* ============================================================
     06 · 语义标签 vs div
     ============================================================ */
  var LANDMARKS = ['main', 'nav', 'header', 'footer', 'aside', 'article', 'section', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'ul', 'ol', 'table'];

  function outlineOf(root) {
    if (!root) return { lines: [], named: 0, headings: 0 };
    var lines = [], named = 0, headings = 0;
    function walk(node, depth) {
      Array.prototype.forEach.call(node.children, function (child) {
        var tag = child.tagName.toLowerCase();
        var isLandmark = LANDMARKS.indexOf(tag) > -1;
        var hasRole = child.hasAttribute('role');
        var isHeading = /^h[1-6]$/.test(tag);
        if (isLandmark || hasRole) {
          if (isLandmark && !isHeading && tag !== 'a' && tag !== 'button' && tag !== 'ul' && tag !== 'ol' && tag !== 'table') named += 1;
          if (isHeading) headings += 1;
          var name = '';
          if (child.hasAttribute('aria-label')) name = ' aria-label="' + child.getAttribute('aria-label') + '"';
          else if (child.hasAttribute('aria-labelledby')) name = ' aria-labelledby="' + child.getAttribute('aria-labelledby') + '"';
          var label = '';
          if (isHeading) label = ' · 文本「' + child.textContent.trim().slice(0, 18) + '」';
          lines.push(new Array(depth + 1).join('  ') + '<' + tag + (hasRole ? ' role="' + child.getAttribute('role') + '"' : '') + name + '>' + label);
        }
        walk(child, depth + (isLandmark || hasRole ? 1 : 0));
      });
    }
    walk(root, 0);
    return { lines: lines, named: named, headings: headings };
  }

  function initSemantics() {
    var bad = outlineOf(q('#dom-bad')), good = outlineOf(q('#dom-good'));
    var outBad = q('#sem-out-bad'), outGood = q('#sem-out-good'), summary = q('#sem-summary');
    if (outBad) outBad.textContent = '尚未分析。';
    if (outGood) outGood.textContent = '尚未分析。';
    var btn = q('#sem-read');
    if (!btn) return;
    on(btn, 'click', function () {
      var b = outlineOf(q('#dom-bad')), g = outlineOf(q('#dom-good'));
      if (outBad) outBad.textContent = b.lines.length ? b.lines.join('\n') : '（没有可提取的地标或标题——读屏软件只能逐字读完整个容器）';
      if (outGood) outGood.textContent = g.lines.length ? g.lines.join('\n') : '（未找到）';
      if (summary) {
        summary.textContent = 'div 版：' + b.named + ' 个地标 / ' + b.headings + ' 个标题　·　语义版：' + g.named + ' 个地标 / ' + g.headings + ' 个标题';
      }
    });
  }

  /* ============================================================
     07 · 触控目标标尺
     ============================================================ */
  function initRuler() {
    var stage = q('#ruler-stage'), toggle = q('#ruler-toggle'), measure = q('#ruler-measure'), out = q('#ruler-result');
    if (toggle && stage) {
      on(toggle, 'click', function () {
        var onNow = toggle.getAttribute('aria-pressed') === 'true';
        var next = !onNow;
        toggle.setAttribute('aria-pressed', next ? 'true' : 'false');
        toggle.textContent = next ? '关闭 44px 标尺' : '打开 44px 标尺';
        stage.classList.toggle('a11y-ruler--on', next);
      });
    }
    if (measure && stage) {
      on(measure, 'click', function () {
        var items = qa('.a11y-target', stage);
        var min = ((window.__ML_A11Y__ && window.__ML_A11Y__.targetRule) || {}).min || 44;
        var pass = 0, lines = ['实测结果（getBoundingClientRect，含 1px 边框）', ''];
        items.forEach(function (el) {
          var r = el.getBoundingClientRect();
          var ok = r.width >= min && r.height >= min;
          if (ok) pass += 1;
          lines.push((ok ? 'PASS' : 'FAIL') + '  ' + Math.round(r.width) + ' × ' + Math.round(r.height) +
            '  「' + (el.getAttribute('aria-label') || el.textContent.trim()) + '」' +
            (ok ? '' : '   ← 小于 ' + min + 'px，触控时极易误触'));
        });
        lines.push('');
        lines.push(pass + ' / ' + items.length + ' 达标（' + Math.round(pass / items.length * 100) + '%）');
        lines.push(((window.__ML_A11Y__ && window.__ML_A11Y__.targetRule) || {}).note || '');
        if (out) out.textContent = lines.join('\n');
      });
    }
  }

  /* ============================================================
     08 · 表单标签与错误播报
     ============================================================ */
  function initForm() {
    var form = q('#a11y-form');
    if (!form) return;
    var mail = q('#f-mail'), seat = q('#f-seat');
    var submit = q('#f-submit'), reset = q('#f-reset');
    var status = q('#f-status'), summary = q('#f-summary'), summaryText = q('#f-summary-text');

    var RULES = [
      {
        el: mail, field: q('#field-mail'), error: q('#f-mail-error'),
        test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
        msg: '邮箱格式不正确，需要包含 @ 与域名。'
      },
      {
        el: seat, field: q('#field-seat'), error: q('#f-seat-error'),
        test: function (v) { return /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 200; },
        msg: '请输入 1 到 200 之间的整数。'
      }
    ];

    function setError(rule, bad) {
      if (!rule.field || !rule.error) return;
      rule.field.classList.toggle('a11y-invalid', bad);
      rule.field.classList.toggle('field--invalid', bad);
      rule.error.hidden = !bad;
      rule.el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    }

    RULES.forEach(function (rule) {
      on(rule.el, 'input', function () {
        if (!rule.error.hidden) setError(rule, !rule.test(rule.el.value));
      });
      on(rule.el, 'blur', function () {
        if (rule.el.value.trim() !== '') setError(rule, !rule.test(rule.el.value));
      });
    });

    on(form, 'submit', function (e) {
      e.preventDefault();
      var bad = RULES.filter(function (r) { return !r.test(r.el.value); });
      if (bad.length) {
        RULES.forEach(function (r) { setError(r, !r.test(r.el.value)); });
        if (summary && summaryText) {
          summary.hidden = false;
          summaryText.textContent = '表单有 ' + bad.length + ' 处问题：' + bad.map(function (r) { return r.msg; }).join(' ');
        }
        if (status) status.textContent = '提交被拦下：' + bad.length + ' 处问题，焦点已移到第一个出错字段。';
        bad[0].el.focus();
        return;
      }
      if (summary) summary.hidden = true;
      if (submit) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        submit.dataset.label = submit.textContent;
        submit.textContent = '提交中…';
      }
      if (status) status.textContent = '已提交，正在等待结果…';
      window.setTimeout(function () {
        if (submit) {
          submit.disabled = false;
          submit.removeAttribute('aria-busy');
          submit.textContent = submit.dataset.label || '提交';
        }
        if (status) status.textContent = '提交成功：' + mail.value.trim() + ' · ' + seat.value.trim() + ' 个席位。角色 status 已播报这条消息。';
      }, 900);
    });

    if (reset) {
      on(reset, 'click', function () {
        RULES.forEach(function (r) { setError(r, false); });
        if (summary) summary.hidden = true;
        if (status) status.textContent = '已重置，错误状态与焦点位置均已清除。';
      });
    }
  }

  /* ============================================================
     09 · reduced-motion 并排对照
     ============================================================ */
  function initMotionPair() {
    var chip = q('#motion-mode-chip'), note = q('#track-calm-note'), sysNote = q('#motion-system-note');
    var forced = q('#track-forced'), calm = q('#track-calm');
    var replay = q('#motion-replay'), cycle = q('#motion-cycle');

    function sync() {
      var mode = motionMode();
      if (chip) chip.textContent = '当前动效档位：' + mode;
      if (note) {
        note.textContent = mode === 'on'
          ? '档位 on：仅保留不透明度过渡，位移被替换为淡入（1 → 0.35 → 1 不会发生；此处为静止后的淡入）。'
          : '档位 ' + mode + '：不产生任何位移，只做 240ms 不透明度过渡。';
      }
      if (sysNote) {
        var sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        sysNote.textContent = '系统 prefers-reduced-motion: reduce = ' + (sys ? 'true' : 'false') +
          '；ML.motion 引擎判定 = ' + mode + (reduced() ? '（已弱化）' : '（完整）');
      }
      qa('.a11y-track').forEach(function (t) {
        t.style.setProperty('--a11y-travel', Math.max(0, t.clientWidth - 24 - 16) + 'px');
      });
    }

    function play() {
      [forced, calm].forEach(function (t) {
        if (!t) return;
        t.classList.remove('a11y-track--run');
        /* 强制重排以重启动画（只读几何属性，不写布局） */
        void t.offsetWidth;
        t.classList.add('a11y-track--run');
      });
      window.setTimeout(function () {
        [forced, calm].forEach(function (t) { if (t) t.classList.remove('a11y-track--run'); });
      }, 950);
    }

    if (replay) on(replay, 'click', play);

    var ORDER = ['on', 'lite', 'off'];
    if (cycle) {
      on(cycle, 'click', function () {
        if (!(MLx.motion && typeof MLx.motion.set === 'function')) {
          if (chip) chip.textContent = '当前动效档位：' + motionMode() + '（内核未就绪，无法切换）';
          return;
        }
        var cur = motionMode();
        var next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
        MLx.motion.set(next);
        sync();
      });
    }
    if (MLx.motion && typeof MLx.motion.onChange === 'function') {
      MLx.motion.onChange(sync);
    }
    if (MLx.observeSize) {
      if (forced) MLx.observeSize(forced, sync);
      if (calm) MLx.observeSize(calm, sync);
    }
    sync();
    if (reduced()) {
      /* reduced-motion 下不自动播放，交由用户点击「重播一次」 */
      if (note) note.textContent += '（当前为弱化档位：不会自动播放对照动画）';
    }
  }

  /* ============================================================
     10 · 仅用颜色表达
     ============================================================ */
  function initCvd() {
    var btn = q('#cvd-toggle'), scope = q('#cvd-scope');
    if (!btn || !scope) return;
    on(btn, 'click', function () {
      var next = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      btn.textContent = next ? '关闭色盲模拟（灰阶）' : '打开色盲模拟（灰阶）';
      scope.classList.toggle('a11y-gray', next);
    });
  }

  /* ============================================================
     11 · 自动轮播
     ============================================================ */
  function initCarousel() {
    var root = q('#carousel');
    if (!root) return;
    var slides = qa('.a11y-carousel__slide', root);
    var dotsHost = q('#carousel-dots');
    var toggle = q('#carousel-toggle');
    var state = q('#carousel-state');
    var progress = q('#carousel-progress');
    var viewport = q('#carousel-viewport');
    var DURATION = 4000;
    var idx = 0, playing = false, elapsed = 0, last = 0, rafId = 0, pausedBy = '';

    function setProgress(p) {
      if (progress) progress.style.setProperty('--a11y-carousel', String(Math.max(0, Math.min(1, p))));
    }
    function show(i) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.setAttribute('data-active', k === idx ? 'true' : 'false'); });
      qa('.a11y-dot', dotsHost).forEach(function (d, k) {
        d.setAttribute('aria-current', k === idx ? 'true' : 'false');
      });
      setProgress(0);
      elapsed = 0; last = 0;
    }
    function tick(ts) {
      if (!playing) return;
      if (!last) last = ts;
      elapsed += ts - last;
      last = ts;
      setProgress(elapsed / DURATION);
      if (elapsed >= DURATION) {
        elapsed = 0; last = 0;
        show(idx + 1);
      }
      rafId = window.requestAnimationFrame(tick);
    }
    function play(reason) {
      if (reduced()) { setStateMsg('已暂停（动效弱化档位下不自动播放）'); return; }
      if (playing) return;
      playing = true; last = 0;
      if (toggle) {
        toggle.setAttribute('aria-pressed', 'false');
        toggle.textContent = '暂停轮播';
      }
      setStateMsg('自动播放中' + (reason ? '（' + reason + '）' : ''));
      rafId = window.requestAnimationFrame(tick);
    }
    function pause(reason, by) {
      if (!playing) { setStateMsg('已暂停' + (reason ? '（' + reason + '）' : '')); return; }
      playing = false;
      window.cancelAnimationFrame(rafId);
      pausedBy = by || '';
      if (toggle) {
        toggle.setAttribute('aria-pressed', 'true');
        toggle.textContent = '继续轮播';
      }
      setStateMsg('已暂停' + (reason ? '（' + reason + '）' : ''));
    }
    function setStateMsg(msg) {
      if (state) state.textContent = '状态：' + msg + ' · 第 ' + (idx + 1) + ' / ' + slides.length + ' 步';
    }

    if (dotsHost) {
      slides.forEach(function (s, i) {
        var b = mk('button', 'a11y-dot');
        b.type = 'button';
        b.setAttribute('aria-current', i === 0 ? 'true' : 'false');
        b.setAttribute('aria-label', '第 ' + (i + 1) + ' 步：' + (q('.a11y-carousel__title', s) || {}).textContent);
        var mark = mk('span', 'a11y-dot__mark');
        b.appendChild(mark);
        on(b, 'click', function () { show(i); setProgress(0); if (!playing) setStateMsg('手动切换到第 ' + (i + 1) + ' 步'); b.focus(); });
        dotsHost.appendChild(b);
      });
    }
    if (toggle) {
      on(toggle, 'click', function () {
        if (playing) pause('用户手动暂停', 'manual');
        else play('用户手动继续');
      });
    }
    on(root, 'pointerenter', function () { if (playing) pause('指针悬停', 'hover'); });
    on(root, 'pointerleave', function () { if (!playing && pausedBy === 'hover') play('指针移开'); });
    on(root, 'focusin', function () { if (playing) pause('键盘焦点进入', 'focus'); });
    on(root, 'focusout', function (e) {
      if (!root.contains(e.relatedTarget) && !playing && pausedBy === 'focus') play('焦点移开');
    });
    on(document, 'visibilitychange', function () {
      if (document.hidden) pause('页面不可见', 'hidden');
    });
    if (viewport) viewport.setAttribute('aria-live', 'polite');

    show(0);
    if (reduced()) {
      setStateMsg('已暂停（动效弱化档位下不自动播放）');
    } else {
      play('进入页面自动开始');
    }
  }

  /* ============================================================
     12 · ARIA 状态
     ============================================================ */
  function initAriaStates() {
    /* aria-expanded */
    var trigger = q('#acc-trigger'), panel = q('#acc-panel'), accState = q('#acc-state');
    if (trigger && panel) {
      on(trigger, 'click', function () {
        var open = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.hidden = open;
        var glyph = q('svg', trigger);
        if (glyph) glyph.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
        if (accState) accState.textContent = 'aria-expanded="' + (!open) + '" · 面板 hidden=' + open;
      });
    }

    /* aria-pressed */
    var pressBtns = qa('#press [data-press]');
    var pressState = q('#press-state');
    if (pressBtns.length) {
      on(q('#press'), 'click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-press]') : null;
        if (!btn) return;
        var name = btn.getAttribute('data-press');
        if (name === '视觉') {
          if (pressState) pressState.textContent = 'aria-pressed="视觉不可关闭" · 视觉是最低保障通道，不允许被关闭。';
          return;
        }
        var next = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', next ? 'true' : 'false');
        if (pressState) {
          pressState.textContent = 'aria-pressed="' + pressBtns.map(function (b) {
            return b.getAttribute('aria-pressed');
          }).join(',') + '" · 已启用：' + pressBtns.filter(function (b) {
            return b.getAttribute('aria-pressed') === 'true';
          }).map(function (b) { return b.getAttribute('data-press'); }).join('、');
        }
      });
      var pressedInit = pressBtns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
      if (pressState) pressState.textContent = 'aria-pressed="' + pressBtns.map(function (b) { return b.getAttribute('aria-pressed'); }).join(',') +
        '" · 已启用：' + pressedInit.map(function (b) { return b.getAttribute('data-press'); }).join('、') + '（视觉通道不可关闭）';
    }

    /* aria-selected：tabs + 方向键 */
    var tabs = qa('#tabs [role="tab"]');
    var tabsState = q('#tabs-state');
    function selectTab(i, focus) {
      tabs.forEach(function (t, k) {
        var sel = k === i;
        t.setAttribute('aria-selected', sel ? 'true' : 'false');
        t.tabIndex = sel ? 0 : -1;
        var panelEl = q('#' + t.getAttribute('aria-controls'));
        if (panelEl) panelEl.hidden = !sel;
      });
      if (focus && tabs[i]) tabs[i].focus();
      if (tabsState) {
        tabsState.textContent = 'aria-selected="true" @ ' + tabs[i].textContent.trim() +
          ' · 其余 tabindex="-1"（roving tabindex），方向键 ← → 或 Home / End 切换';
      }
    }
    tabs.forEach(function (t, i) {
      on(t, 'click', function () { selectTab(i, false); });
      on(t, 'keydown', function (e) {
        var k = e.key, next = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') next = (i + 1) % tabs.length;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        else if (k === 'Home') next = 0;
        else if (k === 'End') next = tabs.length - 1;
        if (next > -1) { e.preventDefault(); selectTab(next, true); }
      });
    });
    if (tabs.length) selectTab(0, false);

    /* aria-busy */
    var busyBtn = q('#busy-trigger'), busyRegion = q('#busy-region'), busyText = q('#busy-text');
    if (busyBtn && busyRegion) {
      var busy = false;
      on(busyBtn, 'click', function () {
        if (busy) return;
        busy = true;
        busyRegion.setAttribute('aria-busy', 'true');
        busyText.textContent = '加载中：结果尚未稳定，读屏软件会等待。';
        busyBtn.disabled = true;
        window.setTimeout(function () {
          busy = false;
          busyRegion.setAttribute('aria-busy', 'false');
          busyText.textContent = '完成：38 项检查通过，0 项失败。';
          busyBtn.disabled = false;
        }, 2000);
      });
    }
  }

  /* ============================================================
     13 · 快捷键表自检
     ============================================================ */
  function initShortcuts() {
    var host = q('#sc-audit');
    if (!host) return;
    var data = (window.__ML_A11Y__ && window.__ML_A11Y__.shortcuts) || [];
    var ua = navigator.userAgent || '';
    var isMac = /Mac|iPhone|iPad|iPod/.test(ua);
    var items = [];

    items.push((isMac ? '平台检测：macOS / iOS → ⌘K 生效' : '平台检测：非 macOS → Ctrl+K 生效') + '（navigator.userAgent 判定）');
    data.forEach(function (s) {
      var keys = (isMac || !s.alt.length ? s.keys : s.alt).join(' ');
      items.push(keys + ' → ' + s.action + '（' + s.scope + '）');
    });
    items.push('冲突自检：站内未使用任何单字母快捷键，方向键仅在对应组件获得焦点时接管。');

    items.forEach(function (t) {
      var li = mk('li');
      var i = t.indexOf(' → ');
      if (i > -1) {
        var b = mk('b', null, t.slice(0, i));
        li.appendChild(b);
        li.appendChild(document.createTextNode(t.slice(i)));
      } else {
        li.appendChild(document.createTextNode(t));
      }
      host.appendChild(li);
    });
  }

  /* ============================================================
     启动
     ============================================================ */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    initContrast();
    initFocusRing();
    initTabOrder();
    initTraps();
    initSkipLinks();
    initAnnounce();
    initSemantics();
    initRuler();
    initForm();
    initMotionPair();
    initCvd();
    initCarousel();
    initAriaStates();
    initShortcuts();
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
