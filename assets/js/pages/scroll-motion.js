/* ============================================================================
   展厅 C · 滚动与视差叙事 —— 页面脚本
   只使用 CONTRACT.md §3 的 ML.* API；无网络请求；无 console 输出。
   逐帧循环用 ML.schedule（返回 false 结束）；ML.raf 是单次 rAF，此处不用。
   ========================================================================== */
(function () {
  'use strict';

  function soft() {
    return ML.motion.get() !== 'on';
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : fallback;
  }

  function text(el, value) {
    if (el) el.textContent = value;
  }

  /* 下一帧执行一次（用内核调度器，避免自建 rAF 标志位） */
  function onceFrame(fn) {
    ML.schedule(function () {
      fn();
      return false;
    });
  }

  /* 读取元素当前 translateY（内核视差写的就是 translate3d） */
  function translateY(el) {
    var tr = window.getComputedStyle(el).transform;
    if (!tr || tr === 'none') return 0;
    try {
      if (window.DOMMatrixReadOnly) return new DOMMatrixReadOnly(tr).m42;
    } catch (err) {
      /* 解析失败按 0 处理 */
    }
    var m = tr.match(/matrix.*\((.+)\)/);
    if (!m) return 0;
    var parts = m[1].split(',');
    return parts.length > 5 ? parseFloat(parts[5]) : 0;
  }

  /* ==========================================================================
     01 滚动揭示（含 stagger）
     ========================================================================== */
  function initReveal() {
    var host = ML.q('[data-sm-reveal]');
    if (!host) return;
    var replay = ML.q('[data-sm-reveal-replay]');
    var jump = ML.q('[data-sm-reveal-jump]');
    var stateOut = ML.q('[data-sm-reveal-state]');
    var countOut = ML.q('[data-sm-reveal-count]');

    var total = ML.qa('.reveal, [data-reveal], .stagger-seq, .reveal-mask').length;
    text(countOut, String(total));

    if (replay) {
      ML.on(replay, 'click', function () {
        if (soft()) {
          host.classList.add('seq--in');
          text(stateOut, 'lite/off：直接呈现（内核已把位移换成纯淡入）');
          return;
        }
        host.classList.remove('seq--in');
        text(stateOut, '已复位，1 帧后重新揭示…');
        onceFrame(function () {
          onceFrame(function () {
            host.classList.add('seq--in');
            text(stateOut, '已揭示（i × 45ms 错开）');
          });
        });
      });
    }
    if (jump) {
      ML.on(jump, 'click', function () {
        ML.scroll.to(host.closest('.demo') || host, { offset: 120 });
      });
    }
  }

  /* ==========================================================================
     02 4 层视差  03 视差文字位移
     ========================================================================== */
  function initParallax() {
    var box = ML.q('[data-sm-para]');
    if (!box) return;
    var layers = ML.qa('[data-parallax]', box);
    var out = ML.q('[data-sm-para-out]');
    var toggle = ML.q('[data-sm-para-toggle]');
    var jump = ML.q('[data-sm-para-jump]');

    ML.scroll.onScroll(function () {
      if (!layers.length) return;
      if (box.classList.contains('is-off')) return;
      var values = layers.map(function (el) { return translateY(el).toFixed(1); });
      text(out, values.join(' / '));
    });

    if (toggle) {
      ML.on(toggle, 'click', function () {
        var off = box.classList.toggle('is-off');
        toggle.setAttribute('aria-pressed', off ? 'true' : 'false');
        toggle.textContent = off ? '恢复视差（对照结束）' : '暂停视差（对照）';
        if (off) text(out, '0.0 / 0.0 / 0.0 / 0.0 （已被页面样式冻结，内核仍在写 transform）');
      });
    }
    if (jump) {
      ML.on(jump, 'click', function () { ML.scroll.to(box.closest('.demo') || box, { offset: 120 }); });
    }
  }

  function initKinetic() {
    var box = ML.q('[data-sm-kinetic]');
    if (!box) return;
    var toggle = ML.q('[data-sm-kinetic-toggle]');
    var jump = ML.q('[data-sm-kinetic-jump]');
    var nOut = ML.q('[data-sm-kinetic-n]');
    var stateOut = ML.q('[data-sm-kinetic-state]');
    var words = ML.qa('[data-parallax]', box);
    text(nOut, String(words.length));

    if (toggle) {
      ML.on(toggle, 'click', function () {
        var on = box.classList.toggle('is-off') ? false : true;
        toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        toggle.textContent = on ? '文字视差：开' : '文字视差：关';
        text(stateOut, on ? '运行中' : '已归位（基线排版）');
      });
    }
    if (jump) {
      ML.on(jump, 'click', function () { ML.scroll.to(box.closest('.demo') || box, { offset: 120 }); });
    }
  }

  /* ==========================================================================
     04 粘性堆叠卡片
     ========================================================================== */
  function initStack() {
    var box = ML.q('[data-sm-stack]');
    if (!box) return;
    var cards = ML.qa('.sm-stack__card', box);
    if (!cards.length) return;
    var yOut = ML.q('[data-sm-stack-y]');
    var maxOut = ML.q('[data-sm-stack-max]');
    var nowOut = ML.q('[data-sm-stack-now]');
    var topBtn = ML.q('[data-sm-stack-top]');
    var endBtn = ML.q('[data-sm-stack-end]');
    var ticking = false;

    cards.forEach(function (card, i) {
      card.style.setProperty('--sm-i', String(i));
    });

    function paint() {
      var max = Math.max(0, box.scrollHeight - box.clientHeight);
      text(yOut, String(Math.round(box.scrollTop)));
      text(maxOut, String(Math.round(max)));

      var boxTop = box.getBoundingClientRect().top;
      var activeIdx = 0;
      if (!soft()) {
        cards.forEach(function (card, i) {
          var r = card.getBoundingClientRect();
          var next = cards[i + 1];
          var t = 0;
          if (next) {
            var nr = next.getBoundingClientRect();
            var span = Math.max(1, r.height + card.offsetTop * 0);
            t = 1 - ML.clamp((nr.top - r.top) / span, 0, 1);
          }
          card.style.setProperty('--sm-card-scale', (1 - 0.04 * t).toFixed(4));
          card.style.setProperty('--sm-card-alpha', (1 - 0.26 * t).toFixed(4));
          if (r.top <= boxTop + 40) activeIdx = Math.min(i + 1, cards.length - 1);
        });
      }
      if (cards.length) {
        var lastIdx = cards.length - 1;
        var lastRect = cards[lastIdx].getBoundingClientRect();
        if (lastRect.top <= boxTop + 40) activeIdx = lastIdx;
      }
      text(nowOut, String(activeIdx + 1));
    }

    ML.on(box, 'scroll', function () {
      if (ticking) return;
      ticking = true;
      onceFrame(function () {
        ticking = false;
        paint();
      });
    }, { passive: true });

    if (topBtn) ML.on(topBtn, 'click', function () { box.scrollTo({ top: 0, behavior: soft() ? 'auto' : 'smooth' }); });
    if (endBtn) {
      ML.on(endBtn, 'click', function () {
        box.scrollTo({ top: box.scrollHeight, behavior: soft() ? 'auto' : 'smooth' });
      });
    }

    paint();
  }

  /* ==========================================================================
     05 滚动时间轴
     ========================================================================== */
  function initTimeline() {
    var box = ML.q('[data-sm-tl]');
    if (!box) return;
    var fill = ML.q('[data-sm-tl-fill]', box);
    var items = ML.qa('[data-sm-tl-item]', box);
    var pctOut = ML.q('[data-sm-tl-pct]');
    var doneOut = ML.q('[data-sm-tl-done]');
    var ticking = false;

    function paint() {
      var max = Math.max(1, box.scrollHeight - box.clientHeight);
      var p = ML.clamp(box.scrollTop / max, 0, 1);
      if (fill) fill.style.setProperty('--sm-tl', p.toFixed(4));
      text(pctOut, String(Math.round(p * 100)));

      var boxRect = box.getBoundingClientRect();
      var line = boxRect.top + boxRect.height * 0.4;
      var done = 0;
      items.forEach(function (item) {
        var r = item.getBoundingClientRect();
        var pass = r.top + 10 <= line;
        item.classList.toggle('is-done', pass);
        if (pass) done++;
      });
      text(doneOut, String(done));
    }

    ML.on(box, 'scroll', function () {
      if (ticking) return;
      ticking = true;
      onceFrame(function () {
        ticking = false;
        paint();
      });
    }, { passive: true });

    paint();
  }

  /* ==========================================================================
     06 章节背景色随滚动过渡
     ========================================================================== */
  var CHAPTER_BG = {
    surface: 'var(--surface)',
    accent: 'var(--accent-soft)',
    info: 'var(--info-soft)',
    warning: 'var(--warning-soft)'
  };

  function initChapters() {
    var box = ML.q('[data-sm-chapters]');
    if (!box) return;
    var chapters = ML.qa('[data-sm-chapter]', box);
    if (!chapters.length) return;
    var nameOut = ML.q('[data-sm-chapters-name]');
    var idxOut = ML.q('[data-sm-chapters-idx]');
    var hitsOut = ML.q('[data-sm-chapters-hits]');
    var ticking = false;
    var current = -1;
    var hits = 0;
    var first = true;

    function paint() {
      var mid = box.getBoundingClientRect().top + box.clientHeight / 2;
      var best = 0;
      var bestDist = Infinity;
      chapters.forEach(function (ch, i) {
        var r = ch.getBoundingClientRect();
        var d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      if (best !== current) {
        current = best;
        var key = chapters[best].getAttribute('data-bg') || 'surface';
        box.style.setProperty('--sm-chapter-bg', CHAPTER_BG[key] || CHAPTER_BG.surface);
        text(nameOut, chapters[best].getAttribute('data-name') || String(best + 1));
        text(idxOut, String(best + 1));
        if (first) first = false;
        else {
          hits++;
          text(hitsOut, String(hits));
        }
      }
    }

    ML.on(box, 'scroll', function () {
      if (ticking) return;
      ticking = true;
      onceFrame(function () {
        ticking = false;
        paint();
      });
    }, { passive: true });

    paint();
  }

  /* ==========================================================================
     07 分段滚动进度指示
     ========================================================================== */
  function initSeg() {
    var box = ML.q('[data-sm-seg]');
    if (!box) return;
    var pctOut = ML.q('[data-sm-seg-pct]');
    var nowOut = ML.q('[data-sm-seg-now]');
    var yOut = ML.q('[data-sm-seg-y]');
    var marks = ML.qa('[data-sm-seg-mark]');
    var topBtn = ML.q('[data-sm-seg-top]');
    var bottomBtn = ML.q('[data-sm-seg-bottom]');

    var sections = marks.map(function (m) {
      var href = m.getAttribute('data-sm-seg-mark') || '';
      return document.getElementById(href.replace('#', ''));
    });

    function paint() {
      var raw = window.getComputedStyle(document.documentElement).getPropertyValue('--scroll-progress');
      var p = ML.clamp(num(raw, ML.scroll.progress()), 0, 1);
      text(pctOut, String(Math.round(p * 100)));
      text(yOut, String(Math.round(ML.scroll.y())));

      var y = ML.scroll.y();
      var mid = y + window.innerHeight * 0.35;
      var active = 0;
      sections.forEach(function (sec, i) {
        if (!sec) return;
        var top = sec.getBoundingClientRect().top + y;
        if (mid >= top) active = i;
      });
      marks.forEach(function (m, i) { m.classList.toggle('is-active', i === active); });
      if (sections[active]) {
        var label = marks[active].textContent || '';
        text(nowOut, label.trim());
      }
    }

    ML.scroll.onScroll(paint);

    marks.forEach(function (m) {
      ML.on(m, 'click', function () {
        var href = m.getAttribute('data-sm-seg-mark') || '';
        ML.scroll.to(href, { offset: 100 });
      });
    });
    if (topBtn) ML.on(topBtn, 'click', function () { ML.scroll.to(0); });
    if (bottomBtn) ML.on(bottomBtn, 'click', function () { ML.scroll.to(document.body.scrollHeight); });

    paint();
  }

  /* ==========================================================================
     08 scroll-snap 章节
     ========================================================================== */
  function initSnap() {
    var box = ML.q('[data-sm-snap]');
    if (!box) return;
    var pages = ML.qa('.sm-snap__page', box);
    var toggle = ML.q('[data-sm-snap-toggle]');
    var prevBtn = ML.q('[data-sm-snap-prev]');
    var nextBtn = ML.q('[data-sm-snap-next]');
    var idxOut = ML.q('[data-sm-snap-idx]');
    var typeOut = ML.q('[data-sm-snap-type]');
    var ticking = false;

    function paint() {
      var max = Math.max(1, box.scrollHeight - box.clientHeight);
      var p = ML.clamp(box.scrollTop / max, 0, 1);
      text(idxOut, String(Math.min(pages.length, Math.floor(p * pages.length) + 1)));
    }

    ML.on(box, 'scroll', function () {
      if (ticking) return;
      ticking = true;
      onceFrame(function () {
        ticking = false;
        paint();
      });
    }, { passive: true });

    function go(delta) {
      box.scrollBy({ top: delta * box.clientHeight, behavior: soft() ? 'auto' : 'smooth' });
    }
    if (prevBtn) ML.on(prevBtn, 'click', function () { go(-1); });
    if (nextBtn) ML.on(nextBtn, 'click', function () { go(1); });

    if (toggle) {
      ML.on(toggle, 'click', function () {
        var free = box.classList.toggle('is-free');
        toggle.setAttribute('aria-pressed', free ? 'false' : 'true');
        toggle.textContent = free ? '吸附：已关闭（自由滚动）' : '吸附：强制（mandatory）';
        text(typeOut, free ? 'none' : 'y mandatory');
        document.documentElement.setAttribute('data-sm-snap', free ? 'free' : 'locked');
        try {
          window.localStorage.setItem('ml-sm-snap', free ? 'free' : 'locked');
        } catch (err) {
          /* 存储不可用：忽略 */
        }
      });
    }

    /* 首屏偏好由 inline.js 写在 html 上，这里把它同步到控件与读数 */
    if (document.documentElement.getAttribute('data-sm-snap') === 'free') {
      box.classList.add('is-free');
      if (toggle) {
        toggle.setAttribute('aria-pressed', 'false');
        toggle.textContent = '吸附：已关闭（自由滚动）';
      }
      text(typeOut, 'none');
    }

    paint();
  }

  /* ==========================================================================
     09 横向滚动区
     ========================================================================== */
  function initRail() {
    var rail = ML.q('[data-sm-rail]');
    if (!rail) return;
    var items = ML.qa('.sm-rail__item', rail);
    var xOut = ML.q('[data-sm-rail-x]');
    var maxOut = ML.q('[data-sm-rail-max]');
    var idxOut = ML.q('[data-sm-rail-idx]');
    var prevBtn = ML.q('[data-sm-rail-prev]');
    var nextBtn = ML.q('[data-sm-rail-next]');
    var firstBtn = ML.q('[data-sm-rail-start]');
    var lastBtn = ML.q('[data-sm-rail-end]');
    var ticking = false;

    function paint() {
      var max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      text(xOut, String(Math.round(rail.scrollLeft)));
      text(maxOut, String(Math.round(max)));
      var item = items[0];
      var step = item ? item.getBoundingClientRect().width + 12 : 1;
      var idx = Math.round(rail.scrollLeft / Math.max(1, step)) + 1;
      text(idxOut, String(ML.clamp(idx, 1, items.length)));
    }

    ML.on(rail, 'scroll', function () {
      if (ticking) return;
      ticking = true;
      onceFrame(function () {
        ticking = false;
        paint();
      });
    }, { passive: true });
    ML.on(window, 'resize', paint);

    function step(delta) {
      var item = items[0];
      var w = item ? item.getBoundingClientRect().width + 12 : rail.clientWidth;
      rail.scrollBy({ left: delta * w, behavior: soft() ? 'auto' : 'smooth' });
    }
    if (prevBtn) ML.on(prevBtn, 'click', function () { step(-1); });
    if (nextBtn) ML.on(nextBtn, 'click', function () { step(1); });
    if (firstBtn) {
      ML.on(firstBtn, 'click', function () {
        rail.scrollTo({ left: 0, behavior: soft() ? 'auto' : 'smooth' });
        var first = items[0];
        if (first && first.focus) first.focus({ preventScroll: true });
      });
    }
    if (lastBtn) {
      ML.on(lastBtn, 'click', function () {
        rail.scrollTo({ left: rail.scrollWidth, behavior: soft() ? 'auto' : 'smooth' });
      });
    }

    paint();
  }

  /* ==========================================================================
     10 scroll-jacking 反例对照
     ========================================================================== */
  function initCompare() {
    var box = ML.q('[data-sm-hijack]');
    if (!box) return;
    var nativeBox = ML.q('[data-sm-native]');
    var runBtn = ML.q('[data-sm-hijack-run]');
    var stopBtn = ML.q('[data-sm-hijack-stop]');
    var stateOut = ML.q('[data-sm-hijack-state]');
    var lostOut = ML.q('[data-sm-hijack-lost]');
    var note = ML.q('[data-sm-hijack-note]');

    var hijacking = false;
    var cancelTask = null;
    var lost = 0;
    var direction = 1;
    var MAX_MS = 2400;
    var elapsed = 0;

    /* 反例真正的"反"在这里：接管期间吞掉用户的滚动输入 */
    function swallow(e) {
      if (!hijacking) return;
      lost++;
      text(lostOut, String(lost));
      e.preventDefault();
      e.stopPropagation();
    }
    ML.on(box, 'wheel', swallow, { passive: false });
    ML.on(box, 'keydown', function (e) {
      if (!hijacking) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' ||
          e.key === 'PageDown' || e.key === 'Home' || e.key === 'End' || e.key === ' ') {
        swallow(e);
      }
    });

    function stop(reason) {
      if (!hijacking) return;
      hijacking = false;
      if (cancelTask) { cancelTask(); cancelTask = null; }
      if (runBtn) runBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      text(stateOut, reason || '已中止');
    }

    function run(target) {
      if (hijacking) return;
      if (soft()) {
        box.scrollTop = target;
        text(stateOut, '降级：直接跳到目标位置（不做插值）');
        text(note, '在当前动效档位下，接管被替换为瞬时跳转——结论不变：仍然是你无法打断的位移。');
        return;
      }
      hijacking = true;
      elapsed = 0;
      lost = 0;
      text(lostOut, '0');
      if (runBtn) runBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      text(stateOut, '接管中（2.4s）…');
      text(note, '现在试着用滚轮或方向键打断它——输入会被吞掉，画面还在自己走。');

      cancelTask = ML.schedule(
        function (dt) {
          if (!hijacking) return false;
          elapsed += dt * 1000;
          var d = target - box.scrollTop;
          box.scrollTop = box.scrollTop + d * 0.12;
          if (elapsed >= MAX_MS || Math.abs(d) < 1) {
            box.scrollTop = target;
            return false;
          }
          return undefined;
        },
        function () {
          cancelTask = null;
          if (hijacking) stop('接管结束（共丢弃 ' + lost + ' 次输入）');
        }
      );
    }

    box.textContent = '';
    for (var i = 0; i < 8; i++) {
      var line = document.createElement('p');
      line.className = 'sm-compare__line';
      line.textContent = '第 ' + (i + 1) + ' 行：接管期间这段内容由脚本推进，而不是由你推进。';
      box.appendChild(line);
    }
    note = ML.q('[data-sm-hijack-note]', box);

    if (runBtn) {
      ML.on(runBtn, 'click', function () {
        var max = Math.max(0, box.scrollHeight - box.clientHeight);
        box.scrollTop = direction > 0 ? 0 : max;
        var target = direction > 0 ? max : 0;
        direction = -direction;
        run(target);
      });
    }
    if (stopBtn) ML.on(stopBtn, 'click', function () { stop('你主动中止了接管'); });
    if (nativeBox) {
      ML.on(nativeBox, 'keydown', function (e) {
        /* 原生侧不做任何拦截：这里只用来对比"浏览器自己处理" */
        if (e.key === 'End') nativeBox.scrollTop = nativeBox.scrollHeight;
      });
    }
  }

  /* ==========================================================================
     boot
     ========================================================================== */
  function boot() {
    if (!window.ML || typeof ML.q !== 'function') return;
    initReveal();
    initParallax();
    initKinetic();
    initStack();
    initTimeline();
    initChapters();
    initSeg();
    initSnap();
    initRail();
    initCompare();
  }

  document.addEventListener('ml:ready', boot, { once: true });
})();
