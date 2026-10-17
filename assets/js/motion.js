/* ==========================================================================
   MOTION LAB · motion.js — 动效内核（零依赖）
   在 <head> 中同步执行：立即应用主题与动效档位，避免闪烁。
   暴露 window.ML。页面脚本必须通过 ML.* 使用能力，不得自建一套。
   ========================================================================== */
(function () {
  'use strict';

  var ML = (window.ML = window.ML || {});
  var docEl = document.documentElement;
  var raf = window.requestAnimationFrame;
  var caf = window.cancelAnimationFrame;

  var REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
  var mql = window.matchMedia ? window.matchMedia(REDUCED_QUERY) : null;
  var systemReduced = !!(mql && mql.matches);

  var STORE = { theme: 'ml-theme', motion: 'ml-motion', nav: 'ml-nav-depth' };

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* 私密模式或 file:// 限制下静默降级 */
    }
  }

  /* ------------------------------------------------------------------------
     1. 启动：主题 + 动效档位（同步，防 FOUC）
     ------------------------------------------------------------------------ */
  var savedTheme = safeGet(STORE.theme);
  var theme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
  docEl.setAttribute('data-theme', theme);

  var savedMotion = safeGet(STORE.motion); // 'on' | 'lite' | 'off' | null(跟随系统)
  var motionSource = savedMotion ? 'user' : 'system';
  var motion = savedMotion || (systemReduced ? 'lite' : 'on');
  docEl.setAttribute('data-motion', motion);

  /* ------------------------------------------------------------------------
     2. 基础工具
     ------------------------------------------------------------------------ */
  function q(sel, root) {
    if (sel instanceof Element) return sel;
    return (root || document).querySelector(sel);
  }

  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function on(target, type, handler, opts) {
    var t = target || document;
    if (t.addEventListener) t.addEventListener(type, handler, opts);
    return function off() {
      if (t.removeEventListener) t.removeEventListener(type, handler, opts);
    };
  }

  function once(el, type, handler, opts) {
    var options = Object.assign({}, opts || {}, { once: true });
    if (el && el.addEventListener) el.addEventListener(type, handler, options);
  }

  function create(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class' || key === 'className') el.className = value;
        else if (key === 'text') el.textContent = value;
        else if (key === 'html') el.innerHTML = value;
        else if (key.indexOf('on:') === 0) on(el, key.slice(3), value);
        else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
        else el.setAttribute(key, value);
      });
    }
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mapRange(v, a1, b1, a2, b2, doClamp) {
    if (b1 === a1) return a2;
    var t = (v - a1) / (b1 - a1);
    if (doClamp) t = clamp(t, 0, 1);
    return a2 + (b2 - a2) * t;
  }

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function prefers(feature) {
    if (!window.matchMedia) return false;
    return window.matchMedia('(' + feature + ')').matches;
  }

  function viewport() {
    var w = window.innerWidth || docEl.clientWidth;
    return {
      w: w,
      h: window.innerHeight || docEl.clientHeight,
      dpr: window.devicePixelRatio || 1,
      isMobile: w < 768,
      isTablet: w >= 768 && w < 1024,
      isDesktop: w >= 1024,
    };
  }

  /* ------------------------------------------------------------------------
     3. 缓动函数（与 tokens.css 中的曲线保持一致）
     ------------------------------------------------------------------------ */
  function bezier(x1, y1, x2, y2) {
    function A(a1, a2) {
      return 1 - 3 * a2 + 3 * a1;
    }
    function B(a1, a2) {
      return 3 * a2 - 6 * a1;
    }
    function C(a1) {
      return 3 * a1;
    }
    function calc(t, a1, a2) {
      return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
    }
    function slope(t, a1, a2) {
      return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
    }
    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var x = t;
      for (var i = 0; i < 8; i++) {
        var d = slope(x, x1, x2);
        if (Math.abs(d) < 1e-6) break;
        var err = calc(x, x1, x2) - t;
        if (Math.abs(err) < 1e-6) break;
        x -= err / d;
      }
      return calc(x, y1, y2);
    };
  }

  var ease = {
    linear: function (t) {
      return t;
    },
    outQuint: bezier(0.22, 1, 0.36, 1),
    outExpo: bezier(0.16, 1, 0.3, 1),
    inQuad: bezier(0.55, 0.085, 0.68, 0.53),
    inOutQuart: bezier(0.76, 0, 0.24, 1),
    springSoft: bezier(0.34, 1.56, 0.64, 1),
    snap: bezier(0.2, 0.9, 0.25, 1),
    /* 便捷别名 */
    out: bezier(0.22, 1, 0.36, 1),
    inOut: bezier(0.76, 0, 0.24, 1),
  };

  /* ------------------------------------------------------------------------
     4. 帧循环：所有 JS 驱动的动画共用一个 rAF
     ------------------------------------------------------------------------ */
  var frameTasks = [];
  var frameId = 0;
  var lastTime = 0;

  function tick(time) {
    var dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60;
    lastTime = time;
    var snapshot = frameTasks.slice();
    for (var i = 0; i < snapshot.length; i++) {
      var task = snapshot[i];
      var idx = frameTasks.indexOf(task);
      if (idx === -1) continue; /* 已被自身或他人取消，跳过，绝不误删同帧其他任务 */
      var done = false;
      try {
        done = task.fn(dt, time) === false;
      } catch (e) {
        done = true;
      }
      if (done) {
        frameTasks.splice(frameTasks.indexOf(task), 1);
        if (task.onDone) task.onDone();
      }
    }
    if (frameTasks.length) frameId = raf(tick);
    else {
      frameId = 0;
      lastTime = 0;
    }
  }

  function schedule(fn, onDone) {
    var task = { fn: fn, onDone: onDone };
    frameTasks.push(task);
    if (!frameId) {
      lastTime = 0;
      frameId = raf(tick);
    }
    return function cancel() {
      var idx = frameTasks.indexOf(task);
      if (idx > -1) frameTasks.splice(idx, 1);
    };
  }

  /* ------------------------------------------------------------------------
     5. 弹簧物理（半隐式欧拉积分，可打断、可重定向、带速度衔接）
     ------------------------------------------------------------------------ */
  /* 弹簧预设。阻尼比 ζ = c / (2√(km))。
     实测过冲（半隐式欧拉积分，dt=1/60，见 audit/verify-spring.mjs）：
       snap     ζ=0.79  0.00%  31 帧到位   —— 开关、分段控件、滑块
       standard ζ=0.76  0.33%  41 帧到位   —— 默认，无感过冲
       soft     ζ=0.84  0.05%  66 帧到位   —— 渐进、绵长
       playful  ζ=0.59  6.54%  48 帧到位   —— 强调反馈，故意过冲 */
  var PRESETS = {
    snap: { stiffness: 520, damping: 30, mass: 0.7 },
    standard: { stiffness: 340, damping: 28, mass: 1 },
    soft: { stiffness: 170, damping: 24, mass: 1.2 },
    playful: { stiffness: 420, damping: 24, mass: 1 },
  };

  function criticalDamping(stiffness, mass) {
    return 2 * Math.sqrt(stiffness * mass);
  }

  function spring(handle, from, to, opts) {
    var options = opts || {};
    var preset = options.preset && PRESETS[options.preset] ? PRESETS[options.preset] : null;
    var stiffness = options.stiffness || (preset ? preset.stiffness : PRESETS.standard.stiffness);
    var damping = options.damping || (preset ? preset.damping : PRESETS.standard.damping);
    var mass = options.mass || (preset ? preset.mass : PRESETS.standard.mass);
    var restDelta = options.restDelta || 0.001;
    var restSpeed = options.restSpeed || 0.01;

    var value = typeof from === 'number' ? from : 0;
    var velocity = options.velocity || 0;
    var target = to;
    var settleFrames = 0;
    var reduced = motion !== 'on';

    if (reduced) {
      /* 精简/关闭档：直接到位，但仍走一次回调，保证调用方逻辑一致 */
      value = target;
      if (handle.onUpdate) handle.onUpdate(value, 0);
      if (handle.onComplete || options.onComplete) {
        var cb = handle.onComplete || options.onComplete;
        Promise.resolve().then(function () {
          cb(value);
        });
      }
      return {
        stop: function () {},
        setTarget: function (v) {
          value = v;
          if (handle.onUpdate) handle.onUpdate(value, 0);
        },
        set: function (v) {
          value = v;
          if (handle.onUpdate) handle.onUpdate(value, 0);
        },
        get: function () {
          return value;
        },
        isRunning: function () {
          return false;
        },
        params: { stiffness: stiffness, damping: damping, mass: mass },
      };
    }

    var running = true;

    function step(dt) {
      /* 帧任务约定（与 ML.schedule 文档一致）：返回 false = 已完成，会被移出队列；
         返回 true / undefined = 继续下一帧。 */
      if (!running) return false;
      var stepDt = Math.min(dt, 0.064);
      var displacement = value - target;
      var force = -stiffness * displacement - damping * velocity;
      velocity += (force / mass) * stepDt;
      value += velocity * stepDt;
      if (handle.onUpdate) handle.onUpdate(value, velocity);

      if (Math.abs(velocity) < restSpeed && Math.abs(value - target) < restDelta) settleFrames++;
      else settleFrames = 0;

      if (settleFrames > 2) {
        value = target;
        velocity = 0;
        if (handle.onUpdate) handle.onUpdate(value, 0);
        running = false;
        return false;
      }
      return true;
    }

    var cancel = schedule(function (dt) {
      return step(dt);
    }, function () {
      if (handle.onComplete) handle.onComplete(value);
      else if (options.onComplete) options.onComplete(value);
    });

    return {
      stop: function () {
        running = false;
        cancel();
      },
      setTarget: function (v) {
        target = v;
        settleFrames = 0;
        if (!running) {
          running = true;
          cancel = schedule(function (dt) {
            return step(dt);
          }, function () {
            if (handle.onComplete) handle.onComplete(value);
            else if (options.onComplete) options.onComplete(value);
          });
        }
      },
      set: function (v) {
        value = v;
        velocity = 0;
        if (handle.onUpdate) handle.onUpdate(value, 0);
      },
      get: function () {
        return value;
      },
      getVelocity: function () {
        return velocity;
      },
      isRunning: function () {
        return running;
      },
      params: { stiffness: stiffness, damping: damping, mass: mass },
    };
  }

  /* 用弹簧驱动元素的某个数值属性：x | y | scale | rotate | opacity */
  function springTo(el, prop, to, opts) {
    if (!el) return null;
    var options = opts || {};
    var start = options.from;
    if (typeof start !== 'number') {
      start = parseFloat(el.dataset['ml' + prop]) || (prop === 'scale' || prop === 'opacity' ? 1 : 0);
    }
    var unit = prop === 'x' || prop === 'y' ? 'px' : prop === 'rotate' ? 'deg' : '';
    var values = {};
    function flush() {
      var t = [];
      Object.keys(values).forEach(function (key) {
        var u = key === 'rotate' ? 'deg' : key === 'x' || key === 'y' ? 'px' : '';
        t.push(key === 'x' || key === 'y' ? key + '(' + values[key].toFixed(2) + u + ')' : key + '(' + values[key].toFixed(4) + u + ')');
      });
      el.style.transform = t.join(' ');
    }
    function readAll() {
      var st = window.getComputedStyle(el);
      var tr = st.transform;
      if (tr && tr !== 'none' && window.DOMMatrixReadOnly) {
        var m = new DOMMatrixReadOnly(tr);
        values.x = m.m41;
        values.y = m.m42;
        values.scale = (m.a + m.d) / 2 || 1;
      }
    }
    values[prop] = start;
    if (prop === 'x' || prop === 'y') readAll();
    el.dataset['ml' + prop] = String(start);
    if (prop === 'opacity') el.style.opacity = String(start);
    else flush();

    var handle = spring(
      {
        onUpdate: function (v) {
          el.dataset['ml' + prop] = String(v);
          if (prop === 'opacity') el.style.opacity = String(clamp(v, 0, 1));
          else {
            values[prop] = v;
            flush();
          }
        },
      },
      start,
      to,
      options
    );
    return handle;
  }

  /* ------------------------------------------------------------------------
     6. 通用过渡与等待
     ------------------------------------------------------------------------ */
  function toMs(value) {
    if (typeof value === 'number') return value;
    if (!value) return 240;
    value = String(value).trim();
    if (/ms$/.test(value)) return parseFloat(value);
    if (/s$/.test(value)) return parseFloat(value) * 1000;
    return 240;
  }

  function transition(el, to, opts) {
    var options = opts || {};
    if (!el) return Promise.resolve();
    var dur = toMs(options.duration === undefined ? getVar(el, '--dur-base') : options.duration);
    var easing = options.easing || getVar(el, '--ease-out-quint') || 'ease';
    var delay = toMs(options.delay || 0);
    if (motion !== 'on') dur = 1;

    var prev = el.style.transition;
    var promises = [];
    Object.keys(to).forEach(function (key) {
      var value = to[key];
      if (key === 'x' || key === 'y' || key === 'rotate' || key === 'scale') return;
      promises.push(key);
    });
    el.style.transition = 'all ' + dur + 'ms ' + easing + (delay ? ' ' + delay + 'ms' : '');
    void el.offsetWidth;
    Object.keys(to).forEach(function (key) {
      if (key === 'x' || key === 'y' || key === 'rotate' || key === 'scale') return;
      el.style[key] = typeof to[key] === 'number' && key !== 'opacity' ? to[key] + 'px' : to[key];
    });

    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        el.style.transition = prev || '';
        resolve();
      }
      if (options.fill === 'forwards') {
        /* 保留内联值 */
      }
      window.setTimeout(finish, dur + delay + 20);
      once(el, 'transitionend', finish);
    });
  }

  function getVar(el, name) {
    try {
      return getComputedStyle(el).getPropertyValue(name).trim();
    } catch (e) {
      return '';
    }
  }

  function wait(ms) {
    var d = motion === 'on' ? ms : Math.min(ms, 16);
    return new Promise(function (resolve) {
      window.setTimeout(resolve, d);
    });
  }

  /* ------------------------------------------------------------------------
     7. 滚动
     ------------------------------------------------------------------------ */
  var scroll = {
    y: function () {
      return window.scrollY || window.pageYOffset || 0;
    },
    max: function () {
      return Math.max(1, docEl.scrollHeight - window.innerHeight);
    },
    progress: function () {
      return clamp(scroll.y() / scroll.max(), 0, 1);
    },
    onScroll: function (fn, opts) {
      var options = Object.assign({ passive: true }, opts || {});
      var queued = false;
      function handler() {
        if (queued) return;
        queued = true;
        raf(function () {
          queued = false;
          fn(scroll.y(), scroll.progress());
        });
      }
      var off = on(window, 'scroll', handler, options);
      var offR = on(window, 'resize', handler, options);
      handler();
      return function () {
        off();
        offR();
      };
    },
    to: function (target, opts) {
      var options = opts || {};
      var el = typeof target === 'number' ? null : q(target);
      var top = typeof target === 'number' ? target : el ? el.getBoundingClientRect().top + scroll.y() : 0;
      var offset = options.offset === undefined ? 84 : options.offset;
      var behavior = motion === 'on' ? 'smooth' : 'auto';
      window.scrollTo({ top: Math.max(0, top - offset), behavior: behavior });
      return el;
    },
    lock: function () {
      if (docEl.dataset.mlLocked) return;
      var sw = window.innerWidth - docEl.clientWidth;
      docEl.dataset.mlLocked = '1';
      docEl.style.overflow = 'hidden';
      if (sw > 0) docEl.style.paddingRight = sw + 'px';
    },
    unlock: function () {
      if (!docEl.dataset.mlLocked) return;
      delete docEl.dataset.mlLocked;
      docEl.style.overflow = '';
      docEl.style.paddingRight = '';
    },
  };

  /* ------------------------------------------------------------------------
     8. 声明式增强
     ------------------------------------------------------------------------ */
  var observers = [];

  function revealObserver() {
    return new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var el = entry.target;
          if (entry.isIntersecting) {
            el.classList.add('reveal--in');
            if (el.classList.contains('stagger-seq')) el.classList.add('seq--in');
            if (el.classList.contains('reveal-mask')) el.classList.add('reveal--in');
            qa('.draw-path', el).forEach(function (p) {
              p.classList.add('draw-path--in');
            });
            obs.unobserve(el);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
  }
  var obs = revealObserver();

  function reveal(root) {
    var scope = root || document;
    var nodes = qa('.reveal, [data-reveal], .stagger-seq, .reveal-mask', scope);
    nodes.forEach(function (el) {
      if (el.dataset.mlReveal === '1') return;
      el.dataset.mlReveal = '1';

      if (el.hasAttribute('data-reveal')) el.classList.add('reveal');
      var variant = el.getAttribute('data-reveal');
      if (variant && variant !== 'true' && variant !== '') el.classList.add('reveal--' + variant);
      if (el.hasAttribute('data-reveal-blur')) el.classList.add('reveal--blur');

      if (el.classList.contains('stagger-seq')) {
        Array.prototype.forEach.call(el.children, function (child, i) {
          child.style.setProperty('--i', String(i));
        });
      }

      /* 延迟：显式 delay，或自动 stagger */
      var delay = parseFloat(el.getAttribute('data-reveal-delay'));
      if (isNaN(delay)) {
        var auto = el.getAttribute('data-reveal-stagger');
        if (auto !== null) {
          var step = parseFloat(auto) || 45;
          var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
          delay = siblings * step;
        } else if (el.classList.contains('demo')) {
          var demos = qa('.demo', el.parentElement || document);
          var idx = demos.indexOf(el);
          delay = Math.min(idx % 3, 2) * 45;
        } else {
          delay = 0;
        }
      }
      el.style.setProperty('--reveal-delay', delay + 'ms');

      /* 已在视口内：下一帧立即揭示，避免"闪一下" */
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        raf(function () {
          el.classList.add('reveal--in');
          qa('.draw-path', el).forEach(function (p) {
            p.classList.add('draw-path--in');
          });
        });
      } else {
        obs.observe(el);
      }
    });

    /* 兜底：若观察器因任何原因未触发，1.2s 后强制揭示已在视口内的元素，
       保证内容永远不会卡在 opacity:0（可访问性与健壮性优先于动效）。 */
    if (!reveal._failsafe) {
      reveal._failsafe = true;
      window.setTimeout(function () {
        var all = qa('.reveal, .stagger-seq, .reveal-mask');
        var revealed = qa('.reveal--in, .seq--in').length;
        /* 若一个都没揭示，说明观察器整体失效 → 全部直接呈现，内容优先 */
        if (!revealed && all.length) {
          all.forEach(function (el) {
            el.classList.add('reveal--in');
            if (el.classList.contains('stagger-seq')) el.classList.add('seq--in');
          });
          qa('.draw-path').forEach(function (p) {
            p.classList.add('draw-path--in');
          });
          return;
        }
        all.forEach(function (el) {
          if (el.classList.contains('reveal--in') || el.classList.contains('seq--in')) return;
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) {
            el.classList.add('reveal--in');
            if (el.classList.contains('stagger-seq')) el.classList.add('seq--in');
            qa('.draw-path', el).forEach(function (p) {
              p.classList.add('draw-path--in');
            });
          }
        });
      }, 1200);
    }
    return nodes.length;
  }

  function parallax(root) {
    var scope = root || document;
    var layers = qa('[data-parallax], .parallax-layer', scope);
    if (!layers.length) return 0;
    layers.forEach(function (el) {
      el.classList.add('parallax-layer');
    });
    if (motion !== 'on') {
      layers.forEach(function (el) {
        el.style.transform = '';
      });
      return layers.length;
    }
    scroll.onScroll(function () {
      var vh = window.innerHeight;
      layers.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
        var rect = el.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var offset = (center - vh / 2) / vh;
        el.style.transform = 'translate3d(0,' + (-offset * speed * 100).toFixed(2) + 'px,0)';
      });
    });
    return layers.length;
  }

  function tilt(root) {
    var scope = root || document;
    var nodes = qa('[data-tilt]', scope);
    nodes.forEach(function (el) {
      if (el.dataset.mlTilt === '1') return;
      el.dataset.mlTilt = '1';
      el.classList.add('tilt');
      var max = parseFloat(el.getAttribute('data-tilt')) || 8;
      var glare = null;
      if (el.hasAttribute('data-tilt-glare')) {
        glare = create('span', { class: 'tilt__glare', 'aria-hidden': 'true' });
        el.appendChild(glare);
      }
      function move(ev) {
        var rect = el.getBoundingClientRect();
        var px = (ev.clientX - rect.left) / rect.width;
        var py = (ev.clientY - rect.top) / rect.height;
        var rx = clamp((0.5 - py) * max * 2, -max, max);
        var ry = clamp((px - 0.5) * max * 2, -max, max);
        el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        if (glare) {
          glare.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
          glare.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
        }
      }
      function leave() {
        el.style.transform = '';
      }
      on(el, 'pointermove', move);
      on(el, 'pointerleave', leave);
      on(el, 'blur', leave);
    });
    return nodes.length;
  }

  function magnetic(root) {
    var scope = root || document;
    var nodes = qa('[data-magnetic]', scope);
    nodes.forEach(function (el) {
      if (el.dataset.mlMag === '1') return;
      el.dataset.mlMag = '1';
      if (motion !== 'on') return;
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 6;
      on(el, 'pointermove', function (ev) {
        var rect = el.getBoundingClientRect();
        var dx = (ev.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        var dy = (ev.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        el.style.transform = 'translate3d(' + (dx * strength).toFixed(2) + 'px,' + (dy * strength).toFixed(2) + 'px,0)';
      });
      on(el, 'pointerleave', function () {
        el.style.transform = '';
      });
    });
    return nodes.length;
  }

  function countUp(root) {
    var scope = root || document;
    var nodes = qa('[data-count]', scope);
    nodes.forEach(function (el) {
      if (el.dataset.mlCount === '1') return;
      el.dataset.mlCount = '1';
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
      var prefix = el.getAttribute('data-count-prefix') || '';
      var suffix = el.getAttribute('data-count-suffix') || '';
      var locale = el.getAttribute('data-count-locale') || 'zh-CN';
      var formatter = function (v) {
        var text;
        try {
          text = Number(v).toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
        } catch (e) {
          text = v.toFixed(decimals);
        }
        return prefix + text + suffix;
      };
      el.classList.add('count');
      el.textContent = formatter(motion === 'on' ? 0 : target);
      if (motion !== 'on') return;
      var start = function () {
        spring(
          {
            onUpdate: function (v) {
              el.textContent = formatter(v);
            },
          },
          0,
          target,
          { preset: 'standard', restDelta: 0.01 }
        );
      };
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              start();
              io.disconnect();
            }
          });
        },
        { threshold: 0.4 }
      );
      io.observe(el);
      observers.push(io);
    });
    return nodes.length;
  }

  function rippleHost(root) {
    var scope = root || document;
    qa('.ripple-host', scope).forEach(function (el) {
      if (el.dataset.mlRipple === '1') return;
      el.dataset.mlRipple = '1';
      on(el, 'pointerdown', function (ev) {
        if (motion !== 'on') return;
        var rect = el.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height) * 2.2;
        var span = create('span', { class: 'ripple', 'aria-hidden': 'true' });
        span.style.width = span.style.height = size + 'px';
        span.style.left = ev.clientX - rect.left + 'px';
        span.style.top = ev.clientY - rect.top + 'px';
        el.appendChild(span);
        span.addEventListener('animationend', function () {
          span.remove();
        });
      });
    });
    return qa('.ripple-host', scope).length;
  }

  /* 数值滚动的通用入口（页面脚本也可直接用 ML.spring 驱动） */
  function animateNumber(el, from, to, opts) {
    var options = opts || {};
    var decimals = options.decimals || 0;
    var prefix = options.prefix || '';
    var suffix = options.suffix || '';
    return spring(
      {
        onUpdate: function (v) {
          el.textContent = prefix + v.toFixed(decimals) + suffix;
        },
      },
      from,
      to,
      Object.assign({ preset: options.preset || 'standard' }, options)
    );
  }

  /* 内容替换：交叉淡化（同容器内替换用，避免闪跳） */
  function swap(container, render) {
    if (!container) return;
    container.classList.add('swap');
    var old = Array.prototype.slice.call(container.children);
    var next = render();
    if (next) container.appendChild(next);
    if (motion !== 'on') {
      old.forEach(function (el) {
        el.remove();
      });
      return next;
    }
    old.forEach(function (el) {
      el.classList.add('swap__leaving');
    });
    raf(function () {
      if (next) next.classList.add('is-open');
    });
    window.setTimeout(function () {
      old.forEach(function (el) {
        el.remove();
      });
    }, toMs(getVar(container, '--dur-base')) + 60);
    return next;
  }

  /* 尺寸观察 */
  function observeSize(el, cb) {
    if (!window.ResizeObserver) return function () {};
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (e) {
        cb(e.contentRect, e);
      });
    });
    ro.observe(el);
    observers.push(ro);
    return function () {
      ro.disconnect();
    };
  }

  /* 复制（失败自动降级；不含提示，提示由调用方决定） */
  function copy(text, opts) {
    var options = opts || {};
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = create('textarea', { class: 'visually-hidden', 'aria-hidden': 'true' });
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      ta.remove();
      if (ok) resolve();
      else reject(new Error('copy-failed'));
    });
  }

  /* ------------------------------------------------------------------------
     9. 动效档位 API
     ------------------------------------------------------------------------ */
  var motionListeners = [];

  function applyMotion(mode, source) {
    motion = mode;
    docEl.setAttribute('data-motion', mode);
    if (source === 'user') safeSet(STORE.motion, mode);
    motionListeners.forEach(function (fn) {
      try {
        fn(mode, source || 'api');
      } catch (e) {
        /* 单个监听器异常不影响其他监听器 */
      }
    });
    document.dispatchEvent(
      new CustomEvent('ml:motion', { detail: { mode: mode, source: source || 'api' } })
    );
  }

  var motionApi = {
    get: function () {
      return motion;
    },
    set: function (mode) {
      if (mode === 'system') {
        try {
          window.localStorage.removeItem(STORE.motion);
        } catch (e) {}
        applyMotion(systemReduced ? 'lite' : 'on', 'system');
        motionSource = 'system';
        return;
      }
      if (['on', 'lite', 'off'].indexOf(mode) === -1) return;
      motionSource = 'user';
      applyMotion(mode, 'user');
    },
    isSystem: function () {
      return !safeGet(STORE.motion);
    },
    onChange: function (fn) {
      motionListeners.push(fn);
      return function () {
        var i = motionListeners.indexOf(fn);
        if (i > -1) motionListeners.splice(i, 1);
      };
    },
    raw: function () {
      return motionSource;
    },
    systemReduced: function () {
      return systemReduced;
    },
  };

  if (mql && mql.addEventListener) {
    mql.addEventListener('change', function (e) {
      systemReduced = e.matches;
      if (!safeGet(STORE.motion)) applyMotion(systemReduced ? 'lite' : 'on', 'system');
    });
  }

  /* ------------------------------------------------------------------------
     10. 主题 API
     ------------------------------------------------------------------------ */
  function setTheme(next, opts) {
    var options = opts || {};
    var value = next === 'light' ? 'light' : 'dark';
    if (value === theme && !options.force) return Promise.resolve();

    /* 主题切换必须**同步落地**：颜色来自 CSS 变量，而部分浏览器在元素存在 transition 时
       不会重算 var() 驱动的颜色（实测 Chromium），且 view transition / 定时器回调
       在页面不可见时可能永不执行。因此这里：
       1) 先给 <html> 加 .theme-fading 临时禁用所有过渡；
       2) 同步写入 data-theme 与存储；
       3) 用双 rAF + 定时器兜底移除 .theme-fading（即使定时器不触发，双 rAF 也会清理）。 */
    docEl.classList.add('theme-fading');

    theme = value;
    docEl.setAttribute('data-theme', value);
    safeSet(STORE.theme, value);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', value === 'light' ? '#F5F2EA' : '#0A0B0D');
    document.dispatchEvent(new CustomEvent('ml:theme', { detail: { theme: value } }));

    var released = false;
    var release = function () {
      if (released) return;
      released = true;
      docEl.classList.remove('theme-fading');
    };
    raf(function () {
      raf(release);
    });
    window.setTimeout(release, 160);

    return Promise.resolve();
  }

  var themeApi = {
    get: function () {
      return theme;
    },
    set: setTheme,
    toggle: function () {
      return setTheme(theme === 'dark' ? 'light' : 'dark');
    },
  };

  /* ------------------------------------------------------------------------
     11. 站内导航方向标记（供跨文档 View Transition 使用）
     ------------------------------------------------------------------------ */
  function depth() {
    var raw = safeGet(STORE.nav);
    var value = parseInt(raw || '0', 10);
    return isNaN(value) ? 0 : value;
  }

  function markForward() {
    docEl.setAttribute('data-nav-dir', 'forward');
    safeSet(STORE.nav, String(depth() + 1));
  }

  function markBack() {
    docEl.setAttribute('data-nav-dir', 'back');
    safeSet(STORE.nav, String(Math.max(0, depth() - 1)));
  }

  function initNavDirection() {
    on(document, 'click', function (ev) {
      var link = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!link) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(href)) return;
      var url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (e) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      var sameFile =
        url.pathname === window.location.pathname && url.search === window.location.search;
      if (sameFile) return; // 同页锚点：走平滑滚动，不做视图过渡
      markForward();
    });

    on(window, 'pageswap', function (ev) {
      if (ev.viewTransition) {
        /* 前进/后退方向已由 data-nav-dir 决定 */
      }
    });

    on(window, 'pagereveal', function () {
      if (!docEl.hasAttribute('data-nav-dir')) docEl.setAttribute('data-nav-dir', 'forward');
    });

    on(window, 'popstate', markBack);
  }

  /* ------------------------------------------------------------------------
     12. 屏幕阅读器播报（写入 live region，不抢焦点）
     ------------------------------------------------------------------------ */
  function announce(message, politeness) {
    var region = document.getElementById('ml-live');
    if (!region) {
      region = create('div', {
        id: 'ml-live',
        class: 'visually-hidden',
        role: 'status',
        'aria-live': politeness || 'polite',
        'aria-atomic': 'true',
      });
      document.body.appendChild(region);
    }
    region.textContent = '';
    window.setTimeout(function () {
      region.textContent = message;
    }, 40);
  }

  /* ------------------------------------------------------------------------
     13. 键盘与锚点
     ------------------------------------------------------------------------ */
  function initAnchors() {
    on(document, 'click', function (ev) {
      var link = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
      if (!link) return;
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      ev.preventDefault();
      scroll.to(target, { offset: 96 });
      if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
      else {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      history.replaceState(null, '', id);
    });
  }

  /* 页面内滚动进度写入 CSS 变量，供任何页面使用 */
  function initScrollVars() {
    var bar = document.getElementById('scroll-progress');
    var update = function () {
      var p = scroll.progress();
      docEl.style.setProperty('--scroll-progress', p.toFixed(4));
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    scroll.onScroll(update);
  }

  /* ------------------------------------------------------------------------
     14. 导出
     ------------------------------------------------------------------------ */
  ML.q = q;
  ML.qa = qa;
  ML.on = on;
  ML.once = once;
  ML.create = create;
  ML.clamp = clamp;
  ML.lerp = lerp;
  ML.mapRange = mapRange;
  ML.now = now;
  ML.prefers = prefers;
  ML.viewport = viewport;

  ML.ease = ease;
  ML.bezier = bezier;
  ML.toMs = toMs;
  ML.transition = transition;
  ML.transitionBy = function (el, delta, opts) {
    return transition(el, delta, opts);
  };
  ML.wait = wait;
  ML.getVar = getVar;

  ML.presets = PRESETS;
  ML.criticalDamping = criticalDamping;
  ML.spring = spring;
  ML.springTo = springTo;
  ML.animateNumber = animateNumber;
  ML.raf = function (fn) {
    var id = raf(fn);
    return function () {
      caf(id);
    };
  };
  ML.schedule = schedule;

  ML.scroll = scroll;
  ML.reveal = reveal;
  ML.parallax = parallax;
  ML.tilt = tilt;
  ML.magnetic = magnetic;
  ML.countUp = countUp;
  ML.rippleHost = rippleHost;
  ML.swap = swap;
  ML.observeSize = observeSize;
  ML.copy = copy;
  ML.announce = announce;

  ML.motion = motionApi;
  ML.theme = themeApi;
  ML.markForward = markForward;
  ML.markBack = markBack;
  ML.nav = { depth: depth };

  /* 兼容：ML.reduced 为布尔属性（lite / off 皆为 true） */
  Object.defineProperty(ML, 'reduced', {
    get: function () {
      return motion !== 'on';
    },
    configurable: true,
  });

  ML.initExtras = function (root) {
    var scope = root || document;
    reveal(scope);
    parallax(scope);
    tilt(scope);
    magnetic(scope);
    countUp(scope);
    rippleHost(scope);
  };

  if (document.readyState === 'loading') {
    once(document, 'DOMContentLoaded', function () {
      initAnchors();
      initNavDirection();
      initScrollVars();
    });
  } else {
    initAnchors();
    initNavDirection();
    initScrollVars();
  }

  /* 供 site.js 使用 */
  ML._internals = { observers: observers, applyMotion: applyMotion };
})();
