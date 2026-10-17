/* ==========================================================================
   MOTION LAB · site.js — 站点外壳注入（header / footer / 抽屉 / 命令面板 / 全局快捷键）
   依赖 motion.js 与 ui.js。
   ========================================================================== */
(function () {
  'use strict';

  var ML = window.ML;
  if (!ML) return;
  var UI = ML.UI;
  var q = ML.q;
  var qa = ML.qa;
  var on = ML.on;
  var create = ML.create;
  var icon = UI.icon;

  /* ------------------------------------------------------------------------
     1. 站点地图（唯一真源：导航、命令面板、页脚、上一站/下一站都读这里）
     ------------------------------------------------------------------------ */
  var SITES = [
    { id: 'index', file: 'index.html', nav: 'index', code: '—', title: '首页', desc: '丝滑的宣言与全站总览', tag: '总览', group: '入口' },
    { id: 'atlas', file: 'atlas.html', nav: 'atlas', code: '索引', title: '交互地图', desc: '120+ 交互条目，可按展厅筛选与搜索', tag: '索引', group: '入口' },
    { id: 'micro-interactions', file: 'micro-interactions.html', nav: 'micro', code: 'A', title: '微交互', desc: '按压、开关、点赞、涟漪、载荷按钮', tag: 'A · 微交互', group: '展厅' },
    { id: 'states-feedback', file: 'states-feedback.html', nav: 'states', code: 'B', title: '状态与反馈', desc: '骨架、空态、错误、离线、乐观更新', tag: 'B · 状态', group: '展厅' },
    { id: 'scroll-motion', file: 'scroll-motion.html', nav: 'more', code: 'C', title: '滚动叙事', desc: '揭示、视差、粘性堆叠、横向滚动', tag: 'C · 滚动', group: '展厅' },
    { id: 'page-transitions', file: 'page-transitions.html', nav: 'more', code: 'D', title: '页面转场', desc: '跨文档视图过渡、共享元素、FLIP', tag: 'D · 转场', group: '展厅' },
    { id: 'navigation', file: 'navigation.html', nav: 'more', code: 'E', title: '导航模式', desc: '命令面板、标签指示器、scrollspy', tag: 'E · 导航', group: '展厅' },
    { id: 'forms', file: 'forms.html', nav: 'more', code: 'F', title: '表单交互', desc: '浮动标签、内联校验、自动保存', tag: 'F · 表单', group: '展厅' },
    { id: 'gestures', file: 'gestures.html', nav: 'more', code: 'G', title: '手势与拖拽', desc: '拖拽排序、滑动删除、橡皮筋', tag: 'G · 手势', group: '展厅' },
    { id: 'motion-physics', file: 'motion-physics.html', nav: 'motion', code: 'H', title: '运动物理', desc: '弹簧调参器、曲线可视化、可打断', tag: 'H · 运动', group: '展厅' },
    { id: 'feedback', file: 'feedback.html', nav: 'more', code: 'I', title: '反馈系统', desc: 'Toast、对话框、工具提示、进度', tag: 'I · 反馈', group: '展厅' },
    { id: 'accessibility', file: 'accessibility.html', nav: 'more', code: 'J', title: '无障碍交互', desc: '对比度检测、焦点、reduced-motion', tag: 'J · 无障碍', group: '展厅' },
    { id: 'data-viz', file: 'data-viz.html', nav: 'more', code: 'K', title: '数据可视化', desc: '手写 SVG 图表与弹簧绘制', tag: 'K · 数据', group: '展厅' },
    { id: 'design-system', file: 'design-system.html', nav: 'more', code: 'L', title: '设计系统', desc: '本站全部 token 与组件状态矩阵', tag: 'L · 系统', group: '规范' },
  ];

  var PRIMARY_IDS = ['index', 'atlas', 'micro-interactions', 'states-feedback', 'motion-physics'];
  var EXTRA_IDS = [
    'scroll-motion',
    'page-transitions',
    'navigation',
    'forms',
    'gestures',
    'feedback',
    'accessibility',
    'data-viz',
    'design-system',
  ];

  function site(id) {
    return SITES.filter(function (s) {
      return s.id === id;
    })[0];
  }

  var pageId = document.documentElement.getAttribute('data-page') || 'index';
  var current = site(pageId) || SITES[0];
  var router = ML.Q = ML.Q || {};
  router.sites = SITES;
  router.current = current;

  /* ------------------------------------------------------------------------
     2. Header
     ------------------------------------------------------------------------ */
  function buildHeader() {
    var host = document.getElementById('site-header');
    if (!host) return;

    var header = create('header', { class: 'hdr', id: 'hdr', 'data-scrolled': 'false' });
    var progress = create('div', { class: 'scroll-progress', 'aria-hidden': 'true' });
    progress.appendChild(create('span', { class: 'scroll-progress__bar', id: 'scroll-progress' }));

    var inner = create('div', { class: 'hdr__inner shell' });

    var brand = create('a', { class: 'brand', href: 'index.html', 'aria-label': 'MOTION LAB 首页' });
    var mark = create('span', { class: 'brand__mark', 'aria-hidden': 'true' });
    mark.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
      '<path d="M3 17c3.5 0 5-10 9-10s3.5 6 6 6" /></svg>';
    brand.appendChild(mark);
    brand.appendChild(create('span', { class: 'brand__text' }, 'MOTION<span class="brand__dot">.</span>LAB'));

    var nav = create('nav', { class: 'nav', id: 'primary-nav', 'aria-label': '主导航' });
    PRIMARY_IDS.forEach(function (id) {
      var s = site(id);
      nav.appendChild(create('a', { class: 'nav__link', 'data-nav': s.nav, href: s.file, text: s.title }));
    });

    var moreBtn = create('button', {
      class: 'nav__link nav__link--more',
      id: 'nav-more',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'nav-more-panel',
    });
    moreBtn.appendChild(document.createTextNode('全部展厅'));
    moreBtn.appendChild(icon('chevron-down', { size: 16 }));

    var panel = create('div', { class: 'nav__panel', id: 'nav-more-panel', hidden: 'hidden' });
    var grid = create('div', { class: 'nav__panel-grid' });
    SITES.forEach(function (s) {
      var link = create('a', { class: 'nav__panel-link', href: s.file, 'data-site': s.id });
      link.appendChild(create('span', { class: 'nav__panel-code mono', text: s.code }));
      var text = create('span', { class: 'nav__panel-text' });
      text.appendChild(create('span', { class: 'nav__panel-title', text: s.title }));
      text.appendChild(create('span', { class: 'nav__panel-desc', text: s.desc }));
      link.appendChild(text);
      grid.appendChild(link);
    });
    panel.appendChild(grid);
    panel.appendChild(
      create('p', {
        class: 'nav__panel-hint tnum',
        html: '键盘：<kbd>⌘</kbd><kbd>K</kbd> 命令面板 · <kbd>/</kbd> 聚焦搜索 · <kbd>Esc</kbd> 关闭',
      })
    );

    nav.appendChild(moreBtn);
    nav.appendChild(panel);

    var actions = create('div', { class: 'hdr__actions' });

    var cmd = create('button', {
      class: 'btn btn--ghost btn--icon',
      id: 'btn-command',
      type: 'button',
      'aria-keyshortcuts': 'Meta+K Control+K',
      'aria-label': '打开命令面板（快捷键 Command 或 Control 加 K）',
      title: '命令面板 ⌘K',
    });
    cmd.appendChild(icon('search', { size: 18 }));

    var motionBtn = create('button', {
      class: 'btn btn--ghost btn--icon',
      id: 'btn-motion',
      type: 'button',
      'aria-label': '切换动效强度',
      title: '动效强度',
    });

    var themeBtn = create('button', {
      class: 'btn btn--ghost btn--icon',
      id: 'btn-theme',
      type: 'button',
      'aria-label': '切换明暗主题',
      title: '切换主题',
    });

    var menuBtn = create('button', {
      class: 'btn btn--ghost btn--icon hdr__menu-btn',
      id: 'btn-menu',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'mobile-drawer',
      'aria-label': '打开菜单',
    });
    menuBtn.appendChild(icon('menu', { size: 18 }));

    actions.appendChild(cmd);
    actions.appendChild(motionBtn);
    actions.appendChild(themeBtn);
    actions.appendChild(menuBtn);

    inner.appendChild(brand);
    inner.appendChild(nav);
    inner.appendChild(actions);

    header.appendChild(progress);
    header.appendChild(inner);
    host.replaceWith(header);

    /* 当前页高亮 */
    qa('[data-nav]', header).forEach(function (link) {
      var match = link.getAttribute('data-nav') === current.nav && link.classList.contains('nav__link');
      if (current.nav === 'more' && link.hasAttribute('data-nav') && link.getAttribute('data-nav') === 'more' && !link.classList.contains('nav__link--more')) {
        match = false;
      }
      link.classList.toggle('is-active', match);
      if (match) link.setAttribute('aria-current', 'page');
    });
    if (current.nav === 'more') {
      moreBtn.classList.add('is-active');
      moreBtn.setAttribute('aria-current', 'page');
    }
    qa('[data-site]', panel).forEach(function (link) {
      var active = link.getAttribute('data-site') === pageId;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
    });

    /* 滚动状态 */
    ML.scroll.onScroll(function (y) {
      header.setAttribute('data-scrolled', y > 12 ? 'true' : 'false');
    });

    return { header: header, moreBtn: moreBtn, panel: panel, cmd: cmd, motionBtn: motionBtn, themeBtn: themeBtn, menuBtn: menuBtn, brand: brand };
  }

  /* ------------------------------------------------------------------------
     3. 动效档位按钮（跟随系统 → 完整 → 精简 → 关闭）
     ------------------------------------------------------------------------ */
  var MOTION_MODES = [
    { mode: 'on', icon: 'zap', label: '完整动效', desc: '全部弹簧、视差、揭示动画开启。' },
    { mode: 'lite', icon: 'sparkle', label: '精简动效', desc: '仅保留不透明度与颜色过渡，位移与视差关闭。' },
    { mode: 'off', icon: 'zap-off', label: '关闭动效', desc: '所有动画瞬时完成，内容完全静态呈现。' },
  ];

  function motionLabel(mode) {
    var item = MOTION_MODES.filter(function (m) {
      return m.mode === mode;
    })[0];
    return item ? item.label : '完整动效';
  }

  function paintMotionBtn(btn) {
    if (!btn) return;
    var mode = ML.motion.get();
    var item = MOTION_MODES.filter(function (m) {
      return m.mode === mode;
    })[0] || MOTION_MODES[0];
    btn.innerHTML = '';
    btn.appendChild(icon(item.icon, { size: 18 }));
    btn.setAttribute('aria-pressed', mode === 'on' ? 'false' : 'true');
    btn.setAttribute('aria-label', '动效强度：' + item.label + (ML.motion.isSystem() ? '（跟随系统）' : '（已手动设置）'));
    btn.title = '动效强度：' + item.label + ' · 点击切换';
    var dot = create('span', { class: 'btn__dot btn__dot--' + mode, 'aria-hidden': 'true' });
    btn.appendChild(dot);
  }

  function cycleMotion() {
    var order = ['on', 'lite', 'off'];
    var idx = order.indexOf(ML.motion.get());
    var next = order[(idx + 1) % order.length];
    ML.motion.set(next);
    var item = MOTION_MODES.filter(function (m) {
      return m.mode === next;
    })[0];
    UI.toast({
      title: '动效强度：' + item.label,
      desc: item.desc,
      variant: 'info',
      duration: 3600,
      action: { label: '跟随系统', onClick: function () {
        ML.motion.set('system');
        paintMotionBtn(q('#btn-motion'));
        paintMotionBtn(q('#btn-motion-2'));
        paintFooterLabels();
      } },
    });
  }

  /* ------------------------------------------------------------------------
     4. 主题按钮
     ------------------------------------------------------------------------ */
  function paintThemeBtn(btn) {
    if (!btn) return;
    var theme = ML.theme.get();
    btn.innerHTML = '';
    btn.appendChild(icon(theme === 'dark' ? 'moon' : 'sun', { size: 18 }));
    btn.setAttribute('aria-label', '当前' + (theme === 'dark' ? '暗色' : '亮色') + '主题，点击切换');
    btn.title = '主题：' + (theme === 'dark' ? '暗色' : '亮色');
  }

  /* ------------------------------------------------------------------------
     5. 移动端抽屉
     ------------------------------------------------------------------------ */
  function buildDrawer() {
    var host = document.getElementById('site-overlays') || document.body;
    var scrim = create('div', { class: 'drawer__scrim fade', id: 'mobile-drawer-scrim' });
    var panel = create('aside', {
      class: 'drawer__panel drawer__panel--nav enter-slide-right',
      id: 'mobile-drawer',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': '站点导航',
      hidden: 'hidden',
    });
    var head = create('header', { class: 'drawer__head' });
    head.appendChild(create('p', { class: 'eyebrow', text: 'MOTION LAB' }));
    var closeBtn = create('button', { class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': '关闭菜单' });
    closeBtn.appendChild(icon('close', { size: 18 }));
    head.appendChild(closeBtn);

    var body = create('div', { class: 'drawer__body' });
    SITES.forEach(function (s) {
      var link = create('a', { class: 'drawer__link', href: s.file, 'data-site': s.id });
      link.appendChild(create('span', { class: 'drawer__code mono', text: s.code }));
      link.appendChild(create('span', { class: 'drawer__title', text: s.title }));
      link.appendChild(icon('arrow-right', { size: 16 }));
      if (s.id === pageId) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
      body.appendChild(link);
    });

    panel.appendChild(head);
    panel.appendChild(body);

    var root = create('div', { class: 'drawer drawer--nav', hidden: 'hidden' });
    root.appendChild(scrim);
    root.appendChild(panel);
    host.appendChild(root);

    var lastFocus = null;
    var isOpen = false;

    function open() {
      if (isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      root.hidden = false;
      panel.hidden = false;
      ML.scroll.lock();
      requestAnimationFrame(function () {
        scrim.classList.add('is-open');
        panel.classList.add('is-open');
      });
      var first = panel.querySelector('a, button');
      if (first) window.setTimeout(function () { first.focus({ preventScroll: true }); }, ML.reduced ? 10 : 90);
      on(document, 'keydown', onKey);
    }

    function onKey(ev) {
      if (ev.key === 'Escape') close();
      if (ev.key !== 'Tab') return;
      var list = qa('a[href], button', panel);
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

    function close() {
      if (!isOpen) return;
      isOpen = false;
      scrim.classList.remove('is-open');
      panel.classList.remove('is-open');
      panel.classList.add('is-closing');
      window.setTimeout(
        function () {
          root.hidden = true;
          panel.hidden = true;
          panel.classList.remove('is-closing');
        },
        ML.reduced ? 0 : 300
      );
      document.removeEventListener('keydown', onKey);
      ML.scroll.unlock();
      if (lastFocus) window.setTimeout(function () { lastFocus.focus({ preventScroll: true }); }, 60);
      var btn = q('#btn-menu');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', '打开菜单');
      }
    }

    on(closeBtn, 'click', close);
    on(scrim, 'click', close);

    return { open: open, close: close, isOpen: function () { return isOpen; }, panel: panel };
  }

  /* ------------------------------------------------------------------------
     6. 命令面板
     ------------------------------------------------------------------------ */
  function buildPalette() {
    var host = document.getElementById('site-overlays') || document.body;
    var root = create('div', { class: 'palette', id: 'palette', hidden: 'hidden' });
    var scrim = create('div', { class: 'palette__scrim', 'data-palette-close': '' });
    var box = create('div', { class: 'palette__box enter-scale', role: 'dialog', 'aria-modal': 'true', 'aria-label': '命令面板' });

    var field = create('div', { class: 'palette__field' });
    field.appendChild(icon('search', { size: 18 }));
    var input = create('input', {
      id: 'palette-input',
      type: 'text',
      role: 'combobox',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-expanded': 'true',
      'aria-controls': 'palette-list',
      'aria-autocomplete': 'list',
      placeholder: '搜索展厅、交互条目或关键词…',
      'aria-label': '搜索展厅与交互条目',
    });
    field.appendChild(input);
    field.appendChild(create('span', { class: 'palette__kbd' }, '<kbd>Esc</kbd>'));

    var list = create('ul', { class: 'palette__list', id: 'palette-list', role: 'listbox', 'aria-label': '搜索结果' });
    var hint = create('p', {
      class: 'palette__hint',
      html: '<kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>↵</kbd> 打开 · <kbd>Esc</kbd> 关闭 · 共 ' + SITES.length + ' 个页面',
    });

    box.appendChild(field);
    box.appendChild(list);
    box.appendChild(hint);
    root.appendChild(scrim);
    root.appendChild(box);
    host.appendChild(root);

    var items = [];
    var activeIndex = 0;

    function score(text, query) {
      var t = text.toLowerCase();
      var ql = query.toLowerCase();
      if (!ql) return 1;
      var idx = t.indexOf(ql);
      if (idx === -1) {
        /* 逐字匹配（中文友好） */
        var qi = 0;
        for (var i = 0; i < t.length && qi < ql.length; i++) if (t[i] === ql[qi]) qi++;
        return qi === ql.length ? 0.4 : 0;
      }
      return 1 - idx / Math.max(1, t.length);
    }

    function build(query) {
      var ql = (query || '').trim();
      var rows = SITES.map(function (s) {
        var haystack = [s.title, s.desc, s.tag, s.code, s.file].join(' ');
        return { s: s, score: score(haystack, ql) };
      })
        .filter(function (row) {
          return row.score > 0;
        })
        .sort(function (a, b) {
          return b.score - a.score;
        })
        .slice(0, 9);

      items = rows.map(function (row) {
        return row.s;
      });

      list.innerHTML = '';
      if (!items.length) {
        var empty = create('li', { class: 'palette__empty' });
        empty.appendChild(icon('search', { size: 18 }));
        empty.appendChild(create('p', { text: '没有匹配的展厅。试试「弹簧」「无障碍」「表格」或直接输入展厅编号 A–L。' }));
        list.appendChild(empty);
        return;
      }

      items.forEach(function (s, i) {
        var li = create('li', {
          class: 'palette__item',
          role: 'option',
          id: 'palette-option-' + i,
          'aria-selected': i === 0 ? 'true' : 'false',
        });
        li.appendChild(create('span', { class: 'palette__code mono', text: s.code }));
        var text = create('span', { class: 'palette__text' });
        text.appendChild(create('span', { class: 'palette__title', text: s.title }));
        text.appendChild(create('span', { class: 'palette__desc', text: s.desc }));
        li.appendChild(text);
        li.appendChild(icon('arrow-up-right', { size: 16, cls: 'palette__go' }));
        on(li, 'pointerenter', function () {
          setActive(i);
        });
        on(li, 'click', function () {
          go(s);
        });
        list.appendChild(li);
      });
      setActive(0);
    }

    function setActive(index) {
      activeIndex = index;
      qa('.palette__item', list).forEach(function (li, i) {
        var active = i === index;
        li.classList.toggle('is-active', active);
        li.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      input.setAttribute('aria-activedescendant', 'palette-option-' + index);
      var el = qa('.palette__item', list)[index];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }

    function go(s) {
      close();
      ML.markForward();
      window.location.href = s.file;
    }

    var isOpen = false;
    var lastFocus = null;

    function open(prefill) {
      if (isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      root.hidden = false;
      build(prefill || '');
      input.value = prefill || '';
      /* 同步加 is-open：不依赖首帧回调，避免极端环境下浮层opacity 停在 0 */
      box.classList.add('is-open');
      requestAnimationFrame(function () {
        box.classList.add('is-open');
        scrim.classList.add('is-open');
      });
      ML.scroll.lock();
      window.setTimeout(function () {
        input.focus({ preventScroll: true });
      }, ML.reduced ? 10 : 70);
      on(document, 'keydown', onKey);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      box.classList.remove('is-open');
      box.classList.add('is-closing');
      scrim.classList.remove('is-open');
      window.setTimeout(
        function () {
          root.hidden = true;
          box.classList.remove('is-closing');
        },
        ML.reduced ? 0 : 220
      );
      document.removeEventListener('keydown', onKey);
      ML.scroll.unlock();
      if (lastFocus) window.setTimeout(function () { lastFocus.focus({ preventScroll: true }); }, 50);
    }

    function onKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
        return;
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (items.length) setActive((activeIndex + 1) % items.length);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (items.length) setActive((activeIndex - 1 + items.length) % items.length);
      } else if (ev.key === 'Home') {
        if (items.length) setActive(0);
      } else if (ev.key === 'End') {
        if (items.length) setActive(items.length - 1);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (items[activeIndex]) go(items[activeIndex]);
      }
    }

    on(input, 'input', function () {
      build(input.value);
    });
    on(scrim, 'click', close);

    return { open: open, close: close, isOpen: function () { return isOpen; }, input: input, root: root };
  }

  /* ------------------------------------------------------------------------
     7. Footer
     ------------------------------------------------------------------------ */
  function buildFooter() {
    var host = document.getElementById('site-footer');
    if (!host) return null;
    var footer = create('footer', { class: 'ftr' });
    var inner = create('div', { class: 'shell ftr__inner' });

    var top = create('div', { class: 'ftr__top' });
    var brandCol = create('div', { class: 'ftr__brand' });
    brandCol.appendChild(create('p', { class: 'eyebrow', text: 'MOTION LAB · 交互交付展' }));
    brandCol.appendChild(create('p', { class: 'ftr__claim', text: '丝滑不是感觉，是可复现的参数。' }));
    brandCol.appendChild(
      create('p', {
        class: 'ftr__note',
        text: '本站全部动效由手写 CSS 与原生 JavaScript 弹簧物理驱动：零框架、零依赖、零构建，双击 index.html 即可运行。',
      })
    );
    top.appendChild(brandCol);

    var cols = create('div', { class: 'ftr__cols' });
    var col1 = create('nav', { class: 'ftr__col', 'aria-label': '展厅导航' });
    col1.appendChild(create('p', { class: 'ftr__col-title', text: '展厅' }));
    SITES.filter(function (s) {
      return s.group === '展厅';
    }).forEach(function (s) {
      col1.appendChild(create('a', { class: 'ftr__link', href: s.file, text: s.code + ' · ' + s.title }));
    });
    var col2 = create('div', { class: 'ftr__col' });
    col2.appendChild(create('p', { class: 'ftr__col-title', text: '入口与规范' }));
    SITES.filter(function (s) {
      return s.group !== '展厅';
    }).forEach(function (s) {
      col2.appendChild(create('a', { class: 'ftr__link', href: s.file, text: s.title }));
    });
    col2.appendChild(create('a', { class: 'ftr__link', href: 'DESIGN-SYSTEM.md', text: '设计系统契约（Markdown）' }));
    col2.appendChild(create('a', { class: 'ftr__link', href: 'CONTRACT.md', text: '工程契约（Markdown）' }));
    cols.appendChild(col1);
    cols.appendChild(col2);
    top.appendChild(cols);

    var meta = create('div', { class: 'ftr__meta' });
    var motionBtn = create('button', { class: 'btn btn--ghost', id: 'btn-motion-2', type: 'button', text: '动效强度：完整' });
    var themeBtn = create('button', { class: 'btn btn--ghost', id: 'btn-theme-2', type: 'button', text: '主题：暗' });
    meta.appendChild(motionBtn);
    meta.appendChild(themeBtn);
    meta.appendChild(
      create('p', {
        class: 'ftr__fine tnum',
        text: '14 页 · 120+ 可交互条目 · WCAG AA 对比度 · prefers-reduced-motion 全站降级',
      })
    );

    var bottom = create('div', { class: 'ftr__bottom' });
    bottom.appendChild(
      create('p', {
        class: 'ftr__fine',
        text: '本项目为交互设计交付演示，不含任何真实用户数据与第三方追踪脚本。',
      })
    );
    bottom.appendChild(create('p', { class: 'ftr__fine tnum', text: '© ' + new Date().getFullYear() + ' MOTION LAB' }));

    inner.appendChild(top);
    inner.appendChild(meta);
    inner.appendChild(bottom);
    footer.appendChild(inner);
    host.replaceWith(footer);

    return { footer: footer, motionBtn: motionBtn, themeBtn: themeBtn };
  }

  function paintFooterLabels() {
    var mode = q('#btn-motion-2');
    if (mode) mode.textContent = '动效强度：' + motionLabel(ML.motion.get()) + (ML.motion.isSystem() ? '（跟随系统）' : '');
    var theme = q('#btn-theme-2');
    if (theme) theme.textContent = '主题：' + (ML.theme.get() === 'dark' ? '暗' : '亮');
  }

  /* ------------------------------------------------------------------------
     8. 启动
     ------------------------------------------------------------------------ */
  function boot() {
    var headerParts = buildHeader();
    var drawer = buildDrawer();
    var palette = buildPalette();
    var footerParts = buildFooter();

    /* 动效按钮 × 2 */
    var motionBtns = [headerParts && headerParts.motionBtn, footerParts && footerParts.motionBtn].filter(Boolean);
    motionBtns.forEach(function (btn) {
      paintMotionBtn(btn);
      on(btn, 'click', cycleMotion);
    });

    /* 主题按钮 × 2 */
    var themeBtns = [headerParts && headerParts.themeBtn, footerParts && footerParts.themeBtn].filter(Boolean);
    themeBtns.forEach(function (btn) {
      paintThemeBtn(btn);
      on(btn, 'click', function () {
        ML.theme.toggle();
      });
    });

    ML.motion.onChange(function () {
      motionBtns.forEach(paintMotionBtn);
      paintFooterLabels();
    });
    on(document, 'ml:theme', function () {
      themeBtns.forEach(paintThemeBtn);
      paintFooterLabels();
    });

    /* 命令面板入口 */
    if (headerParts && headerParts.cmd) {
      on(headerParts.cmd, 'click', function () {
        palette.open('');
      });
    }

    /* 全体展厅面板（点击开合 + 点击外部关闭） */
    if (headerParts && headerParts.moreBtn) {
      var moreBtn = headerParts.moreBtn;
      var panel = headerParts.panel;
      function setPanel(open) {
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
      }
      on(moreBtn, 'click', function (ev) {
        ev.stopPropagation();
        setPanel(panel.hidden);
      });
      on(document, 'click', function (ev) {
        if (panel.hidden) return;
        if (!panel.contains(ev.target) && ev.target !== moreBtn && !moreBtn.contains(ev.target)) setPanel(false);
      });
      on(document, 'keydown', function (ev) {
        if (ev.key === 'Escape' && !panel.hidden) {
          setPanel(false);
          moreBtn.focus();
        }
      });
    }

    /* 移动端菜单 */
    if (headerParts && headerParts.menuBtn) {
      on(headerParts.menuBtn, 'click', function () {
        var btn = headerParts.menuBtn;
        if (drawer.isOpen()) drawer.close();
        else {
          drawer.open();
          btn.setAttribute('aria-expanded', 'true');
          btn.setAttribute('aria-label', '关闭菜单');
        }
      });
    }

    /* 全局快捷键 */
    on(document, 'keydown', function (ev) {
      var tag = (ev.target && ev.target.tagName) || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ev.target && ev.target.isContentEditable);
      if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault();
        palette.open('');
        return;
      }
      if (ev.key === '/' && !typing) {
        ev.preventDefault();
        palette.open('');
        return;
      }
      if (ev.key === 'Escape') {
        if (palette.isOpen()) palette.close();
        var navPanel = q('#nav-more-panel');
        if (navPanel && !navPanel.hidden) navPanel.hidden = true;
      }
    });

    /* 声明式增强 */
    ML.initExtras(document);

    /* 页面切换过渡：为 body 增加标记，供页面做整体淡入 */
    document.body.classList.add('is-ready');

    /* 通知其他脚本：外壳就绪 */
    document.dispatchEvent(new CustomEvent('ml:ready', { detail: { page: pageId } }));
  }

  if (document.readyState === 'loading') {
    on(document, 'DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
