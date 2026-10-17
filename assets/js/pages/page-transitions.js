/* ============================================================================
   展厅 D · 页面转场 —— 页面脚本
   只使用 CONTRACT.md §3 的 ML.* API；无网络请求；无 console 输出。
   ========================================================================== */
(function () {
  'use strict';

  function soft() {
    return ML.motion.get() !== 'on';
  }

  function canVT() {
    return typeof document.startViewTransition === 'function' && !soft();
  }

  function text(el, value) {
    if (el) el.textContent = value;
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function overlayHost() {
    return document.getElementById('site-overlays') || document.body;
  }

  function ms(v) {
    return Math.round(v);
  }

  /* ==========================================================================
     01 跨文档 View Transitions
     ========================================================================== */
  function initCrossDoc() {
    var dirOut = ML.q('[data-pt-dir]');
    var depthOut = ML.q('[data-pt-depth]');
    var backBtn = ML.q('[data-pt-back]');
    var sameBtn = ML.q('[data-pt-same]');
    var swap = ML.q('[data-pt-swap]');
    var support = ML.q('[data-pt-support]');

    function depth() {
      try {
        var raw = window.localStorage.getItem('ml-nav-depth');
        var n = parseInt(raw === null ? '0' : raw, 10);
        return isNaN(n) ? 0 : n;
      } catch (err) {
        return 0;
      }
    }

    function paint() {
      var dir = document.documentElement.getAttribute('data-nav-dir') || 'forward';
      text(dirOut, dir === 'back'
        ? 'back（退回：新页面自左滑入，旧页向右退出）'
        : 'forward（默认：新页面自右滑入，旧页向左退出）');
      text(depthOut, String(depth()));
    }

    /* 内核在 document 上委托标记方向；我们在同一轮事件后读取结果 */
    ML.on(document, 'click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!link) return;
      window.setTimeout(paint, 0);
    });
    ML.on(window, 'popstate', function () { window.setTimeout(paint, 0); });

    if (backBtn) {
      ML.on(backBtn, 'click', function () {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          ML.UI.toast({ title: '没有上一页', desc: '这是本次会话打开的第一个页面。', variant: 'info', duration: 2600 });
        }
      });
    }

    if (sameBtn && swap) {
      ML.on(sameBtn, 'click', function () {
        var toB = swap.getAttribute('data-i') !== 'b';
        var next = toB
          ? 'B 版内容：这是 startViewTransition 捕获的"新"状态——旧内容此刻已经开始淡出，新内容从下方 8px 处进入。'
          : 'A 版内容：点击按钮，观察同文档阶段旧内容如何退出、新内容如何进入。';
        var run = function () {
          swap.setAttribute('data-i', toB ? 'b' : 'a');
          swap.textContent = next;
        };
        if (canVT()) {
          swap.style.viewTransitionName = 'pt-swap-area';
          var t = document.startViewTransition(run);
          t.finished.finally(function () { swap.style.viewTransitionName = ''; });
        } else {
          swap.classList.add('is-fading');
          window.setTimeout(function () {
            run();
            swap.classList.remove('is-fading');
          }, soft() ? 0 : 160);
        }
      });
    }

    if (support) {
      /* onpagereveal 是 @view-transition（跨文档）的特性探测点 */
      support.setAttribute('data-cross', 'onpagereveal' in window ? 'on' : 'off');
    }

    paint();
  }

  /* ==========================================================================
     02 共享元素：卡片 → 详情
     ========================================================================== */
  function initShared() {
    var host = ML.q('[data-pt-cards]');
    var cards = ML.qa('[data-pt-card]');
    if (!host || !cards.length) return;
    var stateOut = ML.q('[data-pt-card-state]');
    var countOut = ML.q('[data-pt-card-count]');
    var NAME = 'pt-hero';
    var holder = null;
    var openOverlay = null;

    /* 同一页内同名元素只能有一个，否则整段过渡静默失效 —— 这里做硬保护 */
    function setName(el) {
      if (holder && holder !== el) holder.style.viewTransitionName = '';
      holder = el;
      if (el) el.style.viewTransitionName = NAME;
      text(countOut, el ? '1' : '0');
    }

    function build(card) {
      var title = card.getAttribute('data-title') || '详情';
      var body = card.getAttribute('data-body') || '';
      var overlay = ML.create('div', { class: 'pt-overlay' });
      var scrim = ML.create('button', { class: 'pt-overlay__scrim', type: 'button', 'aria-label': '关闭详情，返回列表' });
      var sheet = ML.create('div', { class: 'pt-sheet' + (canVT() ? ' is-vt' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
      var art = ML.create('span', { class: 'pt-sheet__art', 'aria-hidden': 'true' });
      var h = ML.create('p', { class: 'pt-sheet__title', text: title });
      var p = ML.create('p', { class: 'pt-sheet__body', text: body });
      var row = ML.create('div', { class: 'pt-sheet__row' });
      var close = ML.create('button', { class: 'btn btn--primary', type: 'button', text: '关闭并回到卡片' });
      row.appendChild(close);
      sheet.appendChild(art);
      sheet.appendChild(h);
      sheet.appendChild(p);
      sheet.appendChild(row);
      overlay.appendChild(scrim);
      overlay.appendChild(sheet);
      return { overlay: overlay, scrim: scrim, sheet: sheet, art: art, close: close, title: title };
    }

    cards.forEach(function (card) {
      ML.on(card, 'click', function () {
        if (openOverlay) return;
        var cardArt = ML.q('.pt-card__art', card);
        var ui = build(card);
        var prevFocus = document.activeElement;
        var opened = false;

        function finishOpen() {
          opened = true;
          openOverlay = { ui: ui, card: card, prevFocus: prevFocus, cardArt: cardArt };
          card.setAttribute('aria-expanded', 'true');
          ui.close.focus({ preventScroll: true });
          text(stateOut, '详情：' + ui.title);
        }

        function close() {
          if (!opened) return;
          opened = false;
          var done = function () {
            ui.overlay.remove();
            openOverlay = null;
            ML.scroll.unlock();
            setName(null);
            card.removeAttribute('aria-expanded');
            if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
            text(stateOut, '列表');
          };
          if (canVT()) {
            setName(ui.art);
            var t = document.startViewTransition(function () {
              setName(cardArt);
              ui.overlay.remove();
            });
            t.finished.finally(done);
          } else {
            ui.overlay.remove();
            done();
          }
        }

        ui.scrim.addEventListener('click', close);
        ui.close.addEventListener('click', close);
        ML.on(document, 'keydown', function (e) {
          if (!opened) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        });

        /* 先锁滚动再开过渡：滚轮补偿造成的布局变化必须先于旧快照 */
        ML.scroll.lock();
        if (canVT()) {
          setName(cardArt);
          var t = document.startViewTransition(function () {
            cardArt.style.viewTransitionName = '';
            overlayHost().appendChild(ui.overlay);
            setName(ui.art);
          });
          t.finished.finally(function () {
            if (holder === ui.art) ui.art.style.viewTransitionName = '';
            finishOpen();
          });
        } else {
          overlayHost().appendChild(ui.overlay);
          finishOpen();
        }
      });
    });

    text(countOut, '0');
  }

  /* ==========================================================================
     03 模态从触发源展开
     ========================================================================== */
  function initModal() {
    var triggers = ML.qa('[data-pt-modal]');
    if (!triggers.length) return;
    var stateOut = ML.q('[data-pt-modal-state]');
    var rectOut = ML.q('[data-pt-modal-rect]');
    var open = null;

    function closeModal(reason) {
      if (!open) return;
      var cur = open;
      open = null;
      cur.sheet.style.viewTransitionName = '';
      cur.overlay.remove();
      ML.scroll.unlock();
      document.removeEventListener('keydown', cur.onKey);
      if (cur.prevFocus && cur.prevFocus.focus) cur.prevFocus.focus({ preventScroll: true });
      text(stateOut, reason || '已关闭');
    }

    triggers.forEach(function (trigger) {
      ML.on(trigger, 'click', function () {
        if (open) return;
        var label = trigger.getAttribute('data-pt-modal') || '操作';
        var r = trigger.getBoundingClientRect();
        var overlay = ML.create('div', { class: 'pt-overlay' });
        var scrim = ML.create('button', { class: 'pt-overlay__scrim', type: 'button', 'aria-label': '关闭对话框' });
        var sheet = ML.create('div', { class: 'pt-sheet' + (canVT() ? ' is-vt' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
        var art = ML.create('span', { class: 'pt-sheet__art', 'aria-hidden': 'true' });
        var h = ML.create('p', { class: 'pt-sheet__title', text: label });
        var p = ML.create('p', { class: 'pt-sheet__body', text: '这个对话框的起点是「' + label + '」按钮的矩形：位移与缩放都由触发源算出，所以它看起来是从按钮里长出来的。' });
        var row = ML.create('div', { class: 'pt-sheet__row' });
        var cancel = ML.create('button', { class: 'btn btn--ghost', type: 'button', text: '取消' });
        var ok = ML.create('button', { class: 'btn btn--primary', type: 'button', text: '确认' });
        row.appendChild(cancel);
        row.appendChild(ok);
        sheet.appendChild(art);
        sheet.appendChild(h);
        sheet.appendChild(p);
        sheet.appendChild(row);
        overlay.appendChild(scrim);
        overlay.appendChild(sheet);

        var prevFocus = document.activeElement;
        function onKey(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeModal('已关闭（Esc）');
          }
        }

        function show() {
          overlayHost().appendChild(overlay);
          /* 新快照的起点 = 触发源矩形 → 模态当前矩形 */
          var sr = sheet.getBoundingClientRect();
          var root = document.documentElement.style;
          root.setProperty('--pt-dx', (r.left + r.width / 2 - (sr.left + sr.width / 2)).toFixed(1) + 'px');
          root.setProperty('--pt-dy', (r.top + r.height / 2 - (sr.top + sr.height / 2)).toFixed(1) + 'px');
          root.setProperty('--pt-sx', Math.max(0.18, r.width / Math.max(1, sr.width)).toFixed(3));
          root.setProperty('--pt-sy', Math.max(0.18, r.height / Math.max(1, sr.height)).toFixed(3));
          sheet.style.viewTransitionName = 'pt-modal';
          text(rectOut, ms(r.width) + '×' + ms(r.height) + ' → ' + ms(sr.width) + '×' + ms(sr.height));
        }

        open = { overlay: overlay, sheet: sheet, prevFocus: prevFocus, onKey: onKey };
        /* 先锁滚动再开过渡：否则滚动条补偿会落在过渡之后，产生一次跳动 */
        ML.scroll.lock();
        if (canVT()) {
          var t = document.startViewTransition(show);
          t.finished.finally(function () {
            if (open && open.sheet === sheet) sheet.style.viewTransitionName = '';
          });
        } else {
          show();
        }
        scrim.addEventListener('click', function () { closeModal('已关闭（点击遮罩）'); });
        cancel.addEventListener('click', function () { closeModal('已取消'); });
        ok.addEventListener('click', function () { closeModal('已确认'); });
        document.addEventListener('keydown', onKey);
        window.setTimeout(function () { ok.focus({ preventScroll: true }); }, soft() ? 10 : 90);
        text(stateOut, '已打开：' + label);
      });
    });
  }

  /* ==========================================================================
     04 抽屉（左 / 右）
     ========================================================================== */
  function initDrawer() {
    var btns = ML.qa('[data-pt-drawer]');
    if (!btns.length) return;
    var out = ML.q('[data-pt-drawer-out]');
    var nOut = ML.q('[data-pt-drawer-n]');
    var count = 0;
    var open = null;

    function body(side, long) {
      var items = long ? 14 : 5;
      var html = '<div class="pt-drawer__list">';
      for (var i = 1; i <= items; i++) {
        html += '<p class="pt-drawer__row"><span class="mono tnum">' + (i < 10 ? '0' + i : i) +
          '</span><span>筛选项 ' + i + ' · ' + (side === 'left' ? '左侧面板' : '右侧面板') + '</span></p>';
      }
      html += '</div><p class="hint">抽屉走内核 ML.UI.drawer：焦点锁定在面板内，Esc 关闭，关闭后焦点回到触发按钮。</p>';
      return html;
    }

    btns.forEach(function (btn) {
      ML.on(btn, 'click', function () {
        if (open) {
          open.close();
          open = null;
        }
        var side = btn.getAttribute('data-pt-drawer') === 'left' ? 'left' : 'right';
        var long = btn.getAttribute('data-pt-drawer-long') === '1';
        var d = ML.UI.drawer({
          title: side === 'left' ? '筛选条件' : '详情面板',
          side: side,
          content: body(side, long),
          onClose: function () {
            open = null;
            text(out, '无（已关闭）');
          }
        });
        open = d;
        count++;
        text(nOut, String(count));
        text(out, (side === 'left' ? '左侧' : '右侧') + (long ? '（长内容）' : '') + ' · 进入 360ms / 退出 245ms');
      });
    });
  }

  /* ==========================================================================
     05 全屏转场
     ========================================================================== */
  function initFullscreen() {
    var thumb = ML.q('[data-pt-full]');
    if (!thumb) return;
    var stateOut = ML.q('[data-pt-full-state]');
    var modeOut = ML.q('[data-pt-full-mode]');
    var msOut = ML.q('[data-pt-full-ms]');
    var open = null;

    function build() {
      var full = ML.create('div', { class: 'pt-full', role: 'dialog', 'aria-modal': 'true', 'aria-label': '全屏图表' });
      var bar = ML.create('div', { class: 'pt-full__bar' });
      var cap = ML.create('p', { class: 'pt-full__cap', text: '图表放大视图 · 按 Esc 或点击关闭返回缩略图' });
      var close = ML.create('button', { class: 'btn btn--primary', type: 'button', text: '关闭（Esc）' });
      bar.appendChild(cap);
      bar.appendChild(close);
      var art = ML.create('div', { class: 'pt-full__art', 'aria-hidden': 'true' });
      var foot = ML.create('p', { class: 'pt-full__cap', text: '过渡由 view-transition-name: pt-full 驱动：浏览器对旧缩略图与新全屏框的几何差异做插值，脚本不碰任何尺寸属性。' });
      full.appendChild(bar);
      full.appendChild(art);
      full.appendChild(foot);
      return { full: full, close: close };
    }

    function close(reason) {
      if (!open) return;
      var cur = open;
      open = null;
      var done = function () {
        cur.full.remove();
        ML.scroll.unlock();
        document.removeEventListener('keydown', cur.onKey);
        if (cur.prevFocus && cur.prevFocus.focus) cur.prevFocus.focus({ preventScroll: true });
        text(stateOut, '缩略图');
      };
      if (canVT()) {
        cur.full.style.viewTransitionName = 'pt-full';
        thumb.style.viewTransitionName = '';
        var t = document.startViewTransition(function () {
          cur.full.style.viewTransitionName = '';
          cur.full.remove();
          thumb.style.viewTransitionName = 'pt-full';
          text(modeOut, 'View Transition（' + reason + '）');
        });
        t.finished.finally(function () {
          thumb.style.viewTransitionName = '';
          done();
        });
      } else {
        cur.full.remove();
        done();
        text(modeOut, '降级：缩放 + 淡入（' + reason + '）');
      }
    }

    ML.on(thumb, 'click', function () {
      if (open) return;
      var ui = build();
      var prevFocus = document.activeElement;
      var t0 = performance.now();
      function onKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          close('Esc');
        }
      }
      ui.close.addEventListener('click', function () { close('按钮'); });
      document.addEventListener('keydown', onKey);
      open = { full: ui.full, prevFocus: prevFocus, onKey: onKey };

      if (canVT()) {
        thumb.style.viewTransitionName = 'pt-full';
        var t = document.startViewTransition(function () {
          overlayHost().appendChild(ui.full);
          ui.full.style.viewTransitionName = 'pt-full';
          thumb.style.viewTransitionName = '';
        });
        t.finished.finally(function () {
          if (open && open.full === ui.full) ui.full.style.viewTransitionName = '';
          text(modeOut, 'View Transition（560 / 381ms）');
          text(msOut, String(ms(performance.now() - t0)));
        });
      } else {
        overlayHost().appendChild(ui.full);
        text(modeOut, '降级：scale + opacity');
        text(msOut, String(ms(performance.now() - t0)));
      }
      ML.scroll.lock();
      ui.close.focus({ preventScroll: true });
      text(stateOut, '全屏中');
    });
  }

  /* ==========================================================================
     06 列表 / 网格 FLIP
     ========================================================================== */
  function flip(container, selector, mutate, onDone) {
    var items = ML.qa(selector, container);
    var first = items.map(function (el) { return el.getBoundingClientRect(); });

    mutate();

    var last = items.map(function (el) { return el.getBoundingClientRect(); });
    var moved = 0;
    var maxD = 0;

    items.forEach(function (el, i) {
      var dx = first[i].left - last[i].left;
      var dy = first[i].top - last[i].top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      moved++;
      maxD = Math.max(maxD, Math.sqrt(dx * dx + dy * dy));
      el.style.transition = 'none';
      el.style.transform = 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
    });

    if (!moved) {
      onDone(0, 0, 0);
      return;
    }
    void container.offsetWidth;

    if (soft()) {
      items.forEach(function (el) { el.style.transition = ''; el.style.transform = ''; });
      onDone(moved, maxD, 0);
      return;
    }

    var t0 = performance.now();
    var handler = null;
    var measured = 0;
    items.forEach(function (el, i) {
      if (Math.abs(first[i].left - last[i].left) < 0.5 && Math.abs(first[i].top - last[i].top) < 0.5) return;
      el.style.transition = 'transform var(--dur-base) var(--ease-out-quint)';
      el.style.transform = 'translate3d(0,0,0)';
      if (handler) return;
      handler = ML.on(el, 'transitionend', function (e) {
        if (e.propertyName !== 'transform') return;
        measured = performance.now() - t0;
        if (handler) { handler(); handler = null; }
        items.forEach(function (n) { n.style.transition = ''; });
        onDone(moved, maxD, measured);
      });
    });
  }

  function initFlip() {
    var box = ML.q('[data-pt-flip]');
    if (!box) return;
    var toggle = ML.q('[data-pt-flip-toggle]');
    var shuffle = ML.q('[data-pt-flip-shuffle]');
    var modeOut = ML.q('[data-pt-flip-mode]');
    var nOut = ML.q('[data-pt-flip-n]');
    var msOut = ML.q('[data-pt-flip-ms]');

    function report(moved, maxD, duration) {
      text(nOut, String(moved));
      text(msOut, duration ? String(ms(duration)) : (soft() ? '降级（0）' : '0'));
      if (maxD) text(modeOut, box.getAttribute('data-mode') + '（最大位移 ' + ms(maxD) + 'px）');
      else text(modeOut, box.getAttribute('data-mode'));
    }

    if (toggle) {
      ML.on(toggle, 'click', function () {
        var list = box.getAttribute('data-mode') === 'list';
        var next = list ? 'grid' : 'list';
        flip(box, '[data-pt-flip-item]', function () {
          box.setAttribute('data-mode', next);
        }, report);
        toggle.setAttribute('aria-pressed', next === 'list' ? 'true' : 'false');
        toggle.textContent = next === 'list' ? '切换到网格' : '切换到列表';
        text(modeOut, next);
      });
    }
    if (shuffle) {
      ML.on(shuffle, 'click', function () {
        flip(box, '[data-pt-flip-item]', function () {
          var items = ML.qa('[data-pt-flip-item]', box);
          var order = items.slice();
          for (var i = order.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = order[i];
            order[i] = order[j];
            order[j] = tmp;
          }
          order.forEach(function (el) { box.appendChild(el); });
        }, report);
      });
    }
    text(modeOut, box.getAttribute('data-mode'));
  }

  /* ==========================================================================
     07 FLIP 排序
     ========================================================================== */
  function initSort() {
    var list = ML.q('[data-pt-sort]');
    if (!list) return;
    var ascBtn = ML.q('[data-pt-sort-asc]');
    var descBtn = ML.q('[data-pt-sort-desc]');
    var shuffleBtn = ML.q('[data-pt-sort-shuffle]');
    var nOut = ML.q('[data-pt-sort-n]');
    var maxOut = ML.q('[data-pt-sort-max]');
    var msOut = ML.q('[data-pt-sort-ms]');

    function report(moved, maxD, duration) {
      text(nOut, String(moved));
      text(maxOut, String(ms(maxD)));
      text(msOut, duration ? String(ms(duration)) : (soft() ? '降级（0）' : '0'));
    }

    function reorder(compare) {
      flip(list, '[data-pt-sort-row]', function () {
        var rows = ML.qa('[data-pt-sort-row]', list);
        rows.sort(compare);
        rows.forEach(function (row, i) {
          list.appendChild(row);
          var k = ML.q('.pt-sort__k', row);
          text(k, i < 9 ? '0' + (i + 1) : String(i + 1));
        });
      }, report);
    }

    if (ascBtn) {
      ML.on(ascBtn, 'click', function () {
        reorder(function (a, b) { return parseFloat(a.getAttribute('data-v')) - parseFloat(b.getAttribute('data-v')); });
      });
    }
    if (descBtn) {
      ML.on(descBtn, 'click', function () {
        reorder(function (a, b) { return parseFloat(b.getAttribute('data-v')) - parseFloat(a.getAttribute('data-v')); });
      });
    }
    if (shuffleBtn) {
      ML.on(shuffleBtn, 'click', function () {
        reorder(function () { return Math.random() - 0.5; });
      });
    }
  }

  /* ==========================================================================
     08 路由动画原理与参数
     ========================================================================== */
  function initRoutes() {
    var frame = ML.q('[data-pt-route-frame]');
    var a = ML.q('[data-pt-route-a]');
    var b = ML.q('[data-pt-route-b]');
    if (!frame || !a || !b) return;
    var chips = ML.qa('[data-pt-dur]');
    var playBtn = ML.q('[data-pt-route-play]');
    var dirBtn = ML.q('[data-pt-route-dir]');
    var inOut = ML.q('[data-pt-route-in]');
    var outOut = ML.q('[data-pt-route-out]');
    var ratioOut = ML.q('[data-pt-route-ratio]');

    var duration = num(document.documentElement.getAttribute('data-pt-dur'), 360);
    var forward = document.documentElement.getAttribute('data-pt-route-dir') !== 'back';
    var busy = false;
    var current = a;
    var other = b;

    function stash() {
      document.documentElement.setAttribute('data-pt-dur', String(duration));
      document.documentElement.setAttribute('data-pt-route-dir', forward ? 'forward' : 'back');
      try {
        window.localStorage.setItem('ml-pt-dur', String(duration));
        window.localStorage.setItem('ml-pt-route-dir', forward ? 'forward' : 'back');
      } catch (err) {
        /* 存储不可用：忽略 */
      }
    }

    function setDuration(msValue) {
      duration = msValue;
      frame.style.setProperty('--route-dur', duration + 'ms');
      chips.forEach(function (c) {
        var on = parseFloat(c.getAttribute('data-pt-dur')) === msValue;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      text(inOut, String(duration));
      stash();
    }

    chips.forEach(function (c) {
      ML.on(c, 'click', function () { setDuration(parseFloat(c.getAttribute('data-pt-dur')) || 360); });
    });

    if (dirBtn) {
      if (!forward) dirBtn.textContent = '方向：后退';
      ML.on(dirBtn, 'click', function () {
        forward = !forward;
        dirBtn.textContent = forward ? '方向：前进' : '方向：后退';
        stash();
      });
    }

    function reset(el, cls) {
      el.style.transition = 'none';
      el.className = 'pt-routes__screen' + (cls ? ' ' + cls : '');
      el.style.transform = cls ? '' : 'translate3d(0,0,0)';
      void el.offsetWidth;
      el.style.transition = '';
    }

    function play() {
      if (busy) return;
      var exitClass = forward ? 'is-to-left' : 'is-to-right';
      var enterClass = forward ? 'is-from-right' : 'is-from-left';

      reset(current, 'is-current');
      reset(other, enterClass);
      other.setAttribute('aria-hidden', 'true');
      current.removeAttribute('aria-hidden');

      if (soft()) {
        reset(current, '');
        reset(other, 'is-current');
        other.removeAttribute('aria-hidden');
        current.setAttribute('aria-hidden', 'true');
        var t = current; current = other; other = t;
        text(outOut, '0（降级）');
        text(ratioOut, '降级：瞬时切换');
        return;
      }

      busy = true;
      var t0 = performance.now();
      var exitDone = false;

      var offExit = ML.on(current, 'transitionend', function (e) {
        if (exitDone || e.propertyName !== 'transform') return;
        exitDone = true;
        offExit();
        var exitMs = performance.now() - t0;
        text(outOut, String(ms(exitMs)));

        var t1 = performance.now();
        var enterDone = false;
        var offEnter = ML.on(other, 'transitionend', function (ev) {
          if (enterDone || ev.propertyName !== 'transform') return;
          enterDone = true;
          offEnter();
          var enterMs = performance.now() - t1;
          text(inOut, String(ms(enterMs)));
          text(ratioOut, (exitMs / enterMs).toFixed(2) + '（目标 0.68）');
          busy = false;
        });

        other.classList.remove(enterClass);
        other.classList.add('is-current');
        other.removeAttribute('aria-hidden');
        current.classList.remove('is-exit', exitClass);
        current.setAttribute('aria-hidden', 'true');
        var swapTmp = current; current = other; other = swapTmp;
      });

      current.classList.add('is-exit', exitClass);
    }

    if (playBtn) ML.on(playBtn, 'click', play);
    setDuration(360);
    text(outOut, '—');
    text(ratioOut, '—');
    reset(a, 'is-current');
    reset(b, '');
    b.setAttribute('aria-hidden', 'true');
  }

  /* ==========================================================================
     boot
     ========================================================================== */
  function boot() {
    if (!window.ML || typeof ML.q !== 'function') return;
    initCrossDoc();
    initShared();
    initModal();
    initDrawer();
    initFullscreen();
    initFlip();
    initSort();
    initRoutes();
  }

  document.addEventListener('ml:ready', boot, { once: true });
})();
