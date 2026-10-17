/* ============================================================
   展厅 I · 反馈系统 — 页面脚本
   仅使用 CONTRACT.md §3 的 ML API；内核缺失时降级为等价原生实现。
   ============================================================ */
(function () {
  'use strict';

  var MLx = window.ML || {};
  var FB = window.__ML_FB__ || {};

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
  function reduced() {
    if (typeof MLx.reduced === 'boolean') return MLx.reduced;
    return document.documentElement.getAttribute('data-motion') !== 'on';
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
    var s = size || 20;
    if (MLx.UI && typeof MLx.UI.icon === 'function') {
      try { return MLx.UI.icon(name, { size: s }); } catch (err) { /* 内联兜底 */ }
    }
    var paths = {
      info: 'M12 11v5M12 8h.01',
      'check-circle': 'm8 12.5 2.5 2.5L16 9.5',
      warning: 'M12 9v4M12 17h.01',
      'x-circle': 'M15 9l-6 6M9 9l6 6',
      undo: 'M3 3v6h6',
      volume: 'M11 5 6 9H2v6h4l5 4z',
      hand: 'M18 11V6.5a1.5 1.5 0 0 0-3 0V11',
      bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9'
    };
    var g = sv('svg', {
      viewBox: '0 0 24 24', width: s, height: s, fill: 'none', stroke: 'currentColor',
      'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
    });
    var p = sv('path', { d: paths[name] || paths.info });
    g.appendChild(p);
    if (name === 'info' || name === 'warning' || name === 'x-circle') {
      var c = sv('circle', { cx: 12, cy: 12, r: 9 });
      g.insertBefore(c, p);
    }
    return g;
  }
  function toast(opts) {
    if (MLx.UI && typeof MLx.UI.toast === 'function') return MLx.UI.toast(opts);
    return { el: mk('div', 'toast'), close: function () {} };
  }

  /* ============================================================
     01 · Toast 栈：自建队列 + 真实剩余时间
     ============================================================ */
  function initToastStack() {
    var fire = q('#fb-toast-fire'), burst = q('#fb-toast-burst'), clear = q('#fb-toast-clear');
    var status = q('#fb-toast-status'), tracks = q('#fb-tracks');
    var liveRows = q('#fb-live-val'), queueVal = q('#fb-queue-val'), slotVal = q('#fb-slot-val');
    var meterLive = q('#fb-meter-live'), meterQueue = q('#fb-meter-queue'), meterSlot = q('#fb-meter-slot');
    if (!fire) return;

    var MAX = 4;
    var plan = FB.toastPlan || [{ variant: 'info', title: '提示', desc: '', duration: 4000 }];
    var planIdx = 0;
    var live = [];
    var queue = [];
    var rows = {};
    var rafId = 0;
    var seq = 0;

    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

    function rowFor(rec) {
      var row = mk('div', 'fb-trackline');
      var name = mk('span', null, rec.plan.variant);
      var bar = mk('span', 'fb-trackline__bar');
      var fill = mk('span', 'fb-trackline__fill fb-trackline__fill--' + rec.plan.variant);
      bar.appendChild(fill);
      var val = mk('span', null, '—');
      row.appendChild(name); row.appendChild(bar); row.appendChild(val);
      return { root: row, fill: fill, val: val };
    }

    function spawn(rec) {
      var plan = rec.plan;
      var handle = toast({ title: plan.title, desc: plan.desc, variant: plan.variant, duration: plan.duration });
      rec.el = handle.el;
      rec.close = handle.close;
      rec.created = now();
      rec.pausedTotal = 0;
      rec.pausedAt = 0;
      live.push(rec);
      if (tracks) {
        var hint = q('.fb-note', tracks);
        if (hint && !live.length) hint.remove();
        rows[rec.id] = rowFor(rec);
        tracks.appendChild(rows[rec.id].root);
      }
    }

    function requestPush() {
      var planSpec = plan[planIdx % plan.length];
      planIdx += 1;
      seq += 1;
      var rec = { id: 't' + seq, plan: planSpec, queued: true };
      if (live.length >= MAX) {
        queue.push(rec);
        if (status) status.textContent = '已有 ' + live.length + ' 条在屏上（达到上限 ' + MAX + '），第 ' + seq + ' 条进入队列等待空位。';
      } else {
        spawn(rec);
        rec.queued = false;
        if (status) status.textContent = '已推送第 ' + seq + ' 条：' + planSpec.title + '（' + planSpec.duration + 'ms 后自动消失）。';
      }
      render();
    }

    function flush() {
      while (live.length < MAX && queue.length) {
        var rec = queue.shift();
        rec.queued = false;
        spawn(rec);
        if (status) status.textContent = '队列出队：' + rec.plan.title + ' 补上空位。';
      }
    }

    function tick() {
      var t = now();
      var alive = [];
      live.forEach(function (rec) {
        if (!rec.el || !rec.el.isConnected) {
          if (rows[rec.id]) { rows[rec.id].root.remove(); delete rows[rec.id]; }
          return;
        }
        alive.push(rec);
        var hovering = rec.el.matches(':hover') || rec.el.contains(document.activeElement);
        if (hovering && !rec.pausedAt) rec.pausedAt = t;
        if (!hovering && rec.pausedAt) { rec.pausedTotal += t - rec.pausedAt; rec.pausedAt = 0; }
        var spent = t - rec.created - rec.pausedTotal - (rec.pausedAt ? t - rec.pausedAt : 0);
        var left = Math.max(0, rec.duration - spent);
        var ratio = left / rec.duration;
        var row = rows[rec.id];
        if (row) {
          row.fill.style.setProperty('--fb-left', String(ratio));
          row.val.textContent = hovering ? '暂停 ' + Math.round(left) + 'ms' : Math.round(left) + 'ms';
        }
      });
      var changed = alive.length !== live.length;
      live = alive;
      if (live.length < MAX && queue.length) { flush(); changed = true; }
      if (changed || live.length) render();
      rafId = window.requestAnimationFrame(tick);
    }

    function render() {
      var n = live.length, qn = queue.length;
      if (liveRows) liveRows.textContent = n + ' / ' + MAX;
      if (queueVal) queueVal.textContent = String(qn);
      if (slotVal) slotVal.textContent = String(MAX - n);
      if (meterLive) meterLive.style.setProperty('--progress', String(n / MAX));
      if (meterQueue) meterQueue.style.setProperty('--progress', String(Math.min(1, qn / MAX)));
      if (meterSlot) meterSlot.style.setProperty('--progress', String((MAX - n) / MAX));
      if (tracks && !n && !qn) {
        if (!q('.fb-note', tracks)) tracks.appendChild(mk('p', 'fb-note', '还没有 toast。推送后用 Tab 走一遍 toast 上的关闭按钮，倒计时会停住。'));
      }
    }

    on(fire, 'click', requestPush);
    if (burst) on(burst, 'click', function () {
      for (var i = 0; i < 6; i++) requestPush();
      if (status) status.textContent = '已一次性请求 6 条：4 条上屏、2 条排队。把指针移到 toast 上可以验证倒计时暂停。';
    });
    if (clear) on(clear, 'click', function () {
      live.slice().forEach(function (rec) { if (rec.close) rec.close(); });
      queue.length = 0;
      Object.keys(rows).forEach(function (k) { rows[k].root.remove(); delete rows[k]; });
      live = [];
      if (status) status.textContent = '已关闭全部 toast，队列清空。';
      render();
    });

    render();
    rafId = window.requestAnimationFrame(tick);
  }

  /* ============================================================
     02 · aria-live 播报
     ============================================================ */
  var ANNOUNCE = {
    info: '信息：草稿已自动保存，10:24 更新。',
    success: '成功：构建 #412 已通过全部 38 项检查。',
    warning: '警告：3 张图片缺少替代文本，发布前需要处理。',
    danger: '错误：构建 #410 失败，第 2 步类型检查未通过。'
  };
  function initAnnounce() {
    var caption = q('#fb-caption'), hist = q('#fb-caption-hist'), count = q('#fb-ann-count');
    var polite = q('#fb-live-polite'), assertive = q('#fb-live-assertive');
    var n = 0, list = [];
    qa('[data-fb-announce]').forEach(function (btn) {
      on(btn, 'click', function () {
        var kind = btn.getAttribute('data-fb-kind');
        var level = btn.getAttribute('data-fb-announce');
        var msg = ANNOUNCE[kind] || ANNOUNCE.info;
        var region = level === 'assertive' ? assertive : polite;
        if (region) {
          region.textContent = '';
          window.setTimeout(function () { region.textContent = msg; }, 30);
        }
        n += 1;
        list.unshift('[' + level + '] ' + msg);
        list = list.slice(0, 5);
        if (caption) caption.textContent = msg + '　［role="' + (level === 'assertive' ? 'alert' : 'status') + '" · ' + level + '］';
        if (hist) {
          hist.textContent = '';
          list.forEach(function (t) { hist.appendChild(mk('li', null, t)); });
        }
        if (count) count.textContent = '播报次数：' + n;
      });
    });
    var clear = q('#fb-ann-clear');
    if (clear) on(clear, 'click', function () {
      if (caption) caption.textContent = '';
      if (polite) polite.textContent = '';
      if (assertive) assertive.textContent = '';
      clear.focus();
    });
  }

  /* ============================================================
     03 · 内联横幅
     ============================================================ */
  function initBanners() {
    var host = q('#fb-banners'), reset = q('#fb-banner-reset'), count = q('#fb-banner-count');
    if (!host) return;
    var data = FB.banners || [];
    function build() {
      host.textContent = '';
      data.forEach(function (b, i) {
        var el = mk('div', 'fb-banner fb-banner--' + b.variant);
        el.setAttribute('role', b.variant === 'danger' ? 'alert' : 'status');
        var ic = mk('span', 'fb-banner__icon');
        ic.appendChild(iconEl(b.variant === 'info' ? 'info' : b.variant === 'success' ? 'check-circle' : b.variant === 'warning' ? 'warning' : 'x-circle', 20));
        var body = mk('div');
        body.appendChild(mk('p', 'fb-banner__title', b.title));
        body.appendChild(mk('p', 'fb-banner__text', b.text));
        var close = mk('button', 'fb-banner__close');
        close.type = 'button';
        close.setAttribute('aria-label', '关闭' + b.title + '横幅');
        close.appendChild(iconEl('close', 18));
        el.appendChild(ic); el.appendChild(body); el.appendChild(close);
        on(close, 'click', function () {
          el.classList.add('is-leaving');
          var delay = reduced() ? 0 : 240;
          window.setTimeout(function () {
            el.hidden = true;
            el.classList.remove('is-leaving');
            updateCount();
          }, delay);
        });
        host.appendChild(el);
        if (i === 0) el.setAttribute('data-first', 'true');
      });
      updateCount();
    }
    function updateCount() {
      var n = qa('.fb-banner', host).filter(function (el) { return !el.hidden; }).length;
      if (count) count.textContent = '当前 ' + n + ' 条';
    }
    if (reset) on(reset, 'click', function () { build(); reset.focus(); });
    build();
  }

  /* ============================================================
     04 · 工具提示 4 方向
     ============================================================ */
  function initTooltips() {
    var TEXTS = {
      top: '上方提示：这个按钮会立即发布到预览环境，不需要再次确认。',
      right: '右侧提示：发布不会影响已经在线的正式环境。',
      bottom: '下方提示：发布记录会保留 30 天，可以在历史里回滚。',
      left: '左侧提示：需要至少一次通过的构建才能发布。'
    };
    var grid = q('#fb-tipgrid');
    if (!grid) return;
    var status = q('#fb-tip-status');
    qa('[data-tip-placement]', grid).forEach(function (btn) {
      var place = btn.getAttribute('data-tip-placement');
      var out = q('#' + btn.id + '-out');
      var text = TEXTS[place] || '提示内容';
      if (MLx.UI && typeof MLx.UI.tooltip === 'function') {
        try { MLx.UI.tooltip(btn, text, { placement: place }); } catch (err) { /* 忽略，页面仍有文字说明 */ }
      }
      on(btn, 'focus', function () {
        if (out) out.textContent = '已聚焦 · ' + place;
        if (status) status.textContent = '焦点在「' + btn.textContent.trim() + '」：提示以 ' + place + ' 方向显示，aria-describedby 已接线。';
      });
      on(btn, 'pointerenter', function () {
        if (status) status.textContent = '指针进入「' + btn.textContent.trim() + '」：同样是 ' + place + ' 方向。鼠标与键盘走的是同一条提示路径。';
      });
    });
  }

  /* ============================================================
     05 · 弹出层自动翻转
     ============================================================ */
  function initFlip() {
    var anchor = q('#fb-flip-anchor'), openBtn = q('#fb-flip-open'), closeBtn = q('#fb-flip-close');
    var pref = q('#fb-flip-pref'), readout = q('#fb-flip-readout'), log = q('#fb-flip-log');
    if (!anchor) return;
    var handle = null;

    function closePop() {
      if (handle && handle.close) handle.close();
      handle = null;
      if (readout) readout.textContent = '已关闭';
    }

    function open() {
      closePop();
      var placement = pref ? pref.value : 'bottom-start';
      var content = mk('div', 'fb-popover-body');
      content.appendChild(mk('p', null, '弹出层内容：这里的说明不会被视口裁掉，因为空间不足时会自动翻转。'));
      var ul = mk('ul', 'fb-popover-list');
      ul.appendChild(mk('li', null, '偏好方向：' + placement));
      ul.appendChild(mk('li', null, '关闭方式：Esc、点击弹层外部或点"关闭"按钮'));
      content.appendChild(ul);

      if (MLx.UI && typeof MLx.UI.popover === 'function') {
        handle = MLx.UI.popover(anchor, content, { placement: placement });
      } else {
        var box = mk('div', 'popover');
        box.appendChild(content);
        document.body.appendChild(box);
        var r = anchor.getBoundingClientRect();
        box.style.position = 'fixed';
        box.style.top = (r.bottom + 8) + 'px';
        box.style.left = r.left + 'px';
        handle = { el: box, close: function () { box.remove(); } };
      }

      var el = handle && handle.el;
      window.setTimeout(function () {
        if (!el) return;
        var pr = el.getBoundingClientRect();
        var ar = anchor.getBoundingClientRect();
        var actual;
        if (pr.top >= ar.bottom - 2) actual = 'bottom';
        else if (pr.bottom <= ar.top + 2) actual = 'top';
        else if (pr.left >= ar.right - 2) actual = 'right';
        else if (pr.right <= ar.left + 2) actual = 'left';
        else actual = 'overlap';
        var flipped = placement.split('-')[0] !== actual;
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var spaceBelow = vh - ar.bottom;
        var spaceAbove = ar.top;
        if (readout) readout.textContent = '实际落位：' + actual + (flipped ? '（已翻转）' : '（与偏好一致）');
        if (log) {
          log.textContent = [
            '偏好方向：' + placement,
            '锚点 rect：top ' + Math.round(ar.top) + ' · bottom ' + Math.round(ar.bottom) + ' · left ' + Math.round(ar.left),
            '锚点下方可用空间：' + Math.round(spaceBelow) + 'px　上方可用空间：' + Math.round(spaceAbove) + 'px',
            '弹层 rect：top ' + Math.round(pr.top) + ' · bottom ' + Math.round(pr.bottom) + ' · height ' + Math.round(pr.height),
            '实测结论：实际显示在锚点的' + (actual === 'top' ? '上方' : actual === 'bottom' ? '下方' : actual === 'right' ? '右侧' : actual === 'left' ? '左侧' : '覆盖位置') + '。',
            flipped
              ? '翻转原因：偏好方向 ' + placement + ' 的可用空间不足，引擎把它翻到了 ' + actual + '。'
              : '无需翻转：偏好方向的可用空间足够。'
          ].join('\n');
        }
      }, 30);
    }

    on(anchor, 'click', open);
    if (openBtn) on(openBtn, 'click', function () { open(); if (pref) pref.focus(); });
    if (closeBtn) on(closeBtn, 'click', function () { closePop(); closeBtn.focus(); });
  }

  /* ============================================================
     06 · 确认对话框 / 对话框 / 抽屉
     ============================================================ */
  function initDialogs() {
    var log = q('#fb-dialog-log');
    var danger = q('#fb-confirm-danger'), openDlg = q('#fb-dialog-open'), openDrawer = q('#fb-drawer-open');

    function record(trigger, action) {
      var back = document.activeElement;
      var name = back && (back.textContent ? back.textContent.trim().slice(0, 16) : back.tagName);
      var lines = (log ? log.textContent : '').split('\n').filter(function (l) { return l && l.indexOf('尚未') === -1; });
      lines.unshift('[' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '] ' + trigger + ' → ' + action +
        '；关闭后 document.activeElement = 「' + name + '」' + (back === trigger ? '（已正确还原到触发按钮）' : ''));
      if (log) log.textContent = lines.slice(0, 5).join('\n');
    }

    if (danger && MLx.UI && typeof MLx.UI.confirm === 'function') {
      on(danger, 'click', function () {
        MLx.UI.confirm({
          title: '删除项目 Atlas？',
          desc: '该项目的 128 次构建记录、4 个环境变量与全部部署历史都会被永久删除，无法恢复。',
          confirmText: '永久删除',
          danger: true
        }).then(function (ok) {
          record(danger, ok ? '确认删除' : '取消删除');
        });
      });
    }
    if (openDlg && MLx.UI && typeof MLx.UI.dialog === 'function') {
      on(openDlg, 'click', function () {
        var body = mk('div');
        body.appendChild(mk('p', null, '这是一个普通对话框。请按 Tab 绕一圈：焦点不会跑到页面背景上；按 Esc 可以直接关掉它。'));
        var tips = mk('ul');
        ['焦点锁定在对话框内，Tab 与 Shift+Tab 循环。', 'Esc 关闭并把焦点还给触发按钮。', '背景滚动被锁定，并补偿滚动条宽度。'].forEach(function (t) {
          var li = mk('li', null, t);
          tips.appendChild(li);
        });
        body.appendChild(tips);
        var h = MLx.UI.dialog({
          title: '对话框：焦点锁定验证',
          body: body,
          size: 'sm',
          actions: [
            { label: '知道了', variant: 'primary', onClick: function () { record(openDlg, '点击「知道了」关闭'); } },
            { label: '稍后再说', onClick: function () { record(openDlg, '点击「稍后再说」关闭'); } }
          ]
        });
        if (h && h.open) h.open();
        var box = h && h.el ? q('.modal__box', h.el) : null;
        if (box) box.setAttribute('data-fb-focus-trap', 'true');
      });
    }
    if (openDrawer && MLx.UI && typeof MLx.UI.drawer === 'function') {
      on(openDrawer, 'click', function () {
        var content = mk('div');
        content.appendChild(mk('p', null, '抽屉与对话框共享同一套焦点管理，但方向上从侧边进入，空间更宽松。'));
        var h = MLx.UI.drawer({ title: '抽屉：从侧边进入', side: 'right', content: content });
        if (h && h.open) h.open();
        record(openDrawer, '打开抽屉');
      });
    }
    if (!(MLx.UI && MLx.UI.confirm) && log) {
      log.textContent = '内核浮层组件尚未就绪：本 demo 的触发按钮仍可聚焦，但不会打开对话框。';
    }
  }

  /* ============================================================
     07 · 进度条
     ============================================================ */
  function initProgress() {
    var run = q('#fb-prog-run'), reset = q('#fb-prog-reset'), bar = q('#fb-prog-bar');
    var readout = q('#fb-prog-readout'), role = q('#fb-prog'), list = q('#fb-prog-list');
    var TOTAL = 12, idx = 0, rafId = 0, last = 0, part = 0, running = false;

    var items = ['tokens.css', 'motion.css', 'site.css', 'motion.js', 'ui.js', 'site.js',
      'feedback.css', 'feedback.js', 'accessibility.css', 'accessibility.js', 'data-viz.css', 'design-system.js'];

    function paintList() {
      if (!list) return;
      list.textContent = '';
      items.forEach(function (name, i) {
        var row = mk('div', 'fb-trackline');
        row.appendChild(mk('span', null, name));
        var b = mk('span', 'fb-trackline__bar');
        var f = mk('span', 'fb-trackline__fill' + (i < idx ? ' fb-trackline__fill--success' : ''));
        b.appendChild(f);
        f.style.setProperty('--fb-left', String(i < idx ? 1 : i === idx ? part : 0));
        row.appendChild(b);
        row.appendChild(mk('span', null, i < idx ? '完成' : i === idx ? '进行中' : '排队'));
        list.appendChild(row);
      });
    }

    function paint() {
      var p = (idx + part) / TOTAL;
      if (bar) bar.style.setProperty('--progress', String(p));
      if (role) role.setAttribute('aria-valuenow', String(Math.min(TOTAL, Math.round(idx + part))));
      if (readout) readout.textContent = Math.min(TOTAL, Math.round(idx + part)) + ' / ' + TOTAL + ' · ' + Math.round(p * 100) + '%';
    }

    function step(ts) {
      if (!running) return;
      if (!last) last = ts;
      var dt = ts - last;
      last = ts;
      part += dt / 260;
      while (part >= 1 && idx < TOTAL) { part -= 1; idx += 1; }
      if (idx >= TOTAL) {
        idx = TOTAL; part = 0; running = false;
        paint(); paintList();
        if (readout) readout.textContent = TOTAL + ' / ' + TOTAL + ' · 100% · 完成';
        toast({ title: '上传完成', desc: '12 个文件全部上传成功。', variant: 'success', duration: 4000 });
        return;
      }
      paint(); paintList();
      rafId = window.requestAnimationFrame(step);
    }

    if (run) on(run, 'click', function () {
      if (running) return;
      if (idx >= TOTAL) { idx = 0; part = 0; }
      running = true; last = 0;
      rafId = window.requestAnimationFrame(step);
    });
    if (reset) on(reset, 'click', function () {
      running = false;
      window.cancelAnimationFrame(rafId);
      idx = 0; part = 0; last = 0;
      paint(); paintList();
      reset.focus();
    });
    paint(); paintList();

    /* 不确定进度 */
    var ind = q('#fb-ind'), indRun = q('#fb-ind-run'), indStatus = q('#fb-ind-status');
    if (indRun && ind) {
      on(indRun, 'click', function () {
        var onNow = indRun.getAttribute('aria-pressed') !== 'true';
        indRun.setAttribute('aria-pressed', onNow ? 'true' : 'false');
        indRun.textContent = onNow ? '停止' : '开始 / 停止';
        ind.hidden = !onNow;
        if (indStatus) {
          indStatus.textContent = onNow
            ? '当前：进行中。这个 progressbar 没有 aria-valuenow —— 因为进度确实未知，写一个假数字比不写更糟。'
            : '当前：空闲。';
        }
      });
    }
  }

  /* ============================================================
     08 · 成功反馈（勾选绘制）
     ============================================================ */
  function initSuccess() {
    var svg = q('#fb-success-svg'), circle = q('#fb-success-circle'), mark = q('#fb-success-mark');
    var run = q('#fb-success-run'), copy = q('#fb-success-copy'), title = q('#fb-success-title'), desc = q('#fb-success-desc');
    if (!circle || !mark) return;
    var circ = 0, markLen = 0;
    try { circ = circle.getTotalLength ? circle.getTotalLength() : 2 * Math.PI * 38; } catch (e) { circ = 2 * Math.PI * 38; }
    try { markLen = mark.getTotalLength ? mark.getTotalLength() : 52; } catch (e) { markLen = 52; }

    function final() {
      circle.setAttribute('stroke-dasharray', String(circ));
      circle.setAttribute('stroke-dashoffset', '0');
      mark.setAttribute('stroke-dasharray', String(markLen));
      mark.setAttribute('stroke-dashoffset', '0');
    }
    function play() {
      if (reduced()) { final(); return; }
      circle.setAttribute('stroke-dasharray', String(circ));
      circle.setAttribute('stroke-dashoffset', String(circ));
      mark.setAttribute('stroke-dasharray', String(markLen));
      mark.setAttribute('stroke-dashoffset', String(markLen));
      var t0 = null, ringMs = 360, markMs = 260, gap = 200;
      window.requestAnimationFrame(function step(ts) {
        if (t0 === null) t0 = ts;
        var el = ts - t0;
        var p1 = Math.min(1, el / ringMs);
        var e1 = 1 - Math.pow(1 - p1, 5);
        circle.setAttribute('stroke-dashoffset', String(circ * (1 - e1)));
        var p2 = Math.min(1, Math.max(0, (el - gap) / markMs));
        var e2 = 1 - Math.pow(1 - p2, 5);
        mark.setAttribute('stroke-dashoffset', String(markLen * (1 - e2)));
        if (p1 < 1 || p2 < 1) window.requestAnimationFrame(step);
      });
    }
    if (run) on(run, 'click', play);
    if (copy) on(copy, 'click', function () {
      var text = '构建 #412';
      if (MLx.copy) {
        MLx.copy(text).then(function () {
          if (title) title.textContent = '构建号已复制';
          if (desc) desc.textContent = text + ' · 剪贴板写入成功';
        });
      } else if (title) {
        title.textContent = '构建号：#412（内核未就绪，未写入剪贴板）';
      }
    });
    if (reduced()) final(); else play();
  }

  /* ============================================================
     09 · 错误恢复
     ============================================================ */
  function initRecover() {
    var retry = q('#fb-recover-retry'), edit = q('#fb-recover-edit'), help = q('#fb-recover-help');
    var helpBox = q('#fb-recover-helpbox'), status = q('#fb-recover-status'), meta = q('#fb-recover-meta');
    var input = q('#fb-recover-input'), field = q('#fb-recover-field'), msg = q('#fb-recover-error-msg');
    var tries = 1;
    if (retry) on(retry, 'click', function () {
      tries += 1;
      var backoff = Math.pow(2, tries - 1) * 400;
      if (meta) meta.textContent = '错误 ID err-2024-11-08-7741 · 时间 10:24:38 · 已重试 ' + tries + ' 次（下次退避 ' + backoff + 'ms）';
      if (status) status.textContent = '第 ' + tries + ' 次重试已发出，退避 ' + backoff + 'ms。注意：409 属于"重试也不会好"的错误，重试的价值在于确认状态没有变化。';
      if (tries >= 4) {
        if (status) status.textContent = '已重试 4 次仍失败。正确做法是停止自动重试，转向"编辑"或"帮助"路径——无上限的自动重试只会浪费用户的时间。';
        if (edit) edit.focus();
      }
    });
    if (edit) on(edit, 'click', function () {
      if (input) {
        input.focus();
        input.select();
      }
      if (status) status.textContent = '焦点已移到出错字段并全选原值，用户可以直接输入新名称，不需要自己找输入框。';
    });
    if (help) on(help, 'click', function () {
      var open = help.getAttribute('aria-expanded') === 'true';
      help.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (helpBox) helpBox.hidden = open;
      if (status) status.textContent = open ? '帮助说明已收起。' : '帮助说明已展开：409 是服务端冲突，不是网络问题。';
    });
    if (input) on(input, 'input', function () {
      var ok = /^[a-z0-9-]+$/.test(input.value.trim()) && input.value.trim() !== 'atlas';
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (field) field.classList.toggle('field--invalid', !ok);
      if (msg) msg.hidden = ok;
      if (ok && status) status.textContent = '名称可用，可以再次提交（错误已清除）。';
    });
  }

  /* ============================================================
     10 · 通知中心
     ============================================================ */
  function initNotify() {
    var bell = q('#fb-bell'), count = q('#fb-bell-count'), readout = q('#fb-bell-readout');
    var listEl = q('#fb-notify-list'), empty = q('#fb-notify-empty');
    var readAll = q('#fb-notify-readall'), resetBtn = q('#fb-notify-reset'), addBtn = q('#fb-notify-add');
    if (!listEl) return;
    var data = (FB.notifications || []).map(function (n) { return Object.assign({}, n); });

    function unread() { return data.filter(function (n) { return !n.read; }).length; }

    function render() {
      listEl.textContent = '';
      data.forEach(function (n) {
        var li = mk('li', 'fb-notify__item');
        li.setAttribute('data-read', n.read ? 'true' : 'false');
        var dot = mk('span', 'fb-notify__dot');
        dot.setAttribute('aria-hidden', 'true');
        var body = mk('div');
        body.appendChild(mk('p', 'fb-notify__title', n.title));
        body.appendChild(mk('p', 'fb-notify__desc', n.desc + ' · ' + n.variant));
        var right = mk('div');
        right.appendChild(mk('span', 'fb-notify__time', n.time));
        right.appendChild(mk('span', 'fb-notify__state', n.read ? '已读' : '未读'));
        li.appendChild(dot); li.appendChild(body); li.appendChild(right);
        on(li, 'click', function () { n.read = true; render(); });
        listEl.appendChild(li);
      });
      var u = unread();
      if (bell) {
        bell.setAttribute('data-unread', u > 0 ? 'true' : 'false');
        bell.setAttribute('aria-label', u > 0 ? '通知中心，' + u + ' 条未读' : '通知中心，全部已读');
      }
      if (count) count.textContent = u > 9 ? '9+' : String(u);
      if (readout) readout.textContent = '未读 ' + u + ' 条 · 共 ' + data.length + ' 条';
      if (empty) empty.hidden = !(data.length === 0 || u === 0);
      listEl.hidden = data.length === 0;
    }

    if (bell) on(bell, 'click', function () {
      var open = bell.getAttribute('aria-expanded') === 'true';
      bell.setAttribute('aria-expanded', open ? 'false' : 'true');
      bell.setAttribute('aria-label', (open ? '展开' : '收起') + '通知中心');
    });
    if (readAll) on(readAll, 'click', function () {
      data.forEach(function (n) { n.read = true; });
      render();
      readAll.focus();
    });
    if (resetBtn) on(resetBtn, 'click', function () {
      data = (FB.notifications || []).map(function (n) { return Object.assign({}, n); });
      render();
      resetBtn.focus();
    });
    if (addBtn) on(addBtn, 'click', function () {
      data.unshift({
        id: 'n' + (data.length + 1), title: '新的构建已排队', desc: 'main 分支 · 等待可用执行器',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        read: false, variant: 'info'
      });
      render();
      addBtn.focus();
    });
    render();
  }

  /* ============================================================
     11 · 撤销 toast
     ============================================================ */
  function initUndo() {
    var del = q('#fb-undo-delete'), restore = q('#fb-undo-restore'), status = q('#fb-undo-status');
    var list = q('#fb-undo-list'), timer = q('#fb-undo-timer');
    if (!list) return;
    var items = [
      { id: 'p1', name: '项目 Atlas', note: '128 次构建' },
      { id: 'p2', name: '项目 Beacon', note: '41 次构建' },
      { id: 'p3', name: '项目 Cobalt', note: '7 次构建' }
    ];
    var deleted = [];
    var pending = null;

    function render() {
      list.textContent = '';
      items.concat(deleted).forEach(function (it) {
        var li = mk('li', 'fb-undo__item');
        li.setAttribute('data-state', it.deleted ? 'deleted' : 'active');
        li.appendChild(mk('span', 'fb-undo__stamp', it.deleted ? '已删除' : '在列表中'));
        li.appendChild(mk('span', null, it.name + ' · ' + it.note));
        li.appendChild(mk('span', 'fb-undo__stamp', it.id));
        list.appendChild(li);
      });
      if (status) status.textContent = '当前 ' + items.length + ' 个项目，' + deleted.length + ' 个已删除。';
    }

    if (del) on(del, 'click', function () {
      var it = items.shift();
      if (!it) {
        if (status) status.textContent = '没有可删除的项目了——用「恢复全部」重置。';
        return;
      }
      it.deleted = true;
      deleted.push(it);
      render();
      pending = it;
      var t0 = Date.now();
      var WINDOW_MS = 9000;
      toast({
        title: '已删除「' + it.name + '」',
        desc: '9 秒内可以撤销；这条提示比其他 toast 活得久。',
        variant: 'warning',
        duration: WINDOW_MS,
        action: {
          label: '撤销删除',
          onClick: function () {
            var i = deleted.indexOf(it);
            if (i > -1) deleted.splice(i, 1);
            it.deleted = false;
            items.push(it);
            render();
            if (timer) timer.textContent = '撤销窗口：已撤销，项目回到列表（用时 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）。';
          }
        }
      });
      if (timer) timer.textContent = '撤销窗口：已开启，剩余 ' + (WINDOW_MS / 1000) + ' 秒（悬停或聚焦 toast 会暂停）。';
    });

    if (restore) on(restore, 'click', function () {
      items = items.concat(deleted);
      deleted = [];
      render();
      restore.focus();
    });
    render();
  }

  /* ============================================================
     12 · 通道偏好
     ============================================================ */
  function initChannels() {
    var sound = q('#ch-sound'), haptic = q('#ch-haptic'), test = q('#fb-haptic-test');
    var soundChip = q('#ch-sound-chip'), hapticChip = q('#ch-haptic-chip');
    var log = q('#fb-channel-log'), announceBtn = q('#fb-channel-announce');
    if (!sound || !haptic) return;

    var canVibrate = !!(navigator && typeof navigator.vibrate === 'function');
    var lines = [
      '视觉通道：始终开启（必需）。',
      '声音通道：本页不加载任何音频资源（全站零外部请求），仅演示开关状态与 aria 接线。',
      '触觉通道：navigator.vibrate ' + (canVibrate ? '可用' : '不可用') +
        '（检测方式：typeof navigator.vibrate === "function"；桌面浏览器与 iOS Safari 通常为不可用）。',
      '当前 userAgent 片段：' + String(navigator.userAgent || '').slice(0, 60)
    ];
    if (log) log.textContent = lines.join('\n');

    function sync() {
      if (soundChip) soundChip.textContent = sound.checked ? '开启' : '关闭';
      if (hapticChip) {
        hapticChip.textContent = !canVibrate ? '本机不支持' : haptic.checked ? '开启' : '关闭';
      }
      if (haptic && !canVibrate) haptic.disabled = true;
    }
    on(sound, 'change', sync);
    on(haptic, 'change', sync);
    sync();

    if (test) on(test, 'click', function () {
      var msg;
      if (!canVibrate) msg = '本机不支持 navigator.vibrate（检测结果：undefined），因此没有任何反应——这正是"触觉不能作为唯一反馈"的原因。';
      else if (!haptic.checked) msg = '触觉通道当前是关闭的，所以不会震动。请先打开上面的开关。';
      else { navigator.vibrate(30); msg = '已调用 navigator.vibrate(30)。如果设备支持，你会感到一次 30ms 的轻震。'; }
      if (log) log.textContent = lines.join('\n') + '\n\n最近一次测试：' + msg;
    });

    if (announceBtn) on(announceBtn, 'click', function () {
      var channels = ['视觉'];
      if (sound.checked) channels.push('声音');
      if (haptic.checked && canVibrate) channels.push('触觉');
      toast({
        title: '发布成功',
        desc: '本次反馈通过 ' + channels.join(' + ') + ' 通道发出。',
        variant: 'success',
        duration: 4200
      });
      if (log) log.textContent = lines.join('\n') + '\n\n最近一次反馈：使用通道 = ' + channels.join('、') +
        '。注意无论开关如何，视觉通道都会同时给出文字与图标。';
    });
  }

  /* ============================================================
     启动
     ============================================================ */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    initToastStack();
    initAnnounce();
    initBanners();
    initTooltips();
    initFlip();
    initDialogs();
    initProgress();
    initSuccess();
    initRecover();
    initNotify();
    initUndo();
    initChannels();
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
