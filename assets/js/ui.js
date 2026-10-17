/* ==========================================================================
   MOTION LAB · ui.js — 共享 UI 组件工厂（ML.UI）
   图标、Toast、对话框、抽屉、弹出层、提示气泡、标签页、复制按钮、骨架
   依赖 motion.js（必须在其后加载）。
   ========================================================================== */
(function () {
  'use strict';

  var ML = window.ML;
  if (!ML) return;

  var q = ML.q;
  var qa = ML.qa;
  var on = ML.on;
  var create = ML.create;

  var UI = (ML.UI = ML.UI || {});

  /* ------------------------------------------------------------------------
     1. 图标集（内联 SVG，24×24，stroke 1.5，currentColor）
     ------------------------------------------------------------------------ */
  var PATHS = {
    'arrow-right': 'M5 12h14M13 6l6 6-6 6',
    'arrow-left': 'M19 12H5M11 18l-6-6 6-6',
    'arrow-up-right': 'M7 17 17 7M8 7h9v9',
    'chevron-down': 'm6 9 6 6 6-6',
    'chevron-up': 'm6 15 6-6 6 6',
    'chevron-right': 'm9 6 6 6-6 6',
    'chevron-left': 'm15 6-6 6 6 6',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    close: 'M6 6l12 12M18 6 6 18',
    check: 'm5 13 4.5 4.5L19 7',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
    menu: 'M4 7h16M4 12h16M4 17h16',
    'more-horizontal': 'M6 12h.01M12 12h.01M18 12h.01',
    external: 'M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z',
    sun: 'M12 5V2M12 22v-3M5 12H2M22 12h-3M6.3 6.3 4.2 4.2M19.8 19.8l-2.1-2.1M17.7 6.3l2.1-2.1M4.2 19.8l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    zap: 'M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z',
    'zap-off': 'M13 2 9.5 7M4.5 13.5H11M13 21l1-8.5M3 3l18 18',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z',
    play: 'M8 5.5v13l11-6.5-11-6.5Z',
    pause: 'M9 5v14M15 5v14',
    refresh: 'M20 11A8 8 0 0 0 6.3 6.3L4 8.5M4 13a8 8 0 0 0 13.7 4.7L20 15.5M4 4v4.5h4.5M20 20v-4.5h-4.5',
    undo: 'M9 14 4 9l5-5M4 9h9a7 7 0 0 1 0 14H8',
    trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M10 11v6M14 11v6',
    copy: 'M9 9V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4M5 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z',
    link: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v5M12 8h.01',
    alert: 'M12 3 2.5 20h19L12 3ZM12 9v5M12 17h.01',
    warning: 'M12 3 2.5 20h19L12 3ZM12 9v5M12 17h.01',
    'check-circle': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8.5 12.5l2.5 2.5 4.5-5',
    'x-circle': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 9l6 6M15 9l-6 6',
    loader: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8',
    sliders: 'M4 8h10M18 8h2M4 16h4M12 16h8M14 5v6M8 13v6',
    layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M4 6h16M4 12h16M4 18h16',
    layout: 'M4 4h16v16H4zM4 10h16M10 10v10',
    'mouse-pointer': 'M6 3l12 8-5 1.5L11 18 6 3Z',
    hand: 'M8 11V6a1.5 1.5 0 0 1 3 0v5M11 11V5.5a1.5 1.5 0 0 1 3 0V11M14 11V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a5 5 0 0 1-5-5v-3a1.5 1.5 0 0 1 3 0',
    keyboard: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10',
    volume: 'M11 5 6 9H3v6h3l5 4V5ZM15 9.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10',
    bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9ZM10 18a2 2 0 0 0 4 0',
    eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    'eye-off': 'M3 3l18 18M10.5 6a9.7 9.7 0 0 1 1.5-.1c6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-3 3.8M6.3 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3.4-.6M9.9 10a3 3 0 0 0 4.2 4.2',
    lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
    unlock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1',
    wand: 'M4 20 15 9M14 4l1 2.5L17.5 8 15 9l-1 2.5L13 9l-2.5-1L13 5.5 14 4ZM19 14l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7L19 14Z',
    github: 'M9 20c-4 1.2-4-2.2-5.5-2.7M20 17.5c0-1.4-.4-2.4-1-3.1.4-1.2.4-2.7-.1-4-1.3 0-2.2.5-2.9 1.1a9 9 0 0 0-4 0C9.3 10.4 8.4 9.9 7.1 9.9c-.5 1.3-.5 2.8-.1 4-.7.7-1 1.7-1 3.1 0 2.2 1.5 3.6 4 4.4M9 20v-2.2M15 20v-2.2',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  };

  function icon(name, opts) {
    var options = opts || {};
    var size = options.size || 20;
    var stroke = options.stroke || 1.5;
    var path = PATHS[name] || PATHS.info;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', stroke);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon' + (options.cls ? ' ' + options.cls : ''));
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path);
    svg.appendChild(p);
    if (options.label) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', options.label);
      svg.removeAttribute('aria-hidden');
    }
    return svg;
  }
  UI.icon = icon;
  UI.icons = PATHS;

  /* ------------------------------------------------------------------------
     2. 焦点工具
     ------------------------------------------------------------------------ */
  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(root) {
    return qa(FOCUSABLE, root).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function trapFocus(container) {
    function handler(ev) {
      if (ev.key !== 'Tab') return;
      var list = focusables(container);
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
    on(container, 'keydown', handler);
    return function () {
      container.removeEventListener('keydown', handler);
    };
  }

  function restoreFocus(el) {
    if (!el) return;
    window.setTimeout(function () {
      try {
        el.focus({ preventScroll: true });
      } catch (e) {}
    }, motionOff() ? 10 : 60);
  }

  function motionOff() {
    return ML.motion.get() !== 'on';
  }

  /* ------------------------------------------------------------------------
     3. Toast
     ------------------------------------------------------------------------ */
  var TOAST_VARIANTS = {
    info: { icon: 'info', label: '信息' },
    success: { icon: 'check-circle', label: '成功' },
    warning: { icon: 'warning', label: '警告' },
    danger: { icon: 'x-circle', label: '错误' },
  };

  function toastRegion() {
    var region = document.getElementById('toast-region');
    if (!region) {
      region = create('div', {
        class: 'toast-region',
        id: 'toast-region',
        'aria-live': 'polite',
        'aria-atomic': 'false',
      });
      document.body.appendChild(region);
    }
    return region;
  }

  function toast(opts) {
    var options = Object.assign({ variant: 'info', duration: 4000 }, opts || {});
    var variant = TOAST_VARIANTS[options.variant] || TOAST_VARIANTS.info;
    var region = toastRegion();

    var el = create('div', {
      class: 'toast toast--' + options.variant,
      role: options.variant === 'danger' ? 'alert' : 'status',
    });
    var iconWrap = create('span', { class: 'toast__icon', 'aria-hidden': 'true' });
    iconWrap.appendChild(icon(variant.icon, { size: 18 }));
    var body = create('div', { class: 'toast__body' });
    body.appendChild(create('p', { class: 'toast__title', text: options.title || variant.label }));
    if (options.desc) body.appendChild(create('p', { class: 'toast__desc', text: options.desc }));
    var close = create('button', {
      class: 'toast__close',
      type: 'button',
      'aria-label': '关闭通知',
      html: '<span class="visually-hidden">关闭通知</span>',
    });
    close.appendChild(icon('close', { size: 16 }));

    el.appendChild(iconWrap);
    el.appendChild(body);

    if (options.action && options.action.label) {
      var action = create('button', {
        class: 'toast__action',
        type: 'button',
        text: options.action.label,
      });
      on(action, 'click', function () {
        if (options.action.onClick) options.action.onClick();
        dismiss();
      });
      body.appendChild(action);
    }

    el.appendChild(close);
    region.appendChild(el);

    /* 最多保留 4 条，超出移除最旧的（不带过渡，避免闪动） */
    var items = qa('.toast', region);
    if (items.length > 4) items.slice(0, items.length - 4).forEach(function (t) {
      t.remove();
    });

    var timer = null;
    var remaining = options.duration;
    var startedAt = 0;
    var dismissed = false;

    function start() {
      if (!remaining) return;
      startedAt = Date.now();
      timer = window.setTimeout(dismiss, remaining);
    }

    function pause() {
      if (!timer) return;
      window.clearTimeout(timer);
      timer = null;
      remaining -= Date.now() - startedAt;
    }

    function resume() {
      if (dismissed) return;
      start();
    }

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      if (timer) window.clearTimeout(timer);
      el.classList.add('is-leaving');
      var after = motionOff() ? 0 : 180;
      window.setTimeout(function () {
        el.remove();
      }, after);
    }

    on(close, 'click', dismiss);
    on(el, 'pointerenter', pause);
    on(el, 'pointerleave', resume);
    on(el, 'focusin', pause);
    on(el, 'focusout', resume);

    /* 键盘：Esc 关闭 */
    on(el, 'keydown', function (ev) {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        dismiss();
      }
    });

    start();
    return { el: el, close: dismiss };
  }
  UI.toast = toast;

  /* ------------------------------------------------------------------------
     4. 对话框
     ------------------------------------------------------------------------ */
  function dialog(opts) {
    var options = Object.assign({ size: 'sm', actions: [] }, opts || {});
    var lastFocus = document.activeElement;

    var scrim = create('div', { class: 'modal__scrim fade', 'data-modal-close': '' });
    var box = create('div', {
      class: 'modal__box enter-scale modal--' + options.size,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'ml-dialog-title',
    });

    var header = create('header', { class: 'modal__head' });
    var title = create('h2', { class: 'h3', id: 'ml-dialog-title', text: options.title || '确认' });
    var closeBtn = create('button', {
      class: 'btn btn--ghost btn--icon',
      type: 'button',
      'aria-label': '关闭对话框',
    });
    closeBtn.appendChild(icon('close', { size: 18 }));
    header.appendChild(title);
    if (options.closable !== false) header.appendChild(closeBtn);

    var body = create('div', { class: 'modal__body' });
    if (typeof options.body === 'string') body.innerHTML = options.body;
    else if (options.body) body.appendChild(options.body);

    box.appendChild(header);
    box.appendChild(body);

    var actionRow = create('footer', { class: 'modal__foot' });
    (options.actions || []).forEach(function (action) {
      var btn = create('button', {
        class: 'btn ' + (action.variant ? 'btn--' + action.variant : 'btn--ghost'),
        type: 'button',
        text: action.label,
      });
      on(btn, 'click', function () {
        if (action.onClick) action.onClick();
        if (action.close !== false) close();
      });
      actionRow.appendChild(btn);
    });
    if (actionRow.children.length) box.appendChild(actionRow);

    var root = create('div', { class: 'modal', hidden: 'hidden' });
    root.setAttribute('id', 'ml-modal');
    root.appendChild(scrim);
    root.appendChild(box);
    var host = document.getElementById('site-overlays') || document.body;
    host.appendChild(root);

    var untrap = null;
    var isOpen = false;

    function open() {
      if (isOpen) return;
      isOpen = true;
      root.hidden = false;
      ML.scroll.lock();
      /* 直接加 is-open，同时下一帧再确认一次：浮层可见性不依赖首帧回调 */
      scrim.classList.add('is-open');
      box.classList.add('is-open');
      requestAnimationFrame(function () {
        scrim.classList.add('is-open');
        box.classList.add('is-open');
      });
      untrap = trapFocus(box);
      var first = box.querySelector('[data-autofocus]') || focusables(box)[0];
      if (first) window.setTimeout(function () {
        first.focus({ preventScroll: true });
      }, motionOff() ? 10 : 80);
      on(document, 'keydown', onKey);
      if (options.onOpen) options.onOpen(box);
    }

    function onKey(ev) {
      if (ev.key === 'Escape' && options.closable !== false) {
        ev.preventDefault();
        close();
      }
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      scrim.classList.remove('is-open');
      box.classList.remove('is-open');
      box.classList.add('is-closing');
      var after = motionOff() ? 0 : 260;
      window.setTimeout(function () {
        root.hidden = true;
        root.remove();
      }, after);
      if (untrap) untrap();
      document.removeEventListener('keydown', onKey);
      ML.scroll.unlock();
      restoreFocus(lastFocus);
      if (options.onClose) options.onClose();
    }

    on(closeBtn, 'click', close);
    on(scrim, 'click', function () {
      if (options.closable !== false) close();
    });

    if (options.open !== false) open();

    return { el: root, box: box, open: open, close: close, titleEl: title, bodyEl: body };
  }
  UI.dialog = dialog;

  function confirm(opts) {
    var options = Object.assign(
      { title: '确认操作', desc: '', confirmText: '确认', cancelText: '取消', danger: false },
      opts || {}
    );
    return new Promise(function (resolve) {
      var settled = false;
      var d = dialog({
        title: options.title,
        size: 'xs',
        body: create('p', { class: 'lede', text: options.desc }),
        actions: [
          {
            label: options.cancelText,
            onClick: function () {
              settled = true;
              resolve(false);
            },
          },
          {
            label: options.confirmText,
            variant: options.danger ? 'danger' : 'primary',
            onClick: function () {
              settled = true;
              resolve(true);
            },
          },
        ],
        onClose: function () {
          if (!settled) resolve(false);
        },
      });
      d.open();
    });
  }
  UI.confirm = confirm;

  /* ------------------------------------------------------------------------
     5. 抽屉
     ------------------------------------------------------------------------ */
  function drawer(opts) {
    var options = Object.assign({ side: 'right', title: '面板' }, opts || {});
    var lastFocus = document.activeElement;
    var sideClass = options.side === 'left' ? 'enter-slide-left' : 'enter-slide-right';

    var scrim = create('div', { class: 'drawer__scrim fade' });
    var panel = create('aside', {
      class: 'drawer__panel ' + sideClass,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': options.title,
    });
    var head = create('header', { class: 'drawer__head' });
    head.appendChild(create('h2', { class: 'h3', text: options.title }));
    var closeBtn = create('button', { class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': '关闭面板' });
    closeBtn.appendChild(icon('close', { size: 18 }));
    head.appendChild(closeBtn);
    var bodyWrap = create('div', { class: 'drawer__body' });
    if (typeof options.content === 'string') bodyWrap.innerHTML = options.content;
    else if (options.content) bodyWrap.appendChild(options.content);

    panel.appendChild(head);
    panel.appendChild(bodyWrap);

    var root = create('div', { class: 'drawer' });
    root.appendChild(scrim);
    root.appendChild(panel);
    var host = document.getElementById('site-overlays') || document.body;
    host.appendChild(root);

    var untrap = trapFocus(panel);
    var isOpen = false;

    function open() {
      if (isOpen) return;
      isOpen = true;
      ML.scroll.lock();
      requestAnimationFrame(function () {
        scrim.classList.add('is-open');
        panel.classList.add('is-open');
      });
      var first = focusables(panel)[0];
      if (first) window.setTimeout(function () {
        first.focus({ preventScroll: true });
      }, motionOff() ? 10 : 80);
      on(document, 'keydown', onKey);
      if (options.onOpen) options.onOpen(panel);
    }

    function onKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      scrim.classList.remove('is-open');
      panel.classList.remove('is-open');
      panel.classList.add('is-closing');
      var after = motionOff() ? 0 : 300;
      window.setTimeout(function () {
        root.remove();
      }, after);
      untrap();
      document.removeEventListener('keydown', onKey);
      ML.scroll.unlock();
      restoreFocus(lastFocus);
      if (options.onClose) options.onClose();
    }

    on(closeBtn, 'click', close);
    on(scrim, 'click', close);
    open();

    return { el: root, panel: panel, open: open, close: close };
  }
  UI.drawer = drawer;

  /* ------------------------------------------------------------------------
     6. 弹出层（自动翻转定位）
     ------------------------------------------------------------------------ */
  function popover(anchor, content, opts) {
    var options = Object.assign({ placement: 'bottom-start', gap: 8 }, opts || {});
    var el = create('div', { class: 'popover enter-scale', role: 'dialog' });
    if (typeof content === 'string') el.innerHTML = content;
    else if (content) el.appendChild(content);
    var host = document.getElementById('site-overlays') || document.body;
    host.appendChild(el);

    var isOpen = false;

    function place() {
      var a = anchor.getBoundingClientRect();
      var box = el.getBoundingClientRect();
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var [side, align] = options.placement.split('-');
      var top;
      var left;
      if (side === 'bottom') top = a.bottom + options.gap;
      else if (side === 'top') top = a.top - box.height - options.gap;
      else top = a.top + a.height / 2 - box.height / 2;
      if (side === 'left') left = a.left - box.width - options.gap;
      else if (side === 'right') left = a.right + options.gap;
      else if (align === 'end') left = a.right - box.width;
      else if (align === 'center') left = a.left + a.width / 2 - box.width / 2;
      else left = a.left;

      /* 翻转：越界时切换到反向 */
      var flipped = false;
      if (top + box.height > vh - 8 && side === 'bottom') {
        top = a.top - box.height - options.gap;
        flipped = true;
      }
      if (top < 8 && side === 'top') {
        top = a.bottom + options.gap;
        flipped = true;
      }
      left = ML.clamp(left, 8, Math.max(8, vw - box.width - 8));
      top = ML.clamp(top, 8, Math.max(8, vh - box.height - 8));
      el.style.setProperty('--pop-x', left + 'px');
      el.style.setProperty('--pop-y', top + 'px');
      el.style.transform = 'translate3d(' + left + 'px,' + (flipped && motionOff() ? top : top) + 'px,0)';
      el.dataset.flipped = flipped ? '1' : '0';
    }

    var offScroll = ML.scroll.onScroll(place);

    function open() {
      isOpen = true;
      place();
      requestAnimationFrame(function () {
        el.classList.add('is-open');
        place();
      });
      on(document, 'keydown', onKey);
      on(document, 'pointerdown', onOutside, true);
    }

    function onKey(ev) {
      if (ev.key === 'Escape') close();
    }

    function onOutside(ev) {
      if (!el.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) close();
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      el.classList.remove('is-open');
      el.classList.add('is-closing');
      window.setTimeout(
        function () {
          el.remove();
        },
        motionOff() ? 0 : 200
      );
      offScroll();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside, true);
    }

    open();
    return { el: el, close: close, place: place };
  }
  UI.popover = popover;

  /* ------------------------------------------------------------------------
     7. 工具提示（键盘 focus 也显示，自动接线 aria-describedby）
     ------------------------------------------------------------------------ */
  var tipId = 0;
  function tooltip(anchor, text, opts) {
    var options = Object.assign({ placement: 'top-center', delay: 260 }, opts || {});
    var id = 'ml-tip-' + ++tipId;
    var el = create('div', { class: 'tooltip', id: id, role: 'tooltip' });
    el.textContent = text;
    anchor.setAttribute('aria-describedby', id);
    var host = document.getElementById('site-overlays') || document.body;
    host.appendChild(el);

    var timer = null;
    var visible = false;

    function place() {
      var a = anchor.getBoundingClientRect();
      var box = el.getBoundingClientRect();
      var vw = window.innerWidth;
      var [side, align] = options.placement.split('-');
      var top;
      var left;
      if (side === 'top') top = a.top - box.height - 10;
      else if (side === 'bottom') top = a.bottom + 10;
      else top = a.top + a.height / 2 - box.height / 2;
      if (side === 'left') left = a.left - box.width - 10;
      else if (side === 'right') left = a.right + 10;
      else if (align === 'start') left = a.left;
      else if (align === 'end') left = a.right - box.width;
      else left = a.left + a.width / 2 - box.width / 2;
      if (side === 'top' && top < 8) top = a.bottom + 10;
      if (side === 'bottom' && top + box.height > window.innerHeight - 8) top = a.top - box.height - 10;
      left = ML.clamp(left, 8, Math.max(8, vw - box.width - 8));
      el.style.transform = 'translate3d(' + left + 'px,' + top + 'px,0)';
    }

    function show() {
      if (visible) return;
      visible = true;
      el.classList.add('is-visible');
      place();
      var offScroll = ML.scroll.onScroll(place);
      on(document, 'keydown', function (ev) {
        if (ev.key === 'Escape') hide();
      });
      on(document, 'pointerdown', hide, true);
      el._offScroll = offScroll;
    }

    function hide() {
      if (!visible) return;
      visible = false;
      el.classList.remove('is-visible');
      if (el._offScroll) el._offScroll();
    }

    on(anchor, 'pointerenter', function () {
      timer = window.setTimeout(show, options.delay);
    });
    on(anchor, 'pointerleave', function () {
      window.clearTimeout(timer);
      hide();
    });
    on(anchor, 'focus', show);
    on(anchor, 'blur', hide);
    on(anchor, 'pointerdown', hide);

    return { el: el, show: show, hide: hide, destroy: function () {
      el.remove();
      anchor.removeAttribute('aria-describedby');
    } };
  }
  UI.tooltip = tooltip;

  /* ------------------------------------------------------------------------
     8. 标签页（滑动指示器 + 方向键 + Home/End）
     ------------------------------------------------------------------------ */
  function tabs(container, opts) {
    var options = opts || {};
    if (!container) return null;
    var list = q('[role="tablist"]', container) || q('.tabbar', container) || container;
    var buttons = qa('[role="tab"], .tabbar__item, button', list);
    if (!buttons.length) return null;
    var indicator = create('span', { class: 'tabbar__indicator', 'aria-hidden': 'true' });
    list.classList.add('tabbar--enhanced');
    list.appendChild(indicator);

    var panels = qa('[role="tabpanel"], .tabbar__panel', container);

    function moveIndicator(btn) {
      var lr = list.getBoundingClientRect();
      var br = btn.getBoundingClientRect();
      var x = br.left - lr.left + btn.offsetLeft * 0;
      list.style.setProperty('--tab-x', x + 'px');
      list.style.setProperty('--tab-w', br.width + 'px');
      indicator.style.transform = 'translate3d(' + x + 'px,0,0)';
      indicator.style.width = br.width + 'px';
    }

    function select(index, focus) {
      buttons.forEach(function (btn, i) {
        var active = i === index;
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.setAttribute('tabindex', active ? '0' : '-1');
        btn.classList.toggle('is-active', active);
        if (panels[i]) panels[i].hidden = !active;
      });
      var btn = buttons[index];
      if (!btn) return;
      moveIndicator(btn);
      if (focus) btn.focus();
      if (options.onChange) options.onChange(index, btn);
    }

    buttons.forEach(function (btn, i) {
      if (!btn.hasAttribute('role')) btn.setAttribute('role', 'tab');
      if (!btn.id) btn.id = 'ml-tab-' + Math.random().toString(36).slice(2, 8);
      btn.setAttribute('aria-controls', btn.getAttribute('aria-controls') || '');
      on(btn, 'click', function () {
        select(i, false);
      });
      on(btn, 'keydown', function (ev) {
        var key = ev.key;
        var next = null;
        if (key === 'ArrowRight' || key === 'ArrowDown') next = (i + 1) % buttons.length;
        else if (key === 'ArrowLeft' || key === 'ArrowUp') next = (i - 1 + buttons.length) % buttons.length;
        else if (key === 'Home') next = 0;
        else if (key === 'End') next = buttons.length - 1;
        if (next !== null) {
          ev.preventDefault();
          select(next, true);
        }
      });
    });

    var initial = buttons.findIndex(function (b) {
      return b.getAttribute('aria-selected') === 'true';
    });
    select(initial < 0 ? 0 : initial, false);

    /* 布局未稳定时（字体未加载 / 首次渲染）指示器可能为 0 宽，会让激活项文字落在无底的背景上。
       这里在多个时机重算位置，保证「指示器在后、文字在上」始终成立。 */
    function resync() {
      var active = buttons.filter(function (b) {
        return b.getAttribute('aria-selected') === 'true';
      })[0];
      if (active) moveIndicator(active);
    }
    requestAnimationFrame(resync);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resync);
    on(window, 'resize', resync);
    ML.observeSize(list, resync);

    return { select: select, buttons: buttons, resync: resync };
  }
  UI.tabs = tabs;

  /* ------------------------------------------------------------------------
     9. 复制按钮
     ------------------------------------------------------------------------ */
  function copyButton(btn, text, opts) {
    var options = Object.assign({ successText: '已复制', resetAfter: 1800, toast: false }, opts || {});
    var original = btn.innerHTML;
    on(btn, 'click', function () {
      var value = typeof text === 'function' ? text() : text;
      ML.copy(value)
        .then(function () {
          if (options.toast) UI.toast({ title: '已复制到剪贴板', variant: 'success', duration: 2400 });
          else {
            btn.classList.add('is-success');
            btn.innerHTML = '';
            btn.appendChild(icon('check', { size: 18 }));
            btn.appendChild(document.createTextNode(' ' + options.successText));
          }
          ML.announce('已复制');
          window.setTimeout(function () {
            btn.classList.remove('is-success');
            btn.innerHTML = original;
          }, options.resetAfter);
        })
        .catch(function () {
          UI.toast({
            title: '复制失败',
            desc: '当前环境不允许写入剪贴板，请手动选择文本复制。',
            variant: 'danger',
          });
        });
    });
    return btn;
  }
  UI.copyButton = copyButton;

  /* ------------------------------------------------------------------------
     10. 骨架
     ------------------------------------------------------------------------ */
  function skeleton(rows, opts) {
    var options = Object.assign({ variant: 'line' }, opts || {});
    var wrap = create('div', { class: 'skeleton-group', 'aria-hidden': 'true' });
    if (options.variant === 'card') {
      wrap.appendChild(create('div', { class: 'skeleton skeleton--block' }));
      wrap.appendChild(create('div', { class: 'skeleton skeleton--line', style: { width: '70%' } }));
      wrap.appendChild(create('div', { class: 'skeleton skeleton--line', style: { width: '45%' } }));
    } else {
      for (var i = 0; i < (rows || 3); i++) {
        var line = create('div', { class: 'skeleton skeleton--line' });
        if (i === (rows || 3) - 1) line.style.width = '62%';
        wrap.appendChild(line);
      }
    }
    return wrap;
  }
  UI.skeleton = skeleton;

  /* ------------------------------------------------------------------------
     11. 徽标 / 状态点
     ------------------------------------------------------------------------ */
  function badge(text, variant) {
    return create('span', { class: 'badge badge--' + (variant || 'info'), text: text });
  }
  UI.badge = badge;

  /* ------------------------------------------------------------------------
     12. 进度环
     ------------------------------------------------------------------------ */
  function ring(value, opts) {
    var options = Object.assign({ size: 72, stroke: 6, label: '' }, opts || {});
    var r = (options.size - options.stroke) / 2;
    var circ = 2 * Math.PI * r;
    var wrap = create('div', { class: 'ring', style: { width: options.size + 'px', height: options.size + 'px' } });
    wrap.innerHTML =
      '<svg viewBox="0 0 ' +
      options.size +
      ' ' +
      options.size +
      '" width="' +
      options.size +
      '" height="' +
      options.size +
      '" aria-hidden="true">' +
      '<circle class="ring__track" cx="' +
      options.size / 2 +
      '" cy="' +
      options.size / 2 +
      '" r="' +
      r +
      '" fill="none" stroke-width="' +
      options.stroke +
      '"/>' +
      '<circle class="ring__value" cx="' +
      options.size / 2 +
      '" cy="' +
      options.size / 2 +
      '" r="' +
      r +
      '" fill="none" stroke-width="' +
      options.stroke +
      '" stroke-linecap="round" style="--circ:' +
      circ.toFixed(2) +
      '"/>' +
      '</svg>' +
      '<span class="ring__label tnum">' +
      (options.label || Math.round(value * 100) + '%') +
      '</span>';
    wrap.style.setProperty('--ring', ML.clamp(value, 0, 1));
    wrap.setValue = function (v, label) {
      wrap.style.setProperty('--ring', ML.clamp(v, 0, 1));
      if (label !== undefined) q('.ring__label', wrap).textContent = label;
    };
    return wrap;
  }
  UI.ring = ring;
})();
