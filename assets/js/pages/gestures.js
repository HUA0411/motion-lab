/* 展厅 G · 手势与拖拽 — 12 个 demo，全部 Pointer Events + setPointerCapture，每个手势都有键盘替代 */
(function () {
  'use strict';

  var d = document;

  function q(sel, root) { return ML.q(sel, root || d); }
  function qa(sel, root) { return ML.qa(sel, root || d); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function reduced() { return ML.reduced === true || (ML.motion && ML.motion.get() !== 'on'); }
  function icon(name, size) { return (ML.UI && ML.UI.icon) ? ML.UI.icon(name, { size: size || 18 }) : d.createElement('span'); }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function nowMs() { return (window.performance || Date).now(); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function clock(date) { return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds()); }
  function rectOf(el) { return el.getBoundingClientRect(); }
  /* setPointerCapture 在指针已释放时可能抛 InvalidPointerId，统一兜底 */
  function cap(el, id) { try { el.setPointerCapture(id); } catch (err) { /* 指针已释放，忽略 */ } }

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
     参数与 ML.presets 对齐，句柄接口与内核一致。起因：内核 schedule 把「回调返回 false」当作完成，
     而内核弹簧的 step 在运行中恰好返回 false，内核弹簧因此首帧后被移出帧循环（已上报 Lead）。 */
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

  function hydrateIcons(root) {
    qa('[data-gp-icon]', root || d).forEach(function (el) {
      if (el.dataset.gpIconDone === '1') return;
      el.dataset.gpIconDone = '1';
      el.appendChild(icon(el.getAttribute('data-gp-icon'), 16));
    });
  }

  /* ------------------------------------------------- 01 拖拽排序（FLIP） */
  function bootSort() {
    var list = q('#gp-sort-list'), status = q('#gp-sort-status');
    if (!list) return;
    var DATA = ['交互规格卡 A', '按钮按压物理', '弹簧调参器', '面包屑折叠', '骨架屏占位'];
    var nodes = [];

    function announce() {
      var order = qa('.gp-sort__item', list).map(function (n) { return n.dataset.title; });
      setText(status, '顺序：' + order.map(function (t, i) { return pad2(i + 1) + ' ' + t; }).join(' → '));
    }
    DATA.forEach(function (title) {
      var li = d.createElement('li');
      li.className = 'gp-sort__item';
      li.dataset.title = title;
      li.tabIndex = 0;
      li.setAttribute('role', 'listitem');
      li.setAttribute('aria-label', title + '（拖拽排序，或 Alt + 上下方向键移动）');
      var handle = d.createElement('span');
      handle.className = 'gp-sort__handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.appendChild(icon('list', 16));
      var text = d.createElement('span');
      text.textContent = title;
      var meta = d.createElement('span');
      meta.className = 'gp-sort__meta';
      meta.textContent = '拖动 / Alt+↑↓';
      li.appendChild(handle); li.appendChild(text); li.appendChild(meta);
      list.appendChild(li);
      nodes.push(li);
    });

    function flip(others) {
      if (reduced()) return;
      var before = others.map(function (n) { return { el: n, top: rectOf(n).top }; });
      return before;
    }
    function playFlip(before, skip) {
      if (!before || reduced()) return;
      before.forEach(function (rec) {
        if (rec.el === skip) return;
        var dy = rec.top - rectOf(rec.el).top;
        if (Math.abs(dy) < 0.5) return;
        rec.el.style.transition = 'none';
        rec.el.style.transform = 'translate3d(0,' + dy + 'px,0)';
        void rec.el.offsetWidth;
        rec.el.style.transition = 'transform var(--dur-base) var(--ease-out-quint)';
        rec.el.style.transform = 'translate3d(0,0,0)';
      });
    }
    function moveTo(node, pointerY) {
      var others = qa('.gp-sort__item', list).filter(function (n) { return n !== node; });
      var ref = null;
      for (var i = 0; i < others.length; i++) {
        var r = rectOf(others[i]);
        if (pointerY < r.top + r.height / 2) { ref = others[i]; break; }
      }
      if (ref === node.nextSibling || (ref === null && node.nextSibling === null)) return false;
      var snapshot = others.map(function (n) { return { el: n, top: rectOf(n).top }; });
      list.insertBefore(node, ref);
      playFlip(snapshot, node);
      return true;
    }
    function moveByKeyboard(node, dir) {
      var all = qa('.gp-sort__item', list);
      var i = all.indexOf(node);
      var target = all[i + dir];
      if (!target) {
        setText(status, (dir < 0 ? '已经是第一项' : '已经是最后一项') + ' · 位置 ' + (i + 1) + ' / ' + all.length);
        return;
      }
      var snapshot = all.map(function (n) { return { el: n, top: rectOf(n).top }; });
      if (dir < 0) list.insertBefore(node, target);
      else list.insertBefore(node, target.nextSibling);
      playFlip(snapshot, node);
      node.focus();
      var idx = qa('.gp-sort__item', list).indexOf(node) + 1;
      setText(status, '键盘移动：' + node.dataset.title + ' 已移动到第 ' + idx + ' 位（共 ' + all.length + ' 位）');
    }

    var drag = null;
    ML.on(list, 'pointerdown', function (ev) {
      var item = ev.target.closest ? ev.target.closest('.gp-sort__item') : null;
      if (!item || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      drag = { node: item, startY: ev.clientY, offset: 0, id: ev.pointerId };
      cap(item, ev.pointerId);
      item.classList.add('is-dragging');
      item.style.transition = 'none';
      setText(status, '拖起「' + item.dataset.title + '」· 上下移动决定插入位置');
      ev.preventDefault();
    });
    ML.on(list, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      drag.offset = ev.clientY - drag.startY;
      drag.node.style.transform = 'translate3d(0,' + drag.offset + 'px,0) scale(1.02)';
      moveTo(drag.node, ev.clientY);
    });
    function endDrag(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      var node = drag.node;
      drag = null;
      node.classList.remove('is-dragging');
      node.style.transition = reduced() ? 'none' : 'transform var(--dur-base) var(--ease-out-quint)';
      node.style.transform = 'translate3d(0,0,0)';
      window.setTimeout(function () {
        node.style.transition = '';
        node.style.transform = '';
      }, 320);
      var idx = qa('.gp-sort__item', list).indexOf(node) + 1;
      setText(status, '已放下「' + node.dataset.title + '」到第 ' + idx + ' 位 · 键盘可用 Alt+↑↓ 复现');
      announce();
    }
    ML.on(list, 'pointerup', endDrag);
    ML.on(list, 'pointercancel', endDrag);
    ML.on(list, 'keydown', function (ev) {
      var item = ev.target.closest ? ev.target.closest('.gp-sort__item') : null;
      if (!item) return;
      var up = ev.key === 'ArrowUp', down = ev.key === 'ArrowDown';
      if (!up && !down) return;
      if (!(ev.altKey || ev.ctrlKey || ev.metaKey)) {
        setText(status, '按住 Alt（或 Ctrl）再按 ↑↓ 移动该项；直接按 ↑↓ 只移动焦点');
        return;
      }
      ev.preventDefault();
      moveByKeyboard(item, up ? -1 : 1);
    });
    announce();
  }

  /* ------------------------------------- 02 滑动删除（阈值 + 回弹 + 撤销） */
  function bootSwipe() {
    var front = q('#gp-swipe-front'), bg = q('#gp-swipe-bg'), row = q('#gp-swipe-row');
    var meta = q('.gp-swipe__meta', front || d), status = q('#gp-swipe-status');
    var delBtn = q('#gp-swipe-del'), undoBtn = q('#gp-swipe-undo'), wrap = q('#gp-swipe');
    if (!front || !row) return;
    var drag = null, x = 0, spring = null, committed = false, timer = null;

    function threshold() { return row.clientWidth * 0.4; }
    function setX(v) {
      x = v;
      front.style.transform = 'translate3d(' + v + 'px,0,0)';
      var armed = Math.abs(v) >= threshold();
      bg.classList.toggle('is-armed', armed);
      setText(meta, '阈值 ' + Math.round(threshold()) + 'px · 当前 ' + Math.round(v) + 'px' + (armed ? ' · 已过阈值' : ''));
    }
    function stopSpring() { if (spring) { spring.stop(); spring = null; } }
    function springBack() {
      stopSpring();
      if (reduced()) { setX(0); return; }
      spring = createSpring({ onUpdate: function (v) { setX(v); } }, x, 0, { preset: 'standard', onComplete: function () { spring = null; } });
    }
    function remove(reason) {
      committed = true;
      bg.classList.add('is-armed');
      wrap.classList.add('is-gone');
      front.style.transform = 'translate3d(-120%,0,0)';
      setText(status, '已删除（' + reason + '）· 5 秒内可撤销');
      if (undoBtn) {
        undoBtn.hidden = false;
        undoBtn.focus();
      }
      if (delBtn) delBtn.disabled = true;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        setText(status, '撤销窗口已关闭 · 删除已生效');
        if (undoBtn) undoBtn.hidden = true;
      }, 5000);
    }
    function restore() {
      if (timer) window.clearTimeout(timer);
      committed = false;
      wrap.classList.remove('is-gone');
      front.style.transition = reduced() ? 'none' : 'transform var(--dur-slow) var(--ease-out-quint)';
      setX(0);
      window.setTimeout(function () { front.style.transition = ''; }, 400);
      if (undoBtn) undoBtn.hidden = true;
      if (delBtn) delBtn.disabled = false;
      setText(status, '已撤销删除 · 卡片回到列表（键盘路径同样可用）');
      front.focus();
    }

    ML.on(front, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      if (committed) return;
      stopSpring();
      drag = { x0: ev.clientX, id: ev.pointerId };
      cap(front, ev.pointerId);
      front.style.transition = 'none';
      ev.preventDefault();
    });
    ML.on(front, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = clamp(ev.clientX - drag.x0, -row.clientWidth, row.clientWidth);
      setX(dx);
    });
    function endSwipe(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      drag = null;
      front.style.transition = '';
      if (Math.abs(x) >= threshold()) remove('滑动超过阈值 ' + Math.round(threshold()) + 'px');
      else {
        setText(status, '未过阈值（' + Math.round(Math.abs(x)) + 'px < ' + Math.round(threshold()) + 'px）· 弹簧回弹');
        springBack();
      }
    }
    ML.on(front, 'pointerup', endSwipe);
    ML.on(front, 'pointercancel', endSwipe);
    ML.on(front, 'dblclick', function () { setText(status, '双击不会删除，避免误触；删除必须超过阈值或使用键盘/按钮'); });
    ML.on(front, 'keydown', function (ev) {
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault();
        remove('键盘 Delete');
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        if (committed) return;
        setX(clamp(x + (ev.key === 'ArrowLeft' ? -40 : 40), -row.clientWidth, row.clientWidth));
        setText(status, '键盘滑动：当前 ' + Math.round(x) + 'px（阈值 ' + Math.round(threshold()) + 'px），按 Delete 删除');
      }
    });
    if (delBtn) ML.on(delBtn, 'click', function () { if (!committed) remove('按钮'); });
    if (undoBtn) ML.on(undoBtn, 'click', restore);
    if (ML.observeSize) ML.observeSize(row, function () { setX(x); });
    setX(0);
  }

  /* ------------------------------------------------- 03 橡皮筋边界 */
  function bootRubber() {
    var area = q('#gp-rubber-area'), box = q('#gp-rubber-box');
    var rawOut = q('#gp-rubber-raw'), shownOut = q('#gp-rubber-shown'), factorOut = q('#gp-rubber-factor'), status = q('#gp-rubber-status');
    if (!area || !box) return;
    var CX = 0, drag = null, spring = null;
    function limit() { return Math.max(20, area.clientWidth / 2 - 32 - 8); }
    function factor(raw) {
      var lim = limit();
      if (Math.abs(raw) <= lim) return 1;
      return 0.35;
    }
    function shownFor(raw) {
      var lim = limit();
      if (raw > lim) return lim + (raw - lim) * 0.35;
      if (raw < -lim) return -lim + (raw + lim) * 0.35;
      return raw;
    }
    function apply(raw) {
      var shown = shownFor(raw);
      box.style.transform = 'translate3d(' + shown.toFixed(1) + 'px,-50%,0)';
      setText(rawOut, Math.round(raw) + ' px');
      setText(shownOut, Math.round(shown) + ' px');
      setText(factorOut, factor(raw).toFixed(2));
    }
    function stopSpring() { if (spring) { spring.stop(); spring = null; } }
    function settle() {
      stopSpring();
      var target = clamp(CX, -limit(), limit());
      if (reduced()) { CX = target; apply(CX); setText(status, '降级：瞬时落回边界内 ' + Math.round(CX) + 'px'); return; }
      spring = createSpring({
        onUpdate: function (v) { CX = v; apply(v); },
        onComplete: function () {
          spring = null;
          CX = target;
          apply(target);
          setText(status, '已回弹到边界内 ' + Math.round(target) + 'px（衰减系数回到 1.00）');
        }
      }, CX, target, { preset: 'standard' });
      setText(status, '松手 · standard 弹簧回弹中（越界位移已按 0.35 衰减）');
    }
    ML.on(box, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      stopSpring();
      drag = { x0: ev.clientX, base: CX, id: ev.pointerId };
      cap(box, ev.pointerId);
      ev.preventDefault();
    });
    ML.on(box, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      CX = drag.base + (ev.clientX - drag.x0);
      apply(CX);
      setText(status, '拖动中：原始位移 ' + Math.round(CX) + 'px · 实际 ' + Math.round(shownFor(CX)) + 'px（系数 ' + factor(CX).toFixed(2) + '）');
    });
    function end(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      drag = null;
      settle();
    }
    ML.on(box, 'pointerup', end);
    ML.on(box, 'pointercancel', end);
    ML.on(box, 'keydown', function (ev) {
      var step = ev.shiftKey ? 64 : 16, dir = 0;
      if (ev.key === 'ArrowLeft') dir = -1;
      else if (ev.key === 'ArrowRight') dir = 1;
      else if (ev.key === 'Home') { CX = -limit(); apply(CX); setText(status, 'Home：移到左边界 ' + Math.round(CX) + 'px（键盘不越界，直接停住）'); ev.preventDefault(); return; }
      else if (ev.key === 'End') { CX = limit(); apply(CX); setText(status, 'End：移到右边界 ' + Math.round(CX) + 'px（键盘不越界，直接停住）'); ev.preventDefault(); return; }
      else return;
      ev.preventDefault();
      stopSpring();
      var next = CX + dir * step;
      var lim = limit();
      var blocked = Math.abs(next) > lim;
      CX = clamp(next, -lim, lim);
      apply(CX);
      setText(status, blocked
        ? '键盘到达边界（' + Math.round(CX) + 'px）· 停在边界并播报，不做橡皮筋拉伸'
        : '键盘移动 ' + step + 'px · 当前 ' + Math.round(CX) + 'px（边界 ±' + Math.round(lim) + 'px）');
    });
    if (ML.observeSize) ML.observeSize(area, function () { apply(CX); });
    apply(0);
  }

  /* ---------------------------------------- 04 拖拽文件区（DOM 事件模拟） */
  function bootDrop() {
    var chip = q('#gp-file-chip'), zone = q('#gp-dropzone'), listEl = q('#gp-filelist');
    var addBtn = q('#gp-file-add'), status = q('#gp-drop-status');
    if (!chip || !zone || !listEl) return;
    var SIZES = ['248 KB', '1.2 MB', '640 KB', '3.4 MB'];
    var count = 0, drag = null;

    function addFile(name) {
      count++;
      var li = d.createElement('li');
      li.className = 'gp-filelist__item';
      var head = d.createElement('div');
      head.className = 'gp-filelist__head';
      var fileIcon = d.createElement('span');
      fileIcon.setAttribute('aria-hidden', 'true');
      fileIcon.appendChild(icon('file', 16));
      var label = d.createElement('span');
      label.textContent = name;
      var size = d.createElement('span');
      size.className = 'gp-filelist__size';
      size.textContent = '上传中…';
      var remove = d.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--ghost btn--icon';
      remove.setAttribute('aria-label', '移除 ' + name);
      remove.appendChild(icon('close', 16));
      head.appendChild(fileIcon); head.appendChild(label); head.appendChild(size); head.appendChild(remove);
      var bar = d.createElement('div');
      bar.className = 'gp-filelist__bar';
      var fill = d.createElement('span');
      fill.className = 'gp-filelist__fill';
      bar.appendChild(fill);
      li.appendChild(head); li.appendChild(bar);
      li.tabIndex = 0;
      ML.on(remove, 'click', function () {
        li.remove();
        setText(status, '已移除「' + name + '」· 剩余 ' + qa('.gp-filelist__item', listEl).length + ' 个文件');
      });
      ML.on(li, 'keydown', function (ev) {
        if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); li.remove(); setText(status, '键盘 Delete：已移除「' + name + '」'); }
      });
      listEl.appendChild(li);
      var t0 = nowMs();
      if (reduced()) {
        fill.style.transform = 'scaleX(1)';
        setText(size, SIZES[count % SIZES.length] + '（降级：瞬时完成）');
      } else {
        var un = (function loopStep() {
          var stopped = false, cancel = null;
          function tick() {
            if (stopped) return;
            var p = clamp((nowMs() - t0) / 1600, 0, 1);
            fill.style.transform = 'scaleX(' + p + ')';
            if (p < 1) { cancel = ML.raf(tick); return; }
            setText(size, SIZES[count % SIZES.length] + ' · 已完成');
          }
          cancel = ML.raf(tick);
          return function () { stopped = true; if (cancel) cancel(); };
        })();
        window.setTimeout(function () { un(); fill.style.transform = 'scaleX(1)'; setText(size, SIZES[count % SIZES.length] + ' · 已完成'); }, 1700);
      }
      setText(status, '已加入「' + name + '」· 列表共 ' + qa('.gp-filelist__item', listEl).length + ' 个文件（进度条用 scaleX 模拟上传）');
    }
    function over(isOver) {
      zone.classList.toggle('is-over', isOver);
    }

    ML.on(chip, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY };
      cap(chip, ev.pointerId);
      chip.classList.add('is-dragging');
      chip.style.transition = 'none';
      ev.preventDefault();
    });
    ML.on(chip, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      chip.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      var r = rectOf(zone);
      var inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      over(inside);
      setText(status, inside ? '松手即投放到文件区' : '拖动中 · 把芯片拖进虚线区');
    });
    function endChip(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      var inside = zone.classList.contains('is-over');
      drag = null;
      chip.classList.remove('is-dragging');
      chip.style.transition = reduced() ? 'none' : 'transform var(--dur-base) var(--ease-out-quint)';
      chip.style.transform = 'translate3d(0,0,0)';
      over(false);
      window.setTimeout(function () { chip.style.transition = ''; }, 300);
      if (inside) addFile('规格表-拖入.pdf');
      else setText(status, '未投放（落点在文件区之外）· 仍可用 Enter 或按钮加入文件');
    }
    ML.on(chip, 'pointerup', endChip);
    ML.on(chip, 'pointercancel', endChip);
    ML.on(chip, 'keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); addFile('规格表-键盘加入.pdf'); }
    });
    ML.on(zone, 'dragover', function (ev) {
      ev.preventDefault();
      over(true);
      setText(status, '检测到真实文件拖放（dragover）· 松手即读取');
    });
    ML.on(zone, 'dragleave', function () { over(false); });
    ML.on(zone, 'drop', function (ev) {
      ev.preventDefault();
      over(false);
      var files = ev.dataTransfer && ev.dataTransfer.files ? ev.dataTransfer.files : null;
      if (files && files.length) {
        for (var i = 0; i < files.length; i++) addFile(files[i].name);
      } else {
        addFile('拖入的文件.bin');
      }
    });
    ML.on(zone, 'keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); addFile('规格表-示例.pdf'); }
    });
    if (addBtn) ML.on(addBtn, 'click', function () { addFile('规格表-选择文件.pdf'); });
  }

  /* ------------------------------------------------- 05 长按上下文菜单 */
  function bootLongPress() {
    var area = q('#gp-lp-area'), target = q('#gp-lp-target'), menu = q('#gp-lp-menu');
    var openBtn = q('#gp-lp-open'), status = q('#gp-lp-status');
    if (!area || !target || !menu) return;
    var timer = null, start = null, items = [];
    var ITEMS = [
      { label: '重命名', icon: 'file' },
      { label: '复制链接', icon: 'link' },
      { label: '导出规格', icon: 'copy' },
      { label: '删除', icon: 'trash' }
    ];
    ITEMS.forEach(function (item, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'gp-lp__mi';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = i === 0 ? 0 : -1;
      b.appendChild(icon(item.icon, 16));
      b.appendChild(d.createTextNode(item.label));
      ML.on(b, 'click', function () { choose(i); });
      menu.appendChild(b);
      items.push(b);
    });
    function close(back) {
      if (menu.hidden) return;
      menu.hidden = true;
      target.setAttribute('aria-expanded', 'false');
      target.classList.remove('is-holding');
      if (back) target.focus();
    }
    function choose(i) {
      var item = ITEMS[i];
      close(true);
      setText(status, '已选择「' + item.label + '」· 菜单关闭，焦点回到触发元素');
      if (ML.UI && ML.UI.toast) ML.UI.toast({ title: '上下文操作：' + item.label, variant: i === 3 ? 'danger' : 'info', duration: 3000 });
    }
    function open(x, y) {
      var r = rectOf(area);
      menu.hidden = false;
      var mw = menu.offsetWidth || 200, mh = menu.offsetHeight || 180;
      var left = clamp(x - r.left, 4, Math.max(4, area.clientWidth - mw - 4));
      var top = clamp(y - r.top, 4, Math.max(4, area.clientHeight - mh - 4));
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      target.setAttribute('aria-expanded', 'true');
      target.classList.add('is-holding');
      items.forEach(function (b, i) { b.tabIndex = i === 0 ? 0 : -1; });
      items[0].focus();
      setText(status, '菜单已打开 · ↑↓ 选择、Enter 确认、Esc 关闭');
    }
    function cancelTimer(reason) {
      if (timer) { window.clearTimeout(timer); timer = null; }
      target.classList.remove('is-holding');
      if (reason) setText(status, reason);
    }
    ML.on(target, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      start = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      cap(target, ev.pointerId);
      target.classList.add('is-holding');
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        timer = null;
        open(start.x, start.y);
      }, 450);
      setText(status, '按住中…保持 450ms 不动即可打开菜单');
      ev.preventDefault();
    });
    ML.on(target, 'pointermove', function (ev) {
      if (!start || ev.pointerId !== start.id) return;
      var dist = Math.sqrt(Math.pow(ev.clientX - start.x, 2) + Math.pow(ev.clientY - start.y, 2));
      if (dist > 8) cancelTimer('已取消长按（移动 ' + Math.round(dist) + 'px > 8px）· 这是防误触死区');
    });
    function up(ev) {
      if (!start || (ev && ev.pointerId !== start.id)) return;
      start = null;
      if (timer) cancelTimer('松手太快（< 450ms）· 未触发菜单，可用 Shift+F10 或按钮唤起');
    }
    ML.on(target, 'pointerup', up);
    ML.on(target, 'pointercancel', up);
    ML.on(target, 'contextmenu', function (ev) {
      ev.preventDefault();
      open(ev.clientX, ev.clientY);
    });
    ML.on(target, 'keydown', function (ev) {
      if (ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10')) {
        ev.preventDefault();
        var r = rectOf(target);
        open(r.left + 12, r.bottom + 4);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        var r2 = rectOf(target);
        open(r2.left + 12, r2.bottom + 4);
      }
    });
    ML.on(menu, 'keydown', function (ev) {
      var i = items.indexOf(d.activeElement);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); var n = clamp((i < 0 ? 0 : i + 1), 0, items.length - 1); items.forEach(function (b, k) { b.tabIndex = k === n ? 0 : -1; }); items[n].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); var p = clamp((i < 0 ? 0 : i - 1), 0, items.length - 1); items.forEach(function (b, k) { b.tabIndex = k === p ? 0 : -1; }); items[p].focus(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); close(true); }
      else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(clamp(i, 0, items.length - 1)); }
      else if (ev.key === 'Tab') { ev.preventDefault(); close(true); }
    });
    ML.on(d, 'pointerdown', function (ev) {
      if (menu.hidden) return;
      if (!menu.contains(ev.target) && ev.target !== target) close(false);
    });
    if (openBtn) ML.on(openBtn, 'click', function () {
      var r = rectOf(target);
      open(r.left + 12, r.bottom + 4);
    });
    menu.hidden = true;
  }

  /* ----------------------------------------------------- 06 下拉刷新 */
  function bootRefresh() {
    var view = q('#gp-refresh-viewport'), ind = q('#gp-refresh-ind'), listEl = q('#gp-refresh-list');
    var btn = q('#gp-refresh-btn'), status = q('#gp-refresh-status');
    if (!view || !listEl) return;
    var THRESHOLD = 72, pull = 0, drag = null, busy = false, round = 0;

    function render() {
      listEl.innerHTML = '';
      for (var i = 1; i <= 8; i++) {
        var li = d.createElement('li');
        li.className = 'gp-refresh__item';
        var idx = d.createElement('span');
        idx.className = 'gp-refresh__idx';
        idx.textContent = pad2(i);
        var label = d.createElement('span');
        label.textContent = '记录 ' + i + ' · 第 ' + round + ' 次刷新';
        li.appendChild(idx); li.appendChild(label);
        listEl.appendChild(li);
      }
    }
    function setPull(p) {
      pull = clamp(p, 0, 120);
      if (ind) ind.style.transform = 'translate3d(0,' + (pull - 24) + 'px,0)';
      if (ind) ind.classList.toggle('is-pulling', pull > 4 && !busy);
    }
    function reset() {
      pull = 0;
      if (ind) {
        ind.classList.remove('is-pulling', 'is-loading');
        ind.style.transform = 'translate3d(0,-24px,0)';
      }
    }
    function doRefresh(reason) {
      if (busy) return;
      busy = true;
      if (ind) { ind.classList.add('is-loading', 'is-pulling'); ind.style.transform = 'translate3d(0,0,0)'; }
      setText(status, '刷新中…（' + reason + '）');
      window.setTimeout(function () {
        busy = false;
        round++;
        render();
        reset();
        setText(status, '已更新 · ' + clock(new Date()) + ' · 共 ' + qa('.gp-refresh__item', listEl).length + ' 条（第 ' + round + ' 次刷新）');
      }, 1200);
    }
    ML.on(view, 'pointerdown', function (ev) {
      if (busy || view.scrollTop > 0) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      drag = { y0: ev.clientY, id: ev.pointerId };
      cap(view, ev.pointerId);
    });
    ML.on(view, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dy = ev.clientY - drag.y0;
      if (dy <= 0) { setPull(0); return; }
      setPull(dy * 0.5);
      setText(status, pull >= THRESHOLD
        ? '松手即刷新（' + Math.round(pull) + 'px ≥ ' + THRESHOLD + 'px）'
        : '继续下拉 ' + Math.round(THRESHOLD - pull) + 'px 触发刷新（阻尼 0.5）');
    });
    function end(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      drag = null;
      if (pull >= THRESHOLD) doRefresh('下拉 ' + Math.round(pull) + 'px');
      else {
        setText(status, '未达阈值（' + Math.round(pull) + 'px < ' + THRESHOLD + 'px）· 回弹收起');
        reset();
      }
    }
    ML.on(view, 'pointerup', end);
    ML.on(view, 'pointercancel', end);
    ML.on(view, 'keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); doRefresh('键盘 Enter'); }
    });
    if (btn) ML.on(btn, 'click', function () { doRefresh('按钮'); });
    render();
    reset();
  }

  /* --------------------------------------------- 07 双指缩放画布 */
  function bootPinch() {
    var canvas = q('#gp-canvas-zoom'), inner = q('#gp-canvas-inner');
    var scaleOut = q('#gp-zoom-scale'), posOut = q('#gp-zoom-pos'), countOut = q('#gp-zoom-pointers'), status = q('#gp-pinch-status');
    var zoomIn = q('#gp-zoom-in'), zoomOut = q('#gp-zoom-out'), resetBtn = q('#gp-zoom-reset');
    if (!canvas || !inner) return;
    var scale = 1, tx = 0, ty = 0;
    var pointers = {}, pinch = null, pan = null;

    function apply(animate) {
      inner.style.transition = (animate && !reduced()) ? 'transform var(--dur-fast) var(--ease-out-quint)' : 'none';
      inner.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ')';
      setText(scaleOut, scale.toFixed(2) + '×');
      setText(posOut, Math.round(tx) + ', ' + Math.round(ty));
      setText(countOut, String(Object.keys(pointers).length));
    }
    function setScale(next, reason) {
      scale = clamp(next, 0.2, 4);
      apply(true);
      setText(status, '缩放 ' + scale.toFixed(2) + '×（' + reason + '）· 范围 0.2×–4×');
    }
    function reset() {
      scale = 1; tx = 0; ty = 0;
      apply(true);
      setText(status, '已重置为 100% 且归位 · 键盘 +/-/0 与方向键同样可用');
    }
    ML.on(canvas, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      cap(canvas, ev.pointerId);
      var ids = Object.keys(pointers);
      if (ids.length === 1) pan = { x: ev.clientX, y: ev.clientY, tx: tx, ty: ty, id: ev.pointerId };
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: scale };
        pan = null;
      }
      apply(false);
      setText(status, ids.length === 2 ? '双指缩放中（距离比驱动 scale）' : '单指平移中');
      ev.preventDefault();
    });
    ML.on(canvas, 'pointermove', function (ev) {
      if (!pointers[ev.pointerId]) return;
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(pointers);
      if (ids.length >= 2 && pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.dist > 4) {
          scale = clamp(pinch.scale * (dist / pinch.dist), 0.2, 4);
          apply(false);
          setText(scaleOut, scale.toFixed(2) + '×');
          setText(posOut, Math.round(tx) + ', ' + Math.round(ty));
          setText(status, '双指距离 ' + Math.round(dist) + 'px · 缩放 ' + scale.toFixed(2) + '×');
        }
        return;
      }
      if (pan && ev.pointerId === pan.id) {
        tx = pan.tx + (ev.clientX - pan.x);
        ty = pan.ty + (ev.clientY - pan.y);
        apply(false);
        setText(status, '平移 ' + Math.round(tx) + ', ' + Math.round(ty) + '（跟手 0ms）');
      }
    });
    function up(ev) {
      if (!pointers[ev.pointerId]) return;
      delete pointers[ev.pointerId];
      var ids = Object.keys(pointers);
      if (ids.length < 2) pinch = null;
      if (ids.length === 1) {
        var only = pointers[ids[0]];
        pan = { x: only.x, y: only.y, tx: tx, ty: ty, id: Number(ids[0]) };
      } else if (ids.length === 0) {
        pan = null;
      }
      apply(false);
      setText(status, '指针抬起 · 当前缩放 ' + scale.toFixed(2) + '× · 位置 ' + Math.round(tx) + ', ' + Math.round(ty));
    }
    ML.on(canvas, 'pointerup', up);
    ML.on(canvas, 'pointercancel', up);
    ML.on(canvas, 'keydown', function (ev) {
      var step = ev.shiftKey ? 48 : 12;
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); setScale(scale * 1.25, '键盘 +'); return; }
      if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); setScale(scale / 1.25, '键盘 −'); return; }
      if (ev.key === '0') { ev.preventDefault(); reset(); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); tx -= step; }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); tx += step; }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); ty -= step; }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); ty += step; }
      else return;
      apply(false);
      setText(status, '键盘平移 ' + step + 'px · 位置 ' + Math.round(tx) + ', ' + Math.round(ty) + '（Shift 加速 4×）');
    });
    if (zoomIn) ML.on(zoomIn, 'click', function () { setScale(scale * 1.25, '按钮 +'); });
    if (zoomOut) ML.on(zoomOut, 'click', function () { setScale(scale / 1.25, '按钮 −'); });
    if (resetBtn) ML.on(resetBtn, 'click', reset);
    apply(false);
  }

  /* ------------------------------------------------- 08 滑动切换卡片 */
  function bootCards() {
    var view = q('#gp-cards-viewport'), track = q('#gp-cards-track'), dots = q('#gp-cards-dots');
    var prev = q('#gp-cards-prev'), next = q('#gp-cards-next'), status = q('#gp-cards-status');
    if (!view || !track) return;
    var CARDS = [
      { title: '卡片 1 · 阈值 25%', text: '位移超过容器宽度的 25%（或 60px）即吸附到下一张，否则回弹。' },
      { title: '卡片 2 · 方向锁', text: '水平拖动时页面纵向滚动不受影响（touch-action: pan-y）。' },
      { title: '卡片 3 · 键盘等价', text: '←→ 与 Home/End 提供完全等价的切换能力，圆点同步高亮。' }
    ];
    var index = 0, drag = null, spring = null, dotEls = [];
    CARDS.forEach(function (card) {
      var el = d.createElement('article');
      el.className = 'gp-cards__card';
      var h = d.createElement('h4');
      h.textContent = card.title;
      var p = d.createElement('p');
      p.textContent = card.text;
      el.appendChild(h); el.appendChild(p);
      track.appendChild(el);
      var dot = d.createElement('span');
      dot.className = 'gp-cards__dot';
      dots.appendChild(dot);
      dotEls.push(dot);
    });
    function width() { return view.clientWidth || 320; }
    function x() { return -index * width(); }
    function paint() {
      track.style.transform = 'translate3d(' + x() + 'px,0,0)';
      dotEls.forEach(function (dot, i) { dot.classList.toggle('is-on', i === index); });
      setText(status, '第 ' + (index + 1) + ' / ' + CARDS.length + ' 张 · ' + CARDS[index].title);
    }
    function stopSpring() { if (spring) { spring.stop(); spring = null; } }
    function go(i, reason) {
      index = clamp(i, 0, CARDS.length - 1);
      stopSpring();
      if (reduced()) { paint(); setText(status, '降级：第 ' + (index + 1) + ' 张（瞬时切换，' + reason + '）'); return; }
      var from = parseFloat(track.style.transform.replace(/[^-\d.]/g, '')) || x();
      spring = createSpring({ onUpdate: function (v) { track.style.transform = 'translate3d(' + v + 'px,0,0)'; } }, from, x(), {
        preset: 'snap',
        onComplete: function () { spring = null; paint(); }
      });
      dotEls.forEach(function (dot, k) { dot.classList.toggle('is-on', k === index); });
      setText(status, '第 ' + (index + 1) + ' / ' + CARDS.length + ' 张（' + reason + '）· snap 预设吸附');
    }
    ML.on(view, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      stopSpring();
      drag = { x0: ev.clientX, base: x(), id: ev.pointerId, moved: 0 };
      cap(view, ev.pointerId);
    });
    ML.on(view, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var dx = ev.clientX - drag.x0;
      drag.moved = dx;
      track.style.transform = 'translate3d(' + (drag.base + dx) + 'px,0,0)';
      var th = Math.max(60, width() * 0.25);
      setText(status, '位移 ' + Math.round(dx) + 'px · 阈值 ' + Math.round(th) + 'px' + (Math.abs(dx) >= th ? ' · 松手即切换' : ''));
    });
    function end(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      var dx = drag.moved;
      drag = null;
      var th = Math.max(60, width() * 0.25);
      if (dx <= -th) go(index + 1, '滑动超过阈值');
      else if (dx >= th) go(index - 1, '滑动超过阈值');
      else {
        go(index, '未过阈值回弹');
        setText(status, '未过阈值（' + Math.round(Math.abs(dx)) + 'px < ' + Math.round(th) + 'px）· 回弹到第 ' + (index + 1) + ' 张');
      }
    }
    ML.on(view, 'pointerup', end);
    ML.on(view, 'pointercancel', end);
    ML.on(view, 'keydown', function (ev) {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(index + 1, '键盘 →'); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(index - 1, '键盘 ←'); }
      else if (ev.key === 'Home') { ev.preventDefault(); go(0, '键盘 Home'); }
      else if (ev.key === 'End') { ev.preventDefault(); go(CARDS.length - 1, '键盘 End'); }
    });
    if (prev) ML.on(prev, 'click', function () { go(index - 1, '按钮'); view.focus(); });
    if (next) ML.on(next, 'click', function () { go(index + 1, '按钮'); view.focus(); });
    if (ML.observeSize) ML.observeSize(view, function () { paint(); });
    paint();
  }

  /* ------------------------------------------------------ 09 拖动滑块 */
  function bootSlider() {
    var track = q('#gp-slider-track'), fill = q('#gp-slider-fill'), thumb = q('#gp-slider-thumb');
    var valueOut = q('#gp-slider-value'), status = q('#gp-slider-status');
    if (!track || !fill || !thumb) return;
    var value = 45, drag = null;
    function maxX() { return Math.max(0, track.clientWidth - 28); }
    function paint() {
      var p = value / 100;
      fill.style.transform = 'scaleX(' + p + ')';
      thumb.style.transform = 'translate3d(' + (p * maxX()) + 'px,-50%,0)';
      setText(valueOut, String(Math.round(value)));
      track.setAttribute('aria-valuenow', String(Math.round(value)));
      track.setAttribute('aria-valuetext', Math.round(value) + ' 分（0–100）');
    }
    function set(v, reason) {
      value = clamp(v, 0, 100);
      paint();
      setText(status, '当前 ' + Math.round(value) + ' 分（' + reason + '）· 键盘：←→ ±1、PageUp/Down ±10、Home/End 首末');
    }
    function fromClient(x) {
      var r = rectOf(track);
      return ((x - r.left - 14) / Math.max(1, maxX())) * 100;
    }
    ML.on(track, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      cap(track, ev.pointerId);
      drag = { id: ev.pointerId };
      set(fromClient(ev.clientX), '拖动');
      track.focus();
      ev.preventDefault();
    });
    ML.on(track, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      set(fromClient(ev.clientX), '拖动跟手 0ms');
    });
    function end(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      drag = null;
      setText(status, '松手停在 ' + Math.round(value) + ' 分（aria-valuenow 已同步，读屏可直接播报）');
    }
    ML.on(track, 'pointerup', end);
    ML.on(track, 'pointercancel', end);
    ML.on(track, 'keydown', function (ev) {
      var step = 1;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') step = 1;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') step = -1;
      else if (ev.key === 'PageUp') step = 10;
      else if (ev.key === 'PageDown') step = -10;
      else if (ev.key === 'Home') { ev.preventDefault(); set(0, '键盘 Home'); return; }
      else if (ev.key === 'End') { ev.preventDefault(); set(100, '键盘 End'); return; }
      else return;
      ev.preventDefault();
      set(value + step, '键盘 ' + (step > 0 ? '+' : '') + step);
    });
    if (ML.observeSize) ML.observeSize(track, paint);
    paint();
  }

  /* --------------------------------------------- 10 触摸目标尺寸 */
  function bootTarget() {
    var strip = q('#gp-target-strip'), toggle = q('#gp-target-toggle'), status = q('#gp-target-status');
    if (!strip) return;
    var counts = { 32: 0, 44: 0, 56: 0 };
    qa('.gp-hit', strip).forEach(function (btn) {
      ML.on(btn, 'click', function () {
        var size = btn.dataset.size;
        counts[size]++;
        setText(q('#gp-hit-' + size), '命中 ' + counts[size] + ' 次');
        var note = size === '32'
          ? '32px 低于 44px 阈值：边缘点击容易落到相邻目标上'
          : size === '44'
            ? '44px 正好达到 WCAG 2.5.5 的最小目标尺寸'
            : '56px 留出额外容错，适合移动端主操作';
        setText(status, size + 'px 目标命中 ' + counts[size] + ' 次 · ' + note);
      });
    });
    var on = true;
    if (toggle) ML.on(toggle, 'click', function () {
      on = !on;
      strip.classList.toggle('gp-target--lines', on);
      toggle.setAttribute('aria-pressed', String(on));
      setText(toggle, on ? '隐藏 44px 参考线' : '显示 44px 参考线');
      setText(status, on ? '44px 参考线已显示（虚线框）· 相邻目标间距建议 ≥8px' : '44px 参考线已隐藏 · 可再次显示对比');
    });
    strip.classList.add('gp-target--lines');
  }

  /* ------------------------------------------- 11 手势阈值与防误触 */
  function bootThreshold() {
    var area = q('#gp-thresh-area'), box = q('#gp-thresh-box');
    var distOut = q('#gp-thresh-dist'), stateOut = q('#gp-thresh-state'), axisOut = q('#gp-thresh-axis'), status = q('#gp-thresh-status');
    var zones = {
      dead: q('.gp-thresh__zone--dead'),
      maybe: q('.gp-thresh__zone--maybe'),
      on: q('.gp-thresh__zone--on')
    };
    if (!area || !box) return;
    var x = 0, y = 0, drag = null;
    var DEAD = 8, CONFIRM = 40;
    function judge() {
      var dist = Math.hypot(x, y);
      var state = dist < DEAD ? '未识别（死区）' : dist < CONFIRM ? '待定（可能误触）' : '已确认（手势成立）';
      var key = dist < DEAD ? 'dead' : dist < CONFIRM ? 'maybe' : 'on';
      var axis = dist < DEAD ? '—' : Math.abs(x) >= Math.abs(y) ? '水平（锁定 X）' : '垂直（锁定 Y）';
      Object.keys(zones).forEach(function (k) {
        if (zones[k]) zones[k].classList.toggle('is-active', k === key);
      });
      setText(distOut, Math.round(dist) + ' px');
      setText(stateOut, state);
      setText(axisOut, axis);
      return { dist: dist, state: state, key: key };
    }
    function apply() {
      box.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }
    ML.on(box, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      drag = { x0: ev.clientX, y0: ev.clientY, bx: x, by: y, id: ev.pointerId };
      cap(box, ev.pointerId);
      ev.preventDefault();
    });
    ML.on(box, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      x = drag.bx + (ev.clientX - drag.x0);
      y = drag.by + (ev.clientY - drag.y0);
      apply();
      var r = judge();
      setText(status, '位移 ' + Math.round(r.dist) + 'px · ' + r.state + ' · 死区 ' + DEAD + 'px / 确认阈值 ' + CONFIRM + 'px');
    });
    function end(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      drag = null;
      var r = judge();
      setText(status, '松手于 ' + r.state + ' · 位移 ' + Math.round(r.dist) + 'px（未确认的手势不产生副作用）');
    }
    ML.on(box, 'pointerup', end);
    ML.on(box, 'pointercancel', end);
    ML.on(box, 'keydown', function (ev) {
      var step = 4, dx = 0, dy = 0;
      if (ev.key === 'ArrowLeft') dx = -step;
      else if (ev.key === 'ArrowRight') dx = step;
      else if (ev.key === 'ArrowUp') dy = -step;
      else if (ev.key === 'ArrowDown') dy = step;
      else if (ev.key === 'Escape') { ev.preventDefault(); x = 0; y = 0; apply(); judge(); setText(status, 'Esc：位移归零并回到死区'); return; }
      else return;
      ev.preventDefault();
      x += dx; y += dy;
      apply();
      var r = judge();
      setText(status, '键盘步进 4px · 累计位移 ' + Math.round(r.dist) + 'px · ' + r.state);
    });
    judge();
    apply();
  }

  /* ---------------------------------------- 12 手势冲突避免（touch-action） */
  function bootConflict() {
    var select = q('#gp-conflict-select'), card = q('#gp-conflict-card'), valueOut = q('#gp-conflict-value');
    var none = q('#gp-conflict-none'), dot = q('#gp-conflict-dot'), scroll = q('#gp-conflict-scroll'), status = q('#gp-conflict-status');
    if (!select || !card) return;
    var drag = null, dx = 0, spring = null;
    var dotDrag = null, dx2 = 0, dy2 = 0;
    function maxX() { return Math.max(40, (scroll ? scroll.clientWidth : 300) - card.clientWidth - 24); }
    ML.on(select, 'change', function () {
      card.style.touchAction = select.value;
      setText(valueOut, select.value);
      setText(status, '左栏 touch-action 已切换为 ' + select.value + ' · ' +
        (select.value === 'pan-y' ? '纵向滚动归页面、横向归卡片（推荐）'
          : select.value === 'none' ? '完全接管：纵向手势不再滚动内容'
            : select.value === 'manipulation' ? '仅移除双击缩放延迟，纵向仍归浏览器'
              : '浏览器默认：手势冲突与误触发概率最高'));
    });
    function cardX() { return dx; }
    ML.on(card, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      if (spring) { spring.stop(); spring = null; }
      drag = { x0: ev.clientX, base: cardX(), id: ev.pointerId };
      cap(card, ev.pointerId);
      ev.preventDefault();
    });
    ML.on(card, 'pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      dx = clamp(drag.base + (ev.clientX - drag.x0), -maxX(), maxX());
      card.style.transform = 'translate3d(' + dx + 'px,0,0)';
      setText(status, '横向手势被卡片接管：' + Math.round(dx) + 'px（纵向拖动该区域仍可滚动内容）');
    });
    function endCard(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      drag = null;
      if (reduced()) { dx = 0; card.style.transform = 'translate3d(0,0,0)'; setText(status, '降级：卡片瞬时归位'); return; }
      spring = createSpring({ onUpdate: function (v) { dx = v; card.style.transform = 'translate3d(' + v + 'px,0,0)'; } }, dx, 0, {
        preset: 'snap',
        onComplete: function () { spring = null; setText(status, '卡片回弹归位 · 横向手势与纵向滚动没有互相抢事件'); }
      });
    }
    ML.on(card, 'pointerup', endCard);
    ML.on(card, 'pointercancel', endCard);
    ML.on(card, 'keydown', function (ev) {
      var step = 24, dir = 0;
      if (ev.key === 'ArrowRight') dir = 1;
      else if (ev.key === 'ArrowLeft') dir = -1;
      else if (ev.key === 'Home' || ev.key === 'Escape') {
        ev.preventDefault();
        dx = 0;
        card.style.transform = 'translate3d(0,0,0)';
        setText(status, '键盘归位：卡片回到起点（横向手势的键盘等价操作）');
        return;
      } else return;
      ev.preventDefault();
      dx = clamp(dx + dir * step, -maxX(), maxX());
      card.style.transform = 'translate3d(' + dx + 'px,0,0)';
      setText(status, '键盘横向移动 ' + step + 'px · 当前 ' + Math.round(dx) + 'px，Home 归位');
    });
    if (none && dot) {
      ML.on(none, 'pointerdown', function (ev) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        dotDrag = { x0: ev.clientX, y0: ev.clientY, bx: dx2, by: dy2, id: ev.pointerId };
        cap(none, ev.pointerId);
        ev.preventDefault();
      });
      ML.on(none, 'pointermove', function (ev) {
        if (!dotDrag || ev.pointerId !== dotDrag.id) return;
        var lim = 0.5;
        dx2 = clamp(dotDrag.bx + (ev.clientX - dotDrag.x0), -none.clientWidth * lim, none.clientWidth * lim);
        dy2 = clamp(dotDrag.by + (ev.clientY - dotDrag.y0), -none.clientHeight * lim, none.clientHeight * lim);
        dot.style.transform = 'translate3d(' + dx2 + 'px,' + dy2 + 'px,0)';
        setText(dot, String(Math.round(Math.hypot(dx2, dy2))));
        setText(status, '右栏 touch-action: none 完全接管指针 · 位移 ' + Math.round(Math.hypot(dx2, dy2)) + 'px（页面不会滚动）');
      });
      function endDot(ev) {
        if (!dotDrag || (ev && ev.pointerId !== dotDrag.id)) return;
        dotDrag = null;
        setText(status, '右栏松手 · 标记停在 ' + Math.round(Math.hypot(dx2, dy2)) + 'px（键盘 ↑↓←→ 可移动，Esc 归位）');
      }
      ML.on(none, 'pointerup', endDot);
      ML.on(none, 'pointercancel', endDot);
      ML.on(none, 'keydown', function (ev) {
        var step = 12, mx = 0, my = 0;
        if (ev.key === 'ArrowLeft') mx = -step;
        else if (ev.key === 'ArrowRight') mx = step;
        else if (ev.key === 'ArrowUp') my = -step;
        else if (ev.key === 'ArrowDown') my = step;
        else if (ev.key === 'Escape') { ev.preventDefault(); dx2 = 0; dy2 = 0; dot.style.transform = 'translate3d(0,0,0)'; setText(status, 'Esc：右栏标记归位'); return; }
        else return;
        ev.preventDefault();
        dx2 += mx; dy2 += my;
        dot.style.transform = 'translate3d(' + dx2 + 'px,' + dy2 + 'px,0)';
        setText(dot, String(Math.round(Math.hypot(dx2, dy2))));
        setText(status, '键盘移动右栏标记 · 位移 ' + Math.round(Math.hypot(dx2, dy2)) + 'px');
      });
    }
  }

  function boot() {
    if (!window.ML) return;
    hydrateIcons(d);
    [bootSort, bootSwipe, bootRubber, bootDrop, bootLongPress, bootRefresh, bootPinch, bootCards, bootSlider, bootTarget, bootThreshold, bootConflict]
      .forEach(function (fn) { try { fn(); } catch (err) { /* 单个 demo 失败不阻塞其它 */ } });
  }

  d.addEventListener('ml:ready', boot, { once: true });
})();
