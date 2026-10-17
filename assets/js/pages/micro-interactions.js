/* ============================================================================
   展厅 A · 微交互 —— 页面脚本
   只使用 CONTRACT.md §3 列出的 ML.* API；无外部请求；无 console 输出。
   ========================================================================== */
(function () {
  'use strict';

  /* 动效档位是运行期可变的（外壳有「动效强度」切换），每次都实时读取 */
  function soft() {
    return ML.motion.get() !== 'on';
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function setVar(el, name, value) {
    if (el) el.style.setProperty(name, value);
  }

  /* 把用户选择写回 localStorage —— inline.js 会在下次首帧前恢复，避免状态闪跳 */
  function persist(patch) {
    try {
      var cur = {};
      var raw = window.localStorage.getItem('ml-mi-state');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') cur = parsed;
      }
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
      }
      window.localStorage.setItem('ml-mi-state', JSON.stringify(cur));
    } catch (err) {
      /* 存储不可用：忽略，不影响交互 */
    }
  }

  function initialAttr(name) {
    return document.documentElement.getAttribute(name);
  }

  /* 句柄的 isRunning 在不同实现下可能是属性或方法，统一取值 */
  function springBusy(h) {
    if (!h) return false;
    return typeof h.isRunning === 'function' ? !!h.isRunning() : !!h.isRunning;
  }

  /* ==========================================================================
     01 按钮按压物理
     ========================================================================== */
  function initPress() {
    var btns = ML.qa('[data-mi-press]');
    if (!btns.length) return;
    var outScale = ML.q('[data-mi-press-out]');
    var outPeak = ML.q('[data-mi-press-peak]');
    var outEv = ML.q('[data-mi-press-ev]');
    var peak = 1;

    function report(el) {
      var v = num(el.style.getPropertyValue('--mi-press-scale'), 1);
      if (v < peak) peak = v;
      if (outScale) outScale.textContent = v.toFixed(3);
      if (outPeak) outPeak.textContent = peak.toFixed(3);
    }

    function to(el, target, source) {
      if (outEv) outEv.textContent = source;
      if (soft()) {
        setVar(el, '--mi-press-scale', '1');
        report(el);
        return;
      }
      if (springBusy(el._miSpring)) {
        el._miSpring.setTarget(target);
        return;
      }
      var from = num(el.style.getPropertyValue('--mi-press-scale'), 1);
      el._miSpring = ML.spring(
        {
          onUpdate: function (v) {
            setVar(el, '--mi-press-scale', String(v));
            report(el);
          }
        },
        from,
        target,
        { preset: 'snap' }
      );
    }

    btns.forEach(function (el) {
      var down = false;

      function press(source) {
        down = true;
        el.classList.add('is-press');
        el.setAttribute('data-mi-source', source);
        to(el, 0.96, source === 'key' ? 'keydown' : 'pointerdown');
      }
      function release(source) {
        if (!down) return;
        down = false;
        el.classList.remove('is-press');
        el.removeAttribute('data-mi-source');
        to(el, 1, source === 'key' ? 'keyup' : 'pointerup');
      }

      ML.on(el, 'pointerdown', function () { press('pointer'); });
      ML.on(el, 'pointerup', function () { release('pointer'); });
      ML.on(el, 'pointercancel', function () { release('pointer'); });
      ML.on(el, 'pointerleave', function () { release('pointer'); });
      ML.on(el, 'keydown', function (e) {
        if ((e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') && !e.repeat) press('key');
      });
      ML.on(el, 'keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') release('key');
      });
      ML.on(el, 'blur', function () { release('key'); });
    });
  }

  /* ==========================================================================
     02 涟漪扩散（涟漪本体由内核 .ripple-host 生成，这里只做计数与键盘等效）
     ========================================================================== */
  function initRipple() {
    var surface = ML.q('[data-mi-ripple]');
    if (!surface) return;
    var outCount = ML.q('[data-mi-ripple-count]');
    var outLive = ML.q('[data-mi-ripple-live]');
    var total = 0;

    function tally() {
      total++;
      if (outCount) outCount.textContent = String(total);
      if (outLive) outLive.textContent = String(ML.qa('.ripple', surface).length);
    }

    ML.on(surface, 'pointerdown', function () {
      if (soft()) {
        surface.classList.add('is-flash');
        window.setTimeout(function () { surface.classList.remove('is-flash'); }, 180);
      }
      tally();
    });

    /* 键盘等效：在表面中心派发一次合成 pointerdown，交给内核同一条涟漪路径 */
    ML.on(surface, 'keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      if (e.repeat) return;
      if (typeof window.PointerEvent !== 'function') return;
      var r = surface.getBoundingClientRect();
      surface.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2
        })
      );
    });
  }

  /* ==========================================================================
     03 磁吸悬停
     ========================================================================== */
  function initMagnet() {
    var field = ML.q('[data-mi-magnet-field]');
    var puck = ML.q('[data-mi-magnet-puck]');
    if (!field || !puck) return;
    var outX = ML.q('[data-mi-magnet-x]');
    var outY = ML.q('[data-mi-magnet-y]');
    var outK = ML.q('[data-mi-magnet-k]');

    var STRENGTH = 10;
    var STEP = 2.5;
    var tx = 0, ty = 0, cx = 0, cy = 0;
    var keyMode = false;

    function apply() {
      setVar(puck, '--mi-mx', cx.toFixed(2) + 'px');
      setVar(puck, '--mi-my', cy.toFixed(2) + 'px');
      if (outX) outX.textContent = cx.toFixed(1);
      if (outY) outY.textContent = cy.toFixed(1);
    }
    if (outK) outK.textContent = String(STRENGTH);

    function clampMag(x, y) {
      var m = Math.sqrt(x * x + y * y);
      if (m <= STRENGTH || m === 0) return [x, y];
      return [(x / m) * STRENGTH, (y / m) * STRENGTH];
    }

    /* 用 ML.schedule 逐帧追帧（到位即返回 false 停表，避免常驻 rAF） */
    var cancelLoop = null;

    function step() {
      if (keyMode) return false;
      var nx = ML.lerp(cx, tx, 0.18);
      var ny = ML.lerp(cy, ty, 0.18);
      var settled = Math.abs(nx - cx) < 0.01 && Math.abs(ny - cy) < 0.01;
      cx = settled ? tx : nx;
      cy = settled ? ty : ny;
      apply();
      return settled ? false : undefined;
    }

    function kick() {
      if (cancelLoop) return;
      cancelLoop = ML.schedule(step, function () { cancelLoop = null; });
    }

    ML.on(field, 'pointermove', function (e) {
      if (soft()) return;
      var r = field.getBoundingClientRect();
      var p = clampMag(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
      tx = p[0]; ty = p[1];
      keyMode = false;
      kick();
    });
    ML.on(field, 'pointerleave', function () { tx = 0; ty = 0; kick(); });

    ML.on(field, 'keydown', function (e) {
      var handled = true;
      if (e.key === 'ArrowLeft') { tx = ML.clamp(tx - STEP, -STRENGTH, STRENGTH); }
      else if (e.key === 'ArrowRight') { tx = ML.clamp(tx + STEP, -STRENGTH, STRENGTH); }
      else if (e.key === 'ArrowUp') { ty = ML.clamp(ty - STEP, -STRENGTH, STRENGTH); }
      else if (e.key === 'ArrowDown') { ty = ML.clamp(ty + STEP, -STRENGTH, STRENGTH); }
      else if (e.key === 'Home') { tx = 0; ty = 0; }
      else { handled = false; }
      if (!handled) return;
      e.preventDefault();
      keyMode = true;
      cx = tx; cy = ty;
      apply();
    });
  }

  /* ==========================================================================
     04 悬停下划线绘制
     ========================================================================== */
  function initUnderline() {
    var items = ML.qa('[data-mi-ul]');
    if (!items.length) return;
    var out = ML.q('[data-mi-ul-out]');

    items.forEach(function (item) {
      var link = ML.q('.mi-underline__link', item);
      if (!link) return;
      var label = (link.textContent || '').trim();

      ML.on(link, 'focus', function () { if (out) out.textContent = label; });
      ML.on(link, 'blur', function () { if (out) out.textContent = '无'; });

      /* 触摸设备没有 hover：点击后驻留下划线 1.2s */
      ML.on(link, 'click', function (e) {
        e.preventDefault();
        item.classList.add('is-hot');
        if (out) out.textContent = label;
        window.setTimeout(function () { item.classList.remove('is-hot'); }, 1200);
      });
    });
  }

  /* ==========================================================================
     05 开关（含拖动）
     ========================================================================== */
  function initSwitch() {
    var sw = ML.q('[data-mi-switch]');
    if (!sw) return;
    var thumb = ML.q('.mi-switch__thumb', sw);
    var stateOut = ML.q('[data-mi-switch-state]');
    var dragOut = ML.q('[data-mi-switch-drag]');
    var travelOut = ML.q('[data-mi-switch-travel]');
    var evOut = ML.q('[data-mi-switch-ev]');
    if (!thumb) return;

    var on = false;
    var travel = 22;
    var dragging = false;
    var suppressClick = false;
    var startX = 0;
    var startOffset = 0;
    var offset = 0;

    /* 依据真实盒模型测量行程：width - padding - border - thumb，避免 box-sizing 假设 */
    function measure() {
      var cs = window.getComputedStyle(sw);
      var rect = sw.getBoundingClientRect();
      var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      var bd = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      var th = thumb.getBoundingClientRect().width;
      var t = rect.width - pad - bd - th;
      if (isFinite(t) && t > 0) travel = t;
      if (travelOut) travelOut.textContent = String(Math.round(travel));
    }

    function setOffset(v, animate) {
      offset = ML.clamp(v, 0, travel);
      if (!animate || soft()) {
        setVar(sw, '--mi-switch-x', offset + 'px');
        if (sw._miSpring) { sw._miSpring.stop(); sw._miSpring = null; }
      } else {
        if (springBusy(sw._miSpring)) {
          sw._miSpring.setTarget(offset);
        } else {
          var from = num(sw.style.getPropertyValue('--mi-switch-x'), 0);
          sw._miSpring = ML.spring(
            { onUpdate: function (v) { setVar(sw, '--mi-switch-x', v.toFixed(2) + 'px'); } },
            from,
            offset,
            { preset: 'snap' }
          );
        }
      }
      if (dragOut) dragOut.textContent = Math.round(offset);
    }

    function commit(next, source) {
      on = next;
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      if (stateOut) stateOut.textContent = on ? 'ON' : 'OFF';
      if (evOut) evOut.textContent = source;
      setOffset(on ? travel : 0, true);
      persist({ switch: on });
    }

    measure();
    on = initialAttr('data-mi-switch') === 'on';
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    if (stateOut) stateOut.textContent = on ? 'ON' : 'OFF';
    setOffset(on ? travel : 0, false);
    ML.on(window, 'resize', function () {
      measure();
      setOffset(on ? travel : 0, false);
    });

    ML.on(sw, 'pointerdown', function (e) {
      dragging = true;
      suppressClick = true;
      startX = e.clientX;
      startOffset = offset;
      sw.classList.add('is-drag');
      if (sw.setPointerCapture) { try { sw.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ } }
    });

    ML.on(sw, 'pointermove', function (e) {
      if (!dragging) return;
      setOffset(startOffset + (e.clientX - startX), false);
      if (dragOut) dragOut.textContent = Math.round(offset);
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      sw.classList.remove('is-drag');
      var next = offset > travel / 2;
      if (Math.abs(offset - startOffset) < 3) next = !on; /* 视为点击 */
      commit(next, 'drag');
    }
    ML.on(sw, 'pointerup', endDrag);
    ML.on(sw, 'pointercancel', endDrag);

    ML.on(sw, 'click', function () {
      if (suppressClick) { suppressClick = false; return; }
      commit(!on, 'click');
    });

    ML.on(sw, 'keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); commit(false, 'keydown'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); commit(true, 'keydown'); }
    });
  }

  /* ==========================================================================
     06 复选框画勾
     ========================================================================== */
  function initCheck() {
    var boxes = ML.qa('[data-mi-check]');
    if (!boxes.length) return;
    var out = ML.q('[data-mi-check-out]');

    function report() {
      if (!out) return;
      var n = 0;
      boxes.forEach(function (b) { if (b.checked) n++; });
      out.textContent = String(n);
    }

    boxes.forEach(function (b) {
      ML.on(b, 'change', function () {
        var label = b.closest ? b.closest('.mi-check') : null;
        if (label && !soft()) {
          label.classList.remove('is-pop');
          /* 强制回流以便重复触发同一条动画 */
          void label.offsetWidth;
          label.classList.add('is-pop');
          window.setTimeout(function () { label.classList.remove('is-pop'); }, 180);
        }
        report();
      });
    });
    report();
  }

  /* ==========================================================================
     07 单选滑动指示器
     ========================================================================== */
  function initRadio() {
    var group = ML.q('[data-mi-radio]');
    if (!group) return;
    var opts = ML.qa('[data-mi-radio-opt]', group);
    if (!opts.length) return;
    var out = ML.q('[data-mi-radio-out]');
    var nameOut = ML.q('[data-mi-radio-name]');
    var step = 52;
    var idx = 0;

    function select(i, focus) {
      idx = ML.clamp(i, 0, opts.length - 1);
      opts.forEach(function (o, n) {
        var isOn = n === idx;
        o.setAttribute('aria-checked', isOn ? 'true' : 'false');
        o.tabIndex = isOn ? 0 : -1;
      });
      setVar(group, '--mi-idx', String(idx));
      if (out) out.textContent = String(idx * step);
      if (nameOut) nameOut.textContent = (opts[idx].textContent || '').replace(/^.*·\s*/, '').trim();
      if (focus) opts[idx].focus();
    }

    ML.on(group, 'click', function (e) {
      var o = e.target.closest ? e.target.closest('[data-mi-radio-opt]') : null;
      if (!o) return;
      select(opts.indexOf(o), false);
      opts[idx].focus();
    });

    ML.on(group, 'keydown', function (e) {
      var cur = opts.indexOf(document.activeElement);
      if (cur < 0) cur = idx;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select(cur + 1, true); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select(cur - 1, true); }
      else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      else if (e.key === 'End') { e.preventDefault(); select(opts.length - 1, true); }
    });

    select(0, false);
  }

  /* ==========================================================================
     08 分段控件（行为交给内核 ML.UI.tabs，指示器 .tabbar__indicator）
     ========================================================================== */
  function initSegmented() {
    var seg = ML.q('[data-mi-seg]');
    if (!seg) return;
    var out = ML.q('[data-mi-seg-out]');
    var startIdx = parseInt(initialAttr('data-mi-seg'), 10);

    var api = ML.UI.tabs(seg, {
      onChange: function (index, btn) {
        if (out) out.textContent = (btn.textContent || '').trim();
        persist({ seg: index });
      }
    });
    if (!api) return;

    if (isFinite(startIdx) && startIdx > 0 && startIdx < api.buttons.length) {
      api.select(startIdx, false);
    }
  }

  /* ==========================================================================
     09 点赞爆发
     ========================================================================== */
  function initLike() {
    var btn = ML.q('[data-mi-like]');
    if (!btn) return;
    var burstHost = ML.q('[data-mi-like-burst]', btn);
    var countOut = ML.q('[data-mi-like-count]', btn);
    var stateOut = ML.q('[data-mi-like-state]');
    var peakOut = ML.q('[data-mi-like-peak]');
    var resetBtn = ML.q('[data-mi-like-reset]');
    var BASE = 128;
    var on = false;
    var count = BASE;
    var peak = 1;

    function setCount(v) {
      count = v;
      if (countOut) countOut.textContent = String(count);
    }

    function burst() {
      if (!burstHost || soft()) return;
      var n = 6;
      for (var i = 0; i < n; i++) {
        var ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        var rad = 24 + (i % 2) * 8;
        var p = document.createElement('i');
        p.className = 'mi-like__p';
        p.style.setProperty('--mi-bx', (Math.cos(ang) * rad).toFixed(1) + 'px');
        p.style.setProperty('--mi-by', (Math.sin(ang) * rad).toFixed(1) + 'px');
        ML.once(p, 'animationend', function () { this.remove(); }.bind(p));
        burstHost.appendChild(p);
      }
    }

    function animateHeart(to) {
      var glyph = ML.q('.mi-like__glyph', btn);
      if (!glyph) return;
      if (soft()) {
        setVar(glyph, '--mi-heart-scale', '1');
        return;
      }
      if (springBusy(glyph._miSpring)) {
        glyph._miSpring.setTarget(to);
        return;
      }
      var from = num(glyph.style.getPropertyValue('--mi-heart-scale'), 1);
      glyph._miSpring = ML.spring(
        {
          onUpdate: function (v) {
            setVar(glyph, '--mi-heart-scale', v.toFixed(4));
            if (v > peak) {
              peak = v;
              if (peakOut) peakOut.textContent = peak.toFixed(3);
            }
          }
        },
        from,
        to,
        { preset: 'playful' }
      );
    }

    ML.on(btn, 'click', function () {
      on = !on;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (stateOut) stateOut.textContent = on ? '已点赞' : '未点赞';
      setCount(count + (on ? 1 : -1));
      if (on) {
        animateHeart(1.34);
        /* 过冲后回到 1，避免按钮长期处于放大态 */
        ML.wait(220).then(function () { animateHeart(1); });
        burst();
      } else {
        animateHeart(0.86);
        ML.wait(140).then(function () { animateHeart(1); });
      }
    });

    if (resetBtn) {
      ML.on(resetBtn, 'click', function () {
        on = false;
        btn.setAttribute('aria-pressed', 'false');
        if (stateOut) stateOut.textContent = '未点赞';
        setCount(BASE);
        peak = 1;
        if (peakOut) peakOut.textContent = '1.000';
        animateHeart(1);
      });
    }

    setCount(BASE);
  }

  /* ==========================================================================
     10 星级评分（半星）
     ========================================================================== */
  var STAR_PATH = 'M12 3.4l2.63 5.33 5.87.86-4.25 4.14 1 5.85L12 16.85 6.75 19.6l1-5.85L3.5 9.6l5.87-.86z';

  function starSVG(cls, fill) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="' + fill +
      '" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="' +
      STAR_PATH + '"/></svg>';
  }

  function initRating() {
    var root = ML.q('[data-mi-rating]');
    if (!root) return;
    var host = ML.q('[data-mi-rating-stars]', root);
    var outVal = ML.q('[data-mi-rating-out]', root);
    var hoverOut = ML.q('[data-mi-rating-hover]');
    var valOut = ML.q('[data-mi-rating-val]');
    if (!host) return;

    var TOTAL = 5;
    var value = num(root.getAttribute('data-value'), 3.5);
    var stars = [];
    for (var i = 0; i < TOTAL; i++) {
      var s = ML.create('span', { class: 'mi-star', html: starSVG('mi-star__base', 'none') });
      var fill = ML.create('span', { class: 'mi-star__fill', html: starSVG('mi-star__svg-fill', 'currentColor') });
      fill.style.display = 'block';
      s.appendChild(fill);
      host.appendChild(s);
      stars.push(s);
    }

    function paint(v) {
      stars.forEach(function (s, n) {
        var part = ML.clamp(v - n, 0, 1);
        s.style.setProperty('--mi-star-cut', ((1 - part) * 100).toFixed(1) + '%');
      });
    }

    function commit(v, pop) {
      value = Math.round(ML.clamp(v, 0, TOTAL) * 2) / 2;
      root.setAttribute('aria-valuenow', String(value));
      root.setAttribute('aria-valuetext', value + ' 星');
      paint(value);
      if (outVal) outVal.textContent = value + ' / 5';
      if (valOut) valOut.textContent = String(value);
      if (pop && !soft()) {
        stars.forEach(function (s, n) {
          if (n >= Math.ceil(value)) return;
          s.classList.remove('is-pop');
          void s.offsetWidth;
          s.classList.add('is-pop');
          window.setTimeout(function () { s.classList.remove('is-pop'); }, 170);
        });
      }
    }

    function valueFromX(clientX) {
      var r = host.getBoundingClientRect();
      var t = ML.clamp((clientX - r.left) / r.width, 0, 1);
      return Math.round(t * TOTAL * 2) / 2;
    }

    ML.on(root, 'pointermove', function (e) {
      var v = valueFromX(e.clientX);
      paint(v);
      if (hoverOut) hoverOut.textContent = String(v);
    });
    ML.on(root, 'pointerleave', function () {
      paint(value);
      if (hoverOut) hoverOut.textContent = '—';
    });
    ML.on(root, 'click', function (e) { commit(valueFromX(e.clientX), true); });

    ML.on(root, 'keydown', function (e) {
      var handled = true;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') commit(value + 0.5, true);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') commit(value - 0.5, true);
      else if (e.key === 'Home') commit(0, true);
      else if (e.key === 'End') commit(TOTAL, true);
      else if (/^[0-5]$/.test(e.key)) commit(parseInt(e.key, 10), true);
      else handled = false;
      if (handled) e.preventDefault();
    });

    commit(value, false);
    if (hoverOut) hoverOut.textContent = '—';
  }

  /* ==========================================================================
     11 复制成功形变
     ========================================================================== */
  function initCopy() {
    var btn = ML.q('[data-mi-copy]');
    if (!btn) return;
    var codeEl = ML.q('[data-mi-copy-text]');
    var iconHost = ML.q('[data-mi-copy-icon]');
    var labelEl = ML.q('[data-mi-copy-label]');
    var outEl = ML.q('[data-mi-copy-out]');
    var cdEl = ML.q('[data-mi-copy-cd]');
    var timer = null;
    var countdown = null;

    if (iconHost) {
      iconHost.appendChild(ML.UI.icon('copy', { size: 20, cls: 'mi-copy__ico-a' }));
      iconHost.appendChild(ML.UI.icon('check', { size: 20, cls: 'mi-copy__ico-b' }));
    }

    function finish(ok) {
      if (outEl) outEl.textContent = ok ? '已复制' : '复制失败（请手动选择）';
      if (!ok) return;
      if (iconHost) iconHost.classList.add('is-done');
      if (labelEl) labelEl.textContent = '已复制';
      var left = 1.6;
      if (cdEl) cdEl.textContent = left.toFixed(1) + 's';
      window.clearInterval(countdown);
      countdown = window.setInterval(function () {
        left -= 0.1;
        if (left <= 0) {
          window.clearInterval(countdown);
          if (cdEl) cdEl.textContent = '—';
          return;
        }
        if (cdEl) cdEl.textContent = left.toFixed(1) + 's';
      }, 100);
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (iconHost) iconHost.classList.remove('is-done');
        if (labelEl) labelEl.textContent = '复制';
        if (outEl) outEl.textContent = '待操作';
      }, 1600);
    }

    var text = codeEl ? (codeEl.textContent || '').trim() : '';

    ML.on(btn, 'click', function () {
      var p;
      try {
        p = ML.copy(text);
      } catch (err) {
        finish(false);
        return;
      }
      if (p && typeof p.then === 'function') {
        p.then(function () { finish(true); }, function () { finish(false); });
      } else {
        finish(true);
      }
    });
  }

  /* ==========================================================================
     12 进度环
     ========================================================================== */
  function initRing() {
    var ring = ML.q('[data-mi-ring]');
    if (!ring) return;
    var valOut = ML.q('[data-mi-ring-val]', ring);
    var stateOut = ML.q('[data-mi-ring-state]');
    var dtOut = ML.q('[data-mi-ring-dt]');
    var startBtn = ML.q('[data-mi-ring-start]');
    var pauseBtn = ML.q('[data-mi-ring-pause]');
    var resetBtn = ML.q('[data-mi-ring-reset]');
    var indetBtn = ML.q('[data-mi-ring-indet]');

    var TOTAL_MS = 2400;
    var progress = 0;
    var running = false;
    var cancelRaf = null;
    var maxDt = 0;
    var indet = false;

    function paint() {
      ring.style.setProperty('--mi-ring', progress.toFixed(4));
      var pct = Math.round(progress * 100);
      if (valOut) valOut.textContent = pct + '%';
      ring.setAttribute('aria-valuenow', String(pct));
      ring.setAttribute('aria-valuetext', pct + '%');
    }

    function setState(s) {
      if (stateOut) stateOut.textContent = s;
      if (startBtn) startBtn.disabled = (s === 'running');
      if (pauseBtn) pauseBtn.disabled = !(s === 'running');
      if (startBtn) startBtn.textContent = (s === 'paused') ? '继续导出' : '开始导出';
    }

    function stop() {
      running = false;
      if (cancelRaf) { cancelRaf(); cancelRaf = null; }
    }

    function run() {
      if (running || indet) return;
      if (progress >= 1) progress = 0;
      running = true;
      setState('running');
      cancelRaf = ML.schedule(
        function (dt) {
          if (!running) return false;
          var ms = dt * 1000;
          if (ms > maxDt) {
            maxDt = ms;
            if (dtOut) dtOut.textContent = Math.round(maxDt);
          }
          progress = ML.clamp(progress + dt / (TOTAL_MS / 1000), 0, 1);
          paint();
          if (progress >= 1) {
            running = false;
            ring.classList.add('is-done');
            setState('done');
            return false;
          }
          return undefined;
        },
        function () { cancelRaf = null; }
      );
    }

    if (startBtn) {
      ML.on(startBtn, 'click', function () {
        ring.classList.remove('is-done');
        run();
      });
    }
    if (pauseBtn) {
      ML.on(pauseBtn, 'click', function () {
        stop();
        setState('paused');
      });
    }
    if (resetBtn) {
      ML.on(resetBtn, 'click', function () {
        stop();
        progress = 0;
        maxDt = 0;
        ring.classList.remove('is-done');
        paint();
        if (dtOut) dtOut.textContent = '—';
        setState('idle');
      });
    }
    if (indetBtn) {
      ML.on(indetBtn, 'click', function () {
        indet = !indet;
        indetBtn.setAttribute('aria-pressed', indet ? 'true' : 'false');
        ring.classList.toggle('is-indet', indet);
        if (indet) {
          stop();
          if (valOut) valOut.textContent = '···';
          ring.setAttribute('aria-valuetext', '进行中，进度未知');
          setState('indeterminate');
        } else {
          paint();
          setState('idle');
        }
      });
    }

    paint();
    setState('idle');
  }

  /* ==========================================================================
     13 滑块（含键盘）
     ========================================================================== */
  function initSlider() {
    var root = ML.q('[data-mi-slider]');
    if (!root) return;
    var hit = ML.q('[data-mi-slider-hit]', root);
    var track = ML.q('.mi-slider__track', root);
    if (!hit || !track) return;
    var out = ML.q('[data-mi-slider-out]', root);
    var wOut = ML.q('[data-mi-slider-w]');
    var travelOut = ML.q('[data-mi-slider-travel]');
    var evOut = ML.q('[data-mi-slider-ev]');

    var MIN = num(root.getAttribute('data-min'), 0);
    var MAX = num(root.getAttribute('data-max'), 100);
    var STEP = num(root.getAttribute('data-step'), 1);
    var THUMB = 28;
    var value = num(root.getAttribute('data-value'), 42);
    var dragging = false;

    function measure() {
      var r = track.getBoundingClientRect();
      hit.style.setProperty('--mi-track-w', r.width.toFixed(2) + 'px');
      if (wOut) wOut.textContent = String(Math.round(r.width));
      if (travelOut) travelOut.textContent = String(Math.max(0, Math.round(r.width - THUMB)));
    }

    function norm() { return (value - MIN) / (MAX - MIN); }

    function paint() {
      hit.style.setProperty('--mi-val', norm().toFixed(5));
      var pct = Math.round(norm() * 100);
      if (out) out.textContent = Math.round(value) + '%';
      hit.setAttribute('aria-valuenow', String(Math.round(value)));
      hit.setAttribute('aria-valuetext', Math.round(value) + '%');
    }

    function setValue(v, source) {
      value = ML.clamp(Math.round(v / STEP) * STEP, MIN, MAX);
      paint();
      if (evOut) evOut.textContent = source;
    }

    function fromX(clientX) {
      var r = track.getBoundingClientRect();
      var t = ML.clamp((clientX - r.left) / r.width, 0, 1);
      return MIN + t * (MAX - MIN);
    }

    measure();
    paint();
    ML.on(window, 'resize', measure);

    ML.on(hit, 'pointerdown', function (e) {
      dragging = true;
      hit.classList.add('is-drag');
      if (hit.setPointerCapture) { try { hit.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ } }
      setValue(fromX(e.clientX), 'pointerdown');
    });
    ML.on(hit, 'pointermove', function (e) {
      if (!dragging) return;
      setValue(fromX(e.clientX), 'pointermove');
    });
    function end() {
      if (!dragging) return;
      dragging = false;
      hit.classList.remove('is-drag');
      if (evOut) evOut.textContent = 'pointerup';
    }
    ML.on(hit, 'pointerup', end);
    ML.on(hit, 'pointercancel', end);

    ML.on(hit, 'keydown', function (e) {
      var handled = true;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setValue(value + STEP, 'keydown');
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setValue(value - STEP, 'keydown');
      else if (e.key === 'PageUp') setValue(value + STEP * 10, 'PageUp');
      else if (e.key === 'PageDown') setValue(value - STEP * 10, 'PageDown');
      else if (e.key === 'Home') setValue(MIN, 'Home');
      else if (e.key === 'End') setValue(MAX, 'End');
      else handled = false;
      if (handled) e.preventDefault();
    });
  }

  /* ==========================================================================
     14 加载按钮（防重复提交）
     ========================================================================== */
  function initSubmit() {
    var btn = ML.q('[data-mi-submit]');
    if (!btn) return;
    var iconHost = ML.q('[data-mi-submit-icon]', btn);
    var labelEl = ML.q('[data-mi-submit-label]', btn);
    var stateOut = ML.q('[data-mi-submit-state]');
    var blockedOut = ML.q('[data-mi-submit-blocked]');
    var runsOut = ML.q('[data-mi-submit-runs]');
    var resetBtn = ML.q('[data-mi-submit-reset]');
    var state = 'idle';
    var blocked = 0;
    var runs = 0;

    if (iconHost) {
      iconHost.appendChild(ML.UI.icon('loader', { size: 18, cls: 'mi-submit__spin spin' }));
      iconHost.appendChild(ML.UI.icon('check-circle', { size: 18, cls: 'mi-submit__ok' }));
    }

    function set(stateName) {
      state = stateName;
      btn.setAttribute('data-state', state);
      if (stateOut) stateOut.textContent = stateName;
      if (stateName === 'loading') {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        if (labelEl) labelEl.textContent = '提交中…';
      } else {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        if (stateName === 'done' && labelEl) labelEl.textContent = '已提交';
        if (stateName === 'idle' && labelEl) labelEl.textContent = '提交订单';
      }
    }

    ML.on(btn, 'click', function () {
      if (state !== 'idle') {
        blocked++;
        if (blockedOut) blockedOut.textContent = String(blocked);
        ML.UI.toast({ title: '已拦截重复点击', desc: '请求仍在进行中，请等待结果。', variant: 'warning', duration: 2200 });
        return;
      }
      runs++;
      if (runsOut) runsOut.textContent = String(runs);
      set('loading');
      /* 模拟网络往返用 setTimeout（不是动效），避免被 ML.wait 的 reduced-motion 兜底压缩掉 */
      window.setTimeout(function () {
        set('done');
        ML.UI.toast({ title: '提交成功', desc: '订单 #A-1042 已进入处理队列。', variant: 'success', duration: 2600 });
        window.setTimeout(function () {
          if (state === 'done') set('idle');
        }, 1200);
      }, 1400);
    });

    if (resetBtn) {
      ML.on(resetBtn, 'click', function () {
        set('idle');
        blocked = 0;
        runs = 0;
        if (blockedOut) blockedOut.textContent = '0';
        if (runsOut) runsOut.textContent = '0';
      });
    }

    set('idle');
  }

  /* ==========================================================================
     15 数值增减步进器
     ========================================================================== */
  function initStepper() {
    var root = ML.q('[data-mi-stepper]');
    if (!root) return;
    var field = ML.q('[data-mi-step-field]', root);
    var numEl = ML.q('[data-mi-step-num]', root);
    var btns = ML.qa('[data-mi-step]', root);
    var out = ML.q('[data-mi-step-out]');
    var accelOut = ML.q('[data-mi-step-accel]');
    var burstOut = ML.q('[data-mi-step-burst]');

    var MIN = num(root.getAttribute('data-min'), 1);
    var MAX = num(root.getAttribute('data-max'), 12);
    var STEP = num(root.getAttribute('data-step'), 1);
    var value = num(root.getAttribute('data-value'), 3);
    var burst = 0;
    var holdTimer = null;
    var repeatTimer = null;

    function paint(dir) {
      if (numEl) {
        numEl.textContent = String(value);
        if (dir && !soft()) {
          numEl.classList.remove('is-up', 'is-down');
          void numEl.offsetWidth;
          numEl.classList.add(dir > 0 ? 'is-up' : 'is-down');
        }
      }
      if (field) {
        field.setAttribute('aria-valuenow', String(value));
        field.setAttribute('aria-valuetext', value + ' 个席位');
      }
      if (out) out.textContent = String(value);
      btns.forEach(function (b) {
        b.disabled = (num(b.value, 1) < 0) ? value <= MIN : value >= MAX;
      });
    }

    function setValue(v, dir) {
      var next = ML.clamp(v, MIN, MAX);
      if (next === value) return false;
      var prev = value;
      value = next;
      paint(dir === undefined ? (value > prev ? 1 : -1) : dir);
      return true;
    }

    function step(delta, accelerated) {
      var moved = setValue(value + delta * STEP, delta);
      if (!moved) return;
      if (accelerated) {
        burst++;
        if (burstOut) burstOut.textContent = String(burst);
      }
    }

    btns.forEach(function (b) {
      var delta = num(b.value, 1);
      var held = false;

      ML.on(b, 'click', function () {
        if (held) { held = false; return; } /* 长按连发已逐步执行，吞掉收尾的那次 click */
        step(delta, false);
      });

      ML.on(b, 'pointerdown', function () {
        if (b.disabled) return;
        holdTimer = window.setTimeout(function () {
          held = true;
          if (accelOut) accelOut.textContent = '开启';
          repeatTimer = window.setInterval(function () { step(delta, true); }, 80);
        }, 500);
      });

      function cancel() {
        window.clearTimeout(holdTimer);
        window.clearInterval(repeatTimer);
        holdTimer = null;
        repeatTimer = null;
        if (accelOut) accelOut.textContent = '关闭';
      }
      ML.on(b, 'pointerup', cancel);
      ML.on(b, 'pointercancel', cancel);
      ML.on(b, 'pointerleave', cancel);
      ML.on(b, 'blur', cancel);
    });

    if (field) {
      ML.on(field, 'keydown', function (e) {
        var handled = true;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') step(1, false);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') step(-1, false);
        else if (e.key === 'PageUp') step(5, false);
        else if (e.key === 'PageDown') step(-5, false);
        else if (e.key === 'Home') setValue(MIN, -1);
        else if (e.key === 'End') setValue(MAX, 1);
        else handled = false;
        if (handled) e.preventDefault();
      });
    }

    paint();
  }

  /* ==========================================================================
     16 图标形变
     ========================================================================== */
  function initMorph() {
    var play = ML.q('[data-mi-morph-play]');
    var playOut = ML.q('[data-mi-morph-state]');
    var burger = ML.q('[data-mi-burger]');
    var burgerOut = ML.q('[data-mi-burger-state]');

    if (play) {
      ML.on(play, 'click', function () {
        var on = play.getAttribute('aria-pressed') === 'true';
        play.setAttribute('aria-pressed', on ? 'false' : 'true');
        play.setAttribute('aria-label', on ? '播放预览' : '暂停预览');
        if (playOut) playOut.textContent = on ? 'paused' : 'playing';
      });
    }

    if (burger) {
      ML.on(burger, 'click', function () {
        var open = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-expanded', open ? 'false' : 'true');
        burger.setAttribute('aria-label', open ? '打开菜单' : '关闭菜单');
        if (burgerOut) burgerOut.textContent = open ? 'closed' : 'open';
      });
    }
  }

  /* ==========================================================================
     boot —— 外壳注入后执行
     ========================================================================== */
  function boot() {
    if (!window.ML || typeof ML.q !== 'function') return;
    initPress();
    initRipple();
    initMagnet();
    initUnderline();
    initSwitch();
    initCheck();
    initRadio();
    initSegmented();
    initLike();
    initRating();
    initCopy();
    initRing();
    initSlider();
    initSubmit();
    initStepper();
    initMorph();
  }

  document.addEventListener('ml:ready', boot, { once: true });
})();
