/* MOTION LAB · 首页（index.html）页面脚本
   - 横向精选墙：方向键 / Home / End / 箭头按钮 / 进度指示（键盘可达）
   - 交付流程：滚动进度绘制连接线（transform: scaleY，非 height）
   - 首屏文字进入、数字滚动、揭晓、视差由 HTML 的 data-* 属性声明，内核 ML 负责
   只动 transform / opacity / CSS 变量；reduced-motion 与 data-motion 三档均不破版。 */
(function () {
  'use strict';

  function isReduced() {
    var M = window.ML;
    return !M ? true : !!M.reduced;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /* ---------------- 横向精选墙 ---------------- */
  function initWall(ML) {
    var track = ML.q('#ix-wall-track');
    if (!track) { return; }

    var cards = ML.qa('.ix-param', track);
    if (!cards.length) { return; }

    var cur = ML.q('#ix-wall-cur');
    var total = ML.q('#ix-wall-total');
    var fill = ML.q('#ix-wall-fill');
    var btnPrev = ML.q('#ix-wall-prev');
    var btnNext = ML.q('#ix-wall-next');

    if (total) { total.textContent = pad2(cards.length); }

    function stepSize() {
      if (cards.length > 1) {
        var d = cards[1].offsetLeft - cards[0].offsetLeft;
        if (d > 0) { return d; }
      }
      return Math.max(1, track.clientWidth);
    }

    function maxScroll() {
      return Math.max(0, track.scrollWidth - track.clientWidth);
    }

    function currentIndex() {
      var max = maxScroll();
      if (max > 2 && track.scrollLeft >= max - 2) { return cards.length - 1; }
      var s = stepSize();
      var i = Math.round(track.scrollLeft / s);
      return Math.min(cards.length - 1, Math.max(0, i));
    }

    function sync() {
      if (cur) { cur.textContent = pad2(currentIndex() + 1); }
      if (fill) {
        var max = track.scrollWidth;
        var visible = max > 0 ? (track.scrollLeft + track.clientWidth) / max : 1;
        var p = Math.min(1, Math.max(0.06, visible));
        fill.style.setProperty('--ix-wall-p', p.toFixed(4));
      }
    }

    function goTo(i) {
      var idx = Math.min(cards.length - 1, Math.max(0, i));
      var left = cards[idx].offsetLeft - cards[0].offsetLeft;
      var from = track.scrollLeft;
      if (isReduced()) {
        track.scrollLeft = left;
        sync();
        return;
      }
      try {
        track.scrollTo({ left: left, behavior: 'smooth' });
      } catch (err) {
        track.scrollLeft = left;
        sync();
        return;
      }
      /* 兜底 1：个别环境不执行平滑滚动（无头验证 / 系统降低动态效果），
         若 340ms 后位置毫无变化则直接落位，保证键盘与按钮永远有效。
         兜底 2：部分环境不投递 scroll 事件，这里主动重算读数与进度条。 */
      window.setTimeout(function () {
        if (Math.abs(track.scrollLeft - from) < 1 && Math.abs(left - from) > 1) {
          track.scrollLeft = left;
        }
        sync();
      }, 340);
      window.setTimeout(sync, 900);
    }

    ML.on(btnPrev, 'click', function () { goTo(currentIndex() - 1); });
    ML.on(btnNext, 'click', function () { goTo(currentIndex() + 1); });

    ML.on(track, 'keydown', function (event) {
      var k = event.key;
      var handled = true;
      if (k === 'ArrowRight') { goTo(currentIndex() + 1); }
      else if (k === 'ArrowLeft') { goTo(currentIndex() - 1); }
      else if (k === 'Home') { goTo(0); }
      else if (k === 'End') { goTo(cards.length - 1); }
      else if (k === 'PageDown') { goTo(currentIndex() + 2); }
      else if (k === 'PageUp') { goTo(currentIndex() - 2); }
      else { handled = false; }
      if (handled) { event.preventDefault(); }
    });

    ML.on(track, 'scroll', sync, { passive: true });
    sync();

    return sync;
  }

  /* ---------------- 交付流程：滚动进度线 ---------------- */
  function initFlow(ML) {
    var flow = ML.q('#ix-flow');
    if (!flow) { return; }

    function paint() {
      var rect = flow.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var start = vh * 0.82;
      var end = vh * 0.28;
      var span = rect.height + (start - end);
      var passed = start - rect.top;
      var p = span > 0 ? passed / span : 0;
      flow.style.setProperty('--ix-flow-p', Math.min(1, Math.max(0, p)).toFixed(4));
    }

    if (isReduced()) {
      flow.style.setProperty('--ix-flow-p', '1');
      return;
    }

    if (ML.scroll && typeof ML.scroll.onScroll === 'function') {
      ML.scroll.onScroll(paint);
    } else {
      ML.on(window, 'scroll', paint, { passive: true });
    }
    ML.on(window, 'resize', paint, { passive: true });
    paint();
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var ML = window.ML;
    if (!ML || typeof ML.q !== 'function') { return; }

    var syncWall = initWall(ML);
    initFlow(ML);

    if (syncWall) {
      ML.on(window, 'resize', syncWall, { passive: true });
    }

    /* 动效档位切换后重新校准（轨道位置与进度条不依赖动效，只需重算一次） */
    if (ML.motion && typeof ML.motion.onChange === 'function' && syncWall) {
      ML.motion.onChange(syncWall);
    }
  }

  document.addEventListener('ml:ready', boot, { once: true });
})();
