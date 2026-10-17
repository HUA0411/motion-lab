/* 展厅 E · 导航模式 — 12 个真实可交互 demo */
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
  function exitMs() { return reduced() ? 16 : 360 * 0.68 + 60; }

  /* 打开（360ms 进入）/ 关闭（×0.68 退出）通用显隐 */
  function enter(el) {
    if (!el) return;
    el.classList.remove('is-closing');
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('is-open');
  }
  function exit(el, done) {
    if (!el) return;
    el.classList.remove('is-open');
    if (reduced()) {
      el.hidden = true;
      if (done) done();
      return;
    }
    el.classList.add('is-closing');
    window.setTimeout(function () {
      el.classList.remove('is-closing');
      el.hidden = true;
      if (done) done();
    }, exitMs());
  }
  function trapTab(panel, ev) {
    if (ev.key !== 'Tab' || !panel) return;
    var list = qa('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', panel)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (ev.shiftKey && d.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && d.activeElement === last) { ev.preventDefault(); first.focus(); }
  }
  /* 逐帧循环：优先用内核 ML.schedule（fn 返回 false 表示完成），无则退回自递归 ML.raf */
  function loop(step) {
    if (ML.schedule) {
      var off = ML.schedule(function () { return step() === false; });
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

  var HALLS = [
    ['index.html', '首页'], ['atlas.html', '交互地图'], ['micro-interactions.html', '微交互'], ['states-feedback.html', '状态与反馈'],
    ['scroll-motion.html', '滚动叙事'], ['page-transitions.html', '页面转场'], ['navigation.html', '导航模式'], ['forms.html', '表单交互'],
    ['gestures.html', '手势与拖拽'], ['motion-physics.html', '运动物理'], ['feedback.html', '反馈系统'], ['accessibility.html', '无障碍交互'],
    ['data-viz.html', '数据可视化'], ['design-system.html', '设计系统']
  ];

  /* 图标占位符统一由 JS 注入 SVG（禁止 emoji） */
  function hydrateIcons(root) {
    qa('[data-np-icon]', root || d).forEach(function (el) {
      if (el.dataset.npIconDone === '1') return;
      el.dataset.npIconDone = '1';
      el.appendChild(icon(el.getAttribute('data-np-icon'), parseInt(el.getAttribute('data-np-icon-size'), 10) || 18));
    });
  }

  function mark(text, query) {
    var box = d.createElement('span');
    if (!query) { box.textContent = text; return box; }
    var lower = text.toLowerCase(), ql = query.toLowerCase(), at = lower.indexOf(ql);
    if (at < 0) { box.textContent = text; return box; }
    box.appendChild(d.createTextNode(text.slice(0, at)));
    var m = d.createElement('mark');
    m.textContent = text.slice(at, at + query.length);
    box.appendChild(m);
    box.appendChild(d.createTextNode(text.slice(at + query.length)));
    return box;
  }

  /* --------------------------------------------------- 01 命令面板（自建） */
  function bootCommand() {
    var openBtn = q('#np-cmd-open'), box = q('#np-cmd-box'), input = q('#np-cmd-input');
    var list = q('#np-cmd-list'), hint = q('#np-cmd-hint'), status = q('#np-cmd-status');
    if (!openBtn || !box || !input || !list) return;
    var RECENT_KEY = 'ml-nav-recent';
    var CMDS = [
      { g: '展厅', items: HALLS.map(function (h) { return { label: h[1], meta: h[0], href: h[0], kind: 'page' }; }) },
      {
        g: '交互条目', items: [
          { label: '弹簧参数调参器', meta: '展厅 H', href: 'motion-physics.html', kind: 'page' },
          { label: '缓动曲线对比器', meta: '展厅 H', href: 'motion-physics.html', kind: 'page' },
          { label: '拖拽排序 FLIP', meta: '展厅 G', href: 'gestures.html', kind: 'page' },
          { label: '内联校验与错误汇总', meta: '展厅 F', href: 'forms.html', kind: 'page' },
          { label: '面包屑溢出折叠', meta: '展厅 E', href: 'navigation.html', kind: 'page' },
          { label: '命令面板模式', meta: '展厅 E', href: 'navigation.html', kind: 'page' }
        ]
      },
      {
        g: '操作', items: [
          { label: '切换明暗主题', meta: 'ML.theme.toggle()', kind: 'cmd', run: function () { ML.theme.toggle(); return '主题已切换为 ' + ML.theme.get(); } },
          { label: '动效档位循环 on → lite → off', meta: 'ML.motion.set()', kind: 'cmd', run: function () { var order = ['on', 'lite', 'off']; var next = order[(order.indexOf(ML.motion.get()) + 1) % 3]; ML.motion.set(next); return '动效档位：' + next; } },
          { label: '回到页首', meta: 'ML.scroll.to(0)', kind: 'cmd', run: function () { ML.scroll.to(0); return '已回到页首'; } },
          { label: '复制当前页地址', meta: 'ML.copy()', kind: 'cmd', run: function () { ML.copy(window.location.href); return '地址已复制到剪贴板'; } }
        ]
      }
    ];
    var recent = [];
    try { recent = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { recent = []; }
    if (!Array.isArray(recent)) recent = [];
    var flat = [], active = 0, open = false;

    function pushRecent(label) {
      recent = [label].concat(recent.filter(function (r) { return r !== label; })).slice(0, 5);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) { /* 忽略 */ }
    }
    function groups(query) {
      var ql = (query || '').trim().toLowerCase();
      var out = [];
      if (recent.length) {
        var rec = [];
        recent.forEach(function (label) {
          var found = null;
          CMDS.forEach(function (grp) {
            grp.items.forEach(function (it) { if (it.label === label) found = it; });
          });
          if (found) rec.push(found);
        });
        if (rec.length) out.push({ g: '最近访问', items: rec });
      }
      CMDS.forEach(function (grp) {
        var items = grp.items.filter(function (it) {
          if (!ql) return true;
          return (it.label + ' ' + it.meta).toLowerCase().indexOf(ql) >= 0;
        });
        if (items.length) out.push({ g: grp.g, items: items });
      });
      return out;
    }
    function render() {
      var data = groups(input.value), idx = 0;
      flat = [];
      list.innerHTML = '';
      data.forEach(function (grp) {
        var head = d.createElement('li');
        head.className = 'np-cmd-group';
        head.setAttribute('role', 'presentation');
        head.textContent = grp.g;
        list.appendChild(head);
        grp.items.forEach(function (it) {
          var li = d.createElement('li');
          li.className = 'np-opt';
          li.id = 'np-cmd-opt-' + idx;
          li.setAttribute('role', 'option');
          li.setAttribute('aria-selected', idx === active ? 'true' : 'false');
          li.appendChild(mark(it.label, input.value.trim()));
          var meta = d.createElement('span');
          meta.className = 'np-opt__meta';
          meta.textContent = it.meta;
          li.appendChild(meta);
          ML.on(li, 'click', function () { active = idx; commit(it); });
          list.appendChild(li);
          flat.push({ el: li, item: it });
          idx++;
        });
      });
      if (!flat.length) {
        var empty = d.createElement('li');
        empty.className = 'np-cmd-empty';
        empty.setAttribute('role', 'presentation');
        empty.textContent = '没有匹配项 · 试试「弹簧」「主题」「面包屑」';
        list.appendChild(empty);
      }
      active = clamp(active, 0, Math.max(0, flat.length - 1));
      paint();
      setText(hint, '共 ' + flat.length + ' 项 · 最近访问 ' + recent.length + ' 条');
    }
    function paint() {
      flat.forEach(function (row, i) {
        row.el.setAttribute('aria-selected', i === active ? 'true' : 'false');
      });
      var cur = flat[active];
      if (cur) {
        input.setAttribute('aria-activedescendant', cur.el.id);
        if (cur.el.scrollIntoView) cur.el.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }
    function commit(it) {
      if (!it) return;
      pushRecent(it.label);
      if (it.kind === 'cmd' && it.run) {
        var msg = it.run();
        setText(status, '已执行「' + it.label + '」→ ' + msg);
        if (ML.UI && ML.UI.toast) ML.UI.toast({ title: it.label, desc: msg, variant: 'success' });
      } else {
        setText(status, '已选择「' + it.label + '」（' + it.meta + '）· 静态演示不跳转，真实站点在此执行 location.assign');
        if (ML.UI && ML.UI.toast) ML.UI.toast({ title: '已选择 ' + it.label, desc: '目标：' + it.meta, variant: 'info' });
      }
      close(true);
    }
    function openPanel() {
      if (open) return;
      open = true;
      enter(box);
      openBtn.setAttribute('aria-expanded', 'true');
      active = 0;
      input.value = '';
      render();
      input.focus();
      setText(status, '已打开 · ↑↓ 移动，Enter 执行，Esc 关闭');
    }
    function close(keepFocus) {
      if (!open) return;
      open = false;
      openBtn.setAttribute('aria-expanded', 'false');
      exit(box, function () { if (keepFocus) openBtn.focus(); });
      if (keepFocus) setText(status, '已关闭 · 焦点已回到触发按钮');
    }
    ML.on(openBtn, 'click', function () { open ? close(true) : openPanel(); });
    ML.on(input, 'input', function () { active = 0; render(); });
    ML.on(input, 'keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); active = clamp(active + 1, 0, flat.length - 1); paint(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = clamp(active - 1, 0, flat.length - 1); paint(); }
      else if (ev.key === 'Home') { ev.preventDefault(); active = 0; paint(); }
      else if (ev.key === 'End') { ev.preventDefault(); active = flat.length - 1; paint(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); commit(flat[active] ? flat[active].item : null); }
      else if (ev.key === 'Escape') { ev.preventDefault(); close(true); }
      else if (ev.key === 'Tab') { trapTab(box, ev); }
    });
    ML.on(d, 'keydown', function (ev) {
      if (!open) return;
      if (ev.key === 'Escape') { close(true); return; }
    });
    ML.on(d, 'pointerdown', function (ev) {
      if (!open) return;
      if (!box.contains(ev.target) && !openBtn.contains(ev.target)) close(false);
    });
    setText(status, '等待打开（Esc 关闭）');
  }

  /* ------------------------------------- 02 搜索自动补全（防抖 200ms） */
  function bootAutocomplete() {
    var input = q('#np-ac-input'), list = q('#np-ac-list'), status = q('#np-ac-status');
    var timeOut = q('#np-ac-time'), countOut = q('#np-ac-count');
    if (!input || !list) return;
    var TERMS = ['弹簧曲线', '缓动', '触摸目标', '内联校验', '浮动标签', '面包屑', '分页', '步骤向导', '粘性目录', '自动补全', '锚点高亮', '状态保持', '抽屉', '命令面板', '超大菜单', '底部导航', '焦点环', '对比度', '骨架屏', '空状态', '乐观更新', '视差', '揭示', '页面转场', '共享元素', '滑动删除', '拖拽排序', '双指缩放', '下拉刷新', '长按菜单', '拖动滑块', '手势阈值', '惯性滚动', '抛掷吸附', '错开序列', '时长阶梯', '过冲', '临界阻尼', '性能对比', '降级'];
    var INDEX = [];
    var i;
    for (i = 0; i < 60; i++) {
      INDEX.push({
        label: TERMS[i % TERMS.length] + (i >= TERMS.length ? '（进阶 ' + (Math.floor(i / TERMS.length) + 1) + '）' : ''),
        meta: HALLS[i % HALLS.length][1]
      });
    }
    var rows = [], active = 0, timer = null, open = false;

    function render(query) {
      var t0 = nowMs();
      var ql = query.trim().toLowerCase();
      var hits = ql ? INDEX.filter(function (it) { return (it.label + it.meta).toLowerCase().indexOf(ql) >= 0; }) : [];
      list.innerHTML = '';
      rows = [];
      hits.slice(0, 12).forEach(function (it, idx) {
        var li = d.createElement('li');
        li.className = 'np-opt';
        li.id = 'np-ac-opt-' + idx;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', idx === active ? 'true' : 'false');
        li.appendChild(mark(it.label, query.trim()));
        var meta = d.createElement('span');
        meta.className = 'np-opt__meta';
        meta.textContent = it.meta;
        li.appendChild(meta);
        ML.on(li, 'mousedown', function (ev) { ev.preventDefault(); pick(idx); });
        list.appendChild(li);
        rows.push(li);
      });
      var cost = nowMs() - t0;
      setText(timeOut, cost.toFixed(2) + 'ms');
      setText(countOut, String(hits.length));
      if (!ql) {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        open = false;
        setText(status, '输入关键词开始；已就绪 60 条索引');
        return;
      }
      open = true;
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (!hits.length) {
        var empty = d.createElement('li');
        empty.className = 'np-empty';
        empty.textContent = '没有匹配「' + query.trim() + '」的条目';
        list.appendChild(empty);
        input.removeAttribute('aria-activedescendant');
        setText(status, '无结果 · 换个词试试');
        return;
      }
      active = clamp(active, 0, rows.length - 1);
      rows.forEach(function (el, idx) { el.setAttribute('aria-selected', idx === active ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', rows[active].id);
      setText(status, '命中 ' + hits.length + ' 条 · 显示前 ' + rows.length + ' 条 · 查询耗时 ' + cost.toFixed(2) + 'ms');
    }
    function pick(idx) {
      var el = rows[idx];
      if (!el) return;
      input.value = el.firstChild ? el.firstChild.textContent : '';
      list.hidden = true;
      open = false;
      input.setAttribute('aria-expanded', 'false');
      setText(status, '已选择「' + input.value + '」· Esc 可清空');
      input.focus();
    }
    ML.on(input, 'input', function () {
      if (timer) window.clearTimeout(timer);
      active = 0;
      var value = input.value;
      timer = window.setTimeout(function () { render(value); }, 200);
    });
    ML.on(input, 'keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        if (!open || !rows.length) return;
        ev.preventDefault();
        active = clamp(active + (ev.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1);
        rows.forEach(function (el, idx) { el.setAttribute('aria-selected', idx === active ? 'true' : 'false'); });
        input.setAttribute('aria-activedescendant', rows[active].id);
        return;
      }
      if (ev.key === 'Enter' && open) { ev.preventDefault(); pick(active); return; }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        input.value = '';
        if (timer) window.clearTimeout(timer);
        render('');
      }
    });
    ML.on(d, 'pointerdown', function (ev) {
      if (!open) return;
      if (!list.contains(ev.target) && ev.target !== input) {
        list.hidden = true;
        open = false;
        input.setAttribute('aria-expanded', 'false');
      }
    });
    render('');
  }

  /* ------------------------------------------- 03 超大菜单（焦点管理） */
  function bootMega() {
    var btn = q('#np-mega-btn'), panel = q('#np-mega-panel'), cols = q('#np-mega-cols'), state = q('#np-mega-state');
    if (!btn || !panel || !cols) return;
    var COLS = [
      { title: '核心展厅', items: HALLS.slice(0, 5) },
      { title: '交互专题', items: HALLS.slice(5, 10) },
      { title: '系统与文档', items: HALLS.slice(10) }
    ];
    COLS.forEach(function (col) {
      var box = d.createElement('div');
      var h = d.createElement('p');
      h.className = 'np-mega__col-title';
      h.textContent = col.title;
      var ul = d.createElement('ul');
      ul.className = 'np-mega__links';
      col.items.forEach(function (it) {
        var li = d.createElement('li');
        var a = d.createElement('a');
        a.className = 'np-mega__link';
        a.href = it[0];
        a.textContent = it[1];
        li.appendChild(a);
        ul.appendChild(li);
      });
      box.appendChild(h);
      box.appendChild(ul);
      cols.appendChild(box);
    });
    var open = false;
    function links() { return qa('.np-mega__link', panel); }
    function openPanel() {
      if (open) return;
      open = true;
      enter(panel);
      btn.setAttribute('aria-expanded', 'true');
      setText(state, '已打开 · 焦点在第一个链接');
      var first = links()[0];
      if (first) first.focus();
    }
    function close(back) {
      if (!open) return;
      open = false;
      btn.setAttribute('aria-expanded', 'false');
      exit(panel, function () { if (back) btn.focus(); });
      setText(state, back ? '已关闭 · 焦点回到触发按钮' : '已关闭');
    }
    ML.on(btn, 'click', function () { open ? close(true) : openPanel(); });
    ML.on(panel, 'keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); close(true); return; }
      if (ev.key !== 'Tab') return;
      var l = links();
      if (!l.length) return;
      var first = l[0], last = l[l.length - 1];
      if (ev.shiftKey && d.activeElement === first) { ev.preventDefault(); close(true); }
      else if (!ev.shiftKey && d.activeElement === last) { ev.preventDefault(); close(true); }
    });
    ML.on(panel, 'focusout', function (ev) {
      if (!open) return;
      if (ev.relatedTarget && panel.contains(ev.relatedTarget)) return;
      if (ev.relatedTarget === btn) return;
      close(false);
    });
    ML.on(d, 'pointerdown', function (ev) {
      if (!open) return;
      if (!panel.contains(ev.target) && !btn.contains(ev.target)) close(false);
    });
    ML.on(d, 'keydown', function (ev) { if (open && ev.key === 'Escape') close(true); });
  }

  /* ----------------------------------------- 04 面包屑（溢出折叠） */
  function bootBreadcrumb() {
    var nav = q('#np-crumb-nav'), list = q('#np-crumb-list'), range = q('#np-crumb-width');
    var widthOut = q('#np-crumb-width-out'), status = q('#np-crumb-status');
    if (!nav || !list || !range) return;
    var LEVELS = [
      { label: '首页', href: 'index.html' },
      { label: '展厅', href: 'atlas.html' },
      { label: '交互专题', href: 'motion-physics.html' },
      { label: '弹簧参数调参器', current: true }
    ];
    var collapsed = 0, pop = null, queue = false;

    function closePop() {
      if (!pop) return;
      var el = pop;
      pop = null;
      el.hidden = true;
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    function openPop(anchor, from, to) {
      closePop();
      var box = d.createElement('div');
      box.className = 'np-crumb__pop np-enter';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', '被折叠的层级');
      var ul = d.createElement('ul');
      ul.className = 'np-mega__links';
      for (var i = from; i <= to; i++) {
        var li = d.createElement('li');
        var a = d.createElement('a');
        a.className = 'np-mega__link';
        a.href = LEVELS[i].href || '#main';
        a.textContent = LEVELS[i].label;
        li.appendChild(a);
        ul.appendChild(li);
      }
      box.appendChild(ul);
      anchor.parentNode.appendChild(box);
      pop = box;
      enter(box);
      var first = q('.np-mega__link', box);
      if (first) first.focus();
      ML.once(d, 'pointerdown', function (ev) {
        if (pop && !pop.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) closePop();
      });
      ML.on(box, 'keydown', function (ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); closePop(); anchor.focus(); }
      });
      setText(status, '折叠 ' + (to - from + 1) + ' 层：' + LEVELS.slice(from, to + 1).map(function (l) { return l.label; }).join(' → '));
    }
    function item(level, isLast) {
      var li = d.createElement('li');
      var a = d.createElement('a');
      a.className = 'np-crumb__link' + (level.current ? ' np-crumb__current' : '');
      a.href = level.href || '#main';
      a.textContent = level.label;
      if (level.current) a.setAttribute('aria-current', 'page');
      li.appendChild(a);
      if (isLast) li.setAttribute('aria-current', 'page');
      return li;
    }
    function render() {
      list.innerHTML = '';
      list.appendChild(item(LEVELS[0], false));
      if (collapsed > 0) {
        var li = d.createElement('li');
        var btn = d.createElement('button');
        btn.type = 'button';
        btn.className = 'np-crumb__more';
        btn.textContent = '…';
        btn.setAttribute('aria-label', '展开被折叠的 ' + collapsed + ' 个层级');
        btn.setAttribute('aria-expanded', 'false');
        ML.on(btn, 'click', function () {
          if (pop) { closePop(); btn.setAttribute('aria-expanded', 'false'); return; }
          btn.setAttribute('aria-expanded', 'true');
          openPop(btn, 1, collapsed);
        });
        li.appendChild(btn);
        list.appendChild(li);
      }
      for (var i = collapsed + 1; i < LEVELS.length; i++) {
        list.appendChild(item(LEVELS[i], i === LEVELS.length - 1));
      }
      setText(status, collapsed === 0
        ? '完整层级：首页 / 展厅 / 交互专题 / 弹簧参数调参器'
        : '已折叠 ' + collapsed + ' 层（宽度 ' + nav.clientWidth + 'px），可展开查看');
    }
    function layout() {
      if (queue) return;
      queue = true;
      var un = ML.raf(function () {
        un();
        queue = false;
        collapsed = 0;
        render();
        var guard = 0;
        while (list.scrollWidth > nav.clientWidth - 8 && collapsed < LEVELS.length - 2 && guard < 6) {
          collapsed++;
          render();
          guard++;
        }
      });
    }
    ML.on(range, 'input', function () {
      nav.style.width = range.value + 'px';
      setText(widthOut, range.value + 'px');
      closePop();
      layout();
    });
    if (ML.observeSize) ML.observeSize(nav, layout);
    render();
    nav.style.width = '640px';
    layout();
  }

  /* ----------------------------------------- 05 标签页滑动指示器 */
  function bootTabs() {
    var bar = q('#np-tabs-bar'), ind = q('#np-tabs-ind'), panels = q('#np-tabs-panels'), status = q('#np-tabs-status');
    if (!bar || !ind || !panels) return;
    var TABS = [
      { label: '总览', body: ['指示器用 translateX + scaleX 组合位移，基准宽度固定 120px，缩放比 = 实际宽度 / 120。', '因此它永远不会动画 width，也就不会触发布局重排。'] },
      { label: '键盘', body: ['←→ 移动并立即激活（roving tabindex），Home / End 跳到首末。', '焦点环与选中态同时存在，不依赖颜色单一通道。'] },
      { label: '降级', body: ['lite / off 档位下指示器瞬时定位，选中态仍由 aria-selected 与文字颜色表达。', '三条内容面板都提供可读文本，不依赖动画才能理解。'] },
      { label: '规格', body: ['时长 240ms，缓动 --ease-snap（等效 ML.presets.snap 520/30/0.7）。', '指示器只做 transform，will-change: transform 提升为合成层。'] }
    ];
    var btns = [], panelEls = [], cur = 0, spring = null;
    TABS.forEach(function (tab, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'np-tab';
      b.id = 'np-tab-' + i;
      b.textContent = tab.label;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.setAttribute('aria-controls', 'np-tabpanel-' + i);
      b.setAttribute('tabindex', i === 0 ? '0' : '-1');
      ML.on(b, 'click', function () { select(i, false); });
      bar.appendChild(b);
      btns.push(b);

      var p = d.createElement('div');
      p.className = 'np-tabpanel';
      p.id = 'np-tabpanel-' + i;
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', 'np-tab-' + i);
      p.tabIndex = 0;
      tab.body.forEach(function (line) {
        var t = d.createElement('p');
        t.textContent = line;
        p.appendChild(t);
      });
      p.hidden = i !== 0;
      panels.appendChild(p);
      panelEls.push(p);
    });
    function move(indicator) {
      if (!indicator) return;
      var w = indicator.offsetWidth, x = indicator.offsetLeft;
      var sx = Math.max(0.1, w / 120);
      if (spring) { spring.stop(); spring = null; }
      ind.style.transform = 'translate3d(' + x + 'px,0,0) scaleX(' + sx + ')';
    }
    function select(i, focus) {
      cur = clamp(i, 0, btns.length - 1);
      btns.forEach(function (b, k) {
        b.setAttribute('aria-selected', k === cur ? 'true' : 'false');
        b.setAttribute('tabindex', k === cur ? '0' : '-1');
      });
      panelEls.forEach(function (p, k) { p.hidden = k !== cur; });
      move(btns[cur]);
      if (focus) btns[cur].focus();
      setText(status, '当前：' + TABS[cur].label + '（第 ' + (cur + 1) + '/' + TABS.length + ' 项）');
    }
    ML.on(bar, 'keydown', function (ev) {
      var next = null;
      if (ev.key === 'ArrowRight') next = (cur + 1) % btns.length;
      else if (ev.key === 'ArrowLeft') next = (cur - 1 + btns.length) % btns.length;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = btns.length - 1;
      else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(cur, true); return; }
      if (next !== null) { ev.preventDefault(); select(next, true); }
    });
    if (ML.observeSize) ML.observeSize(bar, function () { move(btns[cur]); });
    ML.on(window, 'resize', function () { move(btns[cur]); });
    select(0, false);
  }

  /* --------------------------------------------- 06 步骤向导（可回退） */
  function bootStepper() {
    var dots = q('#np-step-dots'), body = q('#np-step-body'), fill = q('#np-step-fill');
    var status = q('#np-step-status'), prev = q('#np-step-prev'), next = q('#np-step-next'), lastBtn = q('#np-step-last');
    if (!dots || !body || !prev || !next) return;
    var STEPS = [
      { label: '账户', title: '第 1 步 · 账户信息', fields: [{ id: 'np-step-name', label: '姓名', type: 'text', hint: '用于生成交付清单' }] },
      { label: '项目', title: '第 2 步 · 项目信息', fields: [{ id: 'np-step-project', label: '项目代号', type: 'text', hint: '例如 项目 Atlas' }] },
      { label: '交付', title: '第 3 步 · 交付方式', fields: [{ id: 'np-step-channel', label: '交付渠道', type: 'text', hint: '邮件 / 内网 / U 盘' }] },
      { label: '确认', title: '第 4 步 · 确认提交', fields: [] }
    ];
    var values = {}, cur = 0, dotEls = [];

    STEPS.forEach(function (step, i) {
      var li = d.createElement('li');
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'np-step__dot';
      b.textContent = (i + 1) + ' ' + step.label;
      b.setAttribute('aria-current', i === 0 ? 'step' : 'false');
      ML.on(b, 'click', function () { go(i); });
      li.appendChild(b);
      dots.appendChild(li);
      dotEls.push(b);
    });
    function render() {
      body.innerHTML = '';
      var h = d.createElement('p');
      h.className = 'mono tnum';
      h.textContent = STEPS[cur].title;
      body.appendChild(h);
      STEPS[cur].fields.forEach(function (f) {
        var wrap = d.createElement('div');
        wrap.className = 'np-ctl';
        var label = d.createElement('label');
        label.className = 'label';
        label.setAttribute('for', f.id);
        label.textContent = f.label;
        var input = d.createElement('input');
        input.className = 'np-input';
        input.id = f.id;
        input.type = f.type;
        input.value = values[f.id] || '';
        input.setAttribute('aria-describedby', f.id + '-hint');
        ML.on(input, 'input', function () { values[f.id] = input.value; });
        var hint = d.createElement('p');
        hint.className = 'np-hint';
        hint.id = f.id + '-hint';
        hint.textContent = f.hint;
        wrap.appendChild(label); wrap.appendChild(input); wrap.appendChild(hint);
        body.appendChild(wrap);
      });
      if (cur === STEPS.length - 1) {
        var sum = d.createElement('p');
        sum.className = 'np-hint mono tnum';
        sum.textContent = '已收集：' + Object.keys(values).map(function (k) { return k.replace('np-step-', '') + '=' + (values[k] || '（空）'); }).join(' · ');
        body.appendChild(sum);
      }
      dotEls.forEach(function (b, i) {
        b.setAttribute('aria-current', i === cur ? 'step' : 'false');
        b.classList.toggle('is-done', i < cur);
      });
      if (fill) fill.style.transform = 'scaleX(' + ((cur + 1) / STEPS.length) + ')';
      prev.disabled = cur === 0;
      next.textContent = cur === STEPS.length - 1 ? '完成' : '下一步';
      setText(status, '第 ' + (cur + 1) + ' / ' + STEPS.length + ' 步 · 还剩 ' + (STEPS.length - cur - 1) + ' 步 · 已填 ' + Object.keys(values).filter(function (k) { return values[k]; }).length + ' 项');
    }
    function go(i) {
      cur = clamp(i, 0, STEPS.length - 1);
      render();
    }
    ML.on(prev, 'click', function () { go(cur - 1); });
    ML.on(next, 'click', function () { go(cur + 1); });
    if (lastBtn) ML.on(lastBtn, 'click', function () { go(STEPS.length - 1); });
    ML.on(dots, 'keydown', function (ev) {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); dotEls[clamp(cur + 1, 0, dotEls.length - 1)].focus(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); dotEls[clamp(cur - 1, 0, dotEls.length - 1)].focus(); }
    });
    render();
  }

  /* ---------------------------------------------------------- 07 分页器 */
  function bootPager() {
    var list = q('#np-pager-list'), nav = q('#np-pager-nav'), status = q('#np-pager-status');
    if (!list || !nav) return;
    var TOTAL = 48, PER = 6, PAGES = TOTAL / PER, cur = 1;
    var DATA = [];
    for (var i = 1; i <= TOTAL; i++) DATA.push('条目 ' + (i < 10 ? '0' + i : i) + ' · 规格样本');

    function pageItems(page) {
      var keep = [];
      for (var p = 1; p <= PAGES; p++) {
        if (p === 1 || p === PAGES || Math.abs(p - page) <= 1) keep.push(p);
      }
      var out = [], prevP = 0;
      keep.forEach(function (p) {
        if (prevP && p - prevP > 1) out.push('gap');
        out.push(p);
        prevP = p;
      });
      return out;
    }
    function renderList() {
      list.innerHTML = '';
      DATA.slice((cur - 1) * PER, cur * PER).forEach(function (text, idx) {
        var li = d.createElement('li');
        li.className = 'np-pager__item';
        var n = d.createElement('span');
        n.className = 'np-pager__idx';
        n.textContent = String((cur - 1) * PER + idx + 1).padStart(2, '0');
        var t = d.createElement('span');
        t.textContent = text;
        li.appendChild(n); li.appendChild(t);
        list.appendChild(li);
      });
      if (!reduced()) {
        list.style.opacity = '0.2';
        var un = ML.raf(function () {
          un();
          list.style.opacity = '1';
        });
      }
      setText(status, '第 ' + ((cur - 1) * PER + 1) + '–' + (cur * PER) + ' 条 / 共 ' + TOTAL + ' 条 · 第 ' + cur + '/' + PAGES + ' 页');
    }
    function renderNav() {
      nav.innerHTML = '';
      function mk(label, page, opts) {
        var b = d.createElement('button');
        b.type = 'button';
        b.className = 'np-page' + ((opts && opts.gap) ? ' np-page--gap' : '');
        b.textContent = label;
        if (opts && opts.gap) { b.disabled = true; b.setAttribute('aria-hidden', 'true'); return b; }
        if (opts && opts.disabled) b.disabled = true;
        if (page === cur) b.setAttribute('aria-current', 'page');
        if (opts && opts.aria) b.setAttribute('aria-label', opts.aria);
        ML.on(b, 'click', function () { if (page !== cur) { cur = page; renderList(); renderNav(); } });
        return b;
      }
      nav.appendChild(mk('首页', 1, { disabled: cur === 1, aria: '第一页' }));
      nav.appendChild(mk('上一页', cur - 1, { disabled: cur === 1, aria: '上一页' }));
      pageItems(cur).forEach(function (p) {
        nav.appendChild(p === 'gap' ? mk('…', null, { gap: true }) : mk(String(p), p, { aria: '第 ' + p + ' 页' }));
      });
      nav.appendChild(mk('下一页', cur + 1, { disabled: cur === PAGES, aria: '下一页' }));
      nav.appendChild(mk('末页', PAGES, { disabled: cur === PAGES, aria: '最后一页' }));
    }
    renderList();
    renderNav();
  }

  /* --------------------------------------- 08 粘性侧栏目录（滚动高亮） */
  function bootToc() {
    var list = q('#np-toc-list'), scroll = q('#np-toc-scroll'), content = q('#np-toc-content'), status = q('#np-toc-status');
    if (!list || !scroll || !content) return;
    var SECS = [
      { id: 'np-toc-a', title: '概览', text: '目录用 position: sticky 常驻，滚动时高亮当前节，避免长页面里失去位置感。' },
      { id: 'np-toc-b', title: '触发时机', text: '每次滚动只做一次读取与一次写入，避免在滚动回调里读写交替造成强制同步布局。' },
      { id: 'np-toc-c', title: '键盘', text: '目录项是可聚焦按钮，Enter 与点击同效；滚动容器本身也可聚焦并用方向键浏览。' },
      { id: 'np-toc-d', title: '降级', text: '动效关闭时滚动变为瞬时（scroll 行为 auto），高亮仍由 aria-current 与字重表达。' }
    ];
    var links = [], sections = [], activeId = SECS[0].id;
    SECS.forEach(function (sec, i) {
      var li = d.createElement('li');
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'np-toc__link';
      b.textContent = (i + 1) + '. ' + sec.title;
      b.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      ML.on(b, 'click', function () { go(sec); });
      li.appendChild(b);
      list.appendChild(li);
      links.push(b);

      var wrap = d.createElement('section');
      wrap.className = 'np-toc__sec';
      wrap.id = sec.id;
      var h = d.createElement('h4');
      h.textContent = sec.title;
      var p = d.createElement('p');
      p.textContent = sec.text + ' ' + sec.text;
      wrap.appendChild(h); wrap.appendChild(p);
      content.appendChild(wrap);
      sections.push(wrap);
    });
    function go(sec) {
      var top = sec.offsetTop - 8;
      if (reduced()) scroll.scrollTop = top;
      else scroll.scrollTo({ top: top, behavior: 'smooth' });
      setText(status, '跳转到：' + sec.title);
    }
    function paint() {
      links.forEach(function (b, i) {
        b.setAttribute('aria-current', SECS[i].id === activeId ? 'true' : 'false');
      });
    }
    ML.on(scroll, 'scroll', function () {
      var top = scroll.scrollTop + 24;
      var found = SECS[0].id;
      sections.forEach(function (sec) { if (sec.offsetTop <= top) found = sec.id; });
      if (found !== activeId) {
        activeId = found;
        paint();
        var idx = SECS.map(function (s) { return s.id; }).indexOf(activeId);
        setText(status, '当前节：' + (SECS[idx] ? SECS[idx].title : '') + '（滚动位置 ' + Math.round(scroll.scrollTop) + 'px）');
      }
    }, { passive: true });
    setText(status, '当前节：概览（滚动右侧内容观察高亮）');
  }

  /* ------------------------------------- 09 移动端底部导航（≤5 项） */
  function bootBottomNav() {
    var bar = q('#np-bn-bar'), title = q('#np-phone-title'), text = q('#np-phone-text');
    if (!bar) return;
    var ITEMS = [
      { label: '概览', icon: 'layout', title: '概览', text: '底部 5 个目的地始终可见，当前项同时用颜色、字重与指示条三种方式表达。' },
      { label: '地图', icon: 'grid', title: '交互地图', text: '全站 120 条交互条目的可筛选索引，按展厅与类型分组。' },
      { label: '物理', icon: 'zap', title: '运动物理', text: '弹簧参数实时调参器：三个滑杆驱动小球与位移/速度曲线。' },
      { label: '反馈', icon: 'bell', title: '反馈系统', text: 'toast 栈、aria-live 播报、弹出层定位与翻转、确认对话框。' },
      { label: '我的', icon: 'eye', title: '我的偏好', text: '主题与动效档位保存在 localStorage，跨页面保持一致。' }
    ];
    var ind = d.createElement('span');
    ind.className = 'np-bn__ind';
    ind.setAttribute('aria-hidden', 'true');
    bar.appendChild(ind);
    var btns = [], cur = 0;
    ITEMS.forEach(function (it, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'np-bn';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-current', i === 0 ? 'page' : 'false');
      b.setAttribute('tabindex', i === 0 ? '0' : '-1');
      b.appendChild(icon(it.icon, 20));
      b.appendChild(d.createTextNode(it.label));
      ML.on(b, 'click', function () { select(i, false); });
      bar.appendChild(b);
      btns.push(b);
    });
    function select(i, focus) {
      cur = clamp(i, 0, btns.length - 1);
      btns.forEach(function (b, k) {
        b.setAttribute('aria-current', k === cur ? 'page' : 'false');
        b.setAttribute('tabindex', k === cur ? '0' : '-1');
      });
      ind.style.transform = 'translate3d(' + (cur * 100) + '%,0,0) scaleX(1)';
      if (title) title.textContent = ITEMS[cur].title;
      if (text) text.textContent = ITEMS[cur].text;
      if (focus) btns[cur].focus();
    }
    ML.on(bar, 'keydown', function (ev) {
      var next = null;
      if (ev.key === 'ArrowRight') next = (cur + 1) % btns.length;
      else if (ev.key === 'ArrowLeft') next = (cur - 1 + btns.length) % btns.length;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = btns.length - 1;
      if (next !== null) { ev.preventDefault(); select(next, true); }
    });
    select(0, false);
  }

  /* ------------------------------------------------------- 10 抽屉菜单 */
  function bootDrawer() {
    var openBtn = q('#np-drawer-open'), panel = q('#np-drawer-panel'), scrim = q('#np-drawer-scrim');
    var closeBtn = q('#np-drawer-close'), list = q('#np-drawer-list'), status = q('#np-drawer-status');
    if (!openBtn || !panel || !scrim) return;
    HALLS.forEach(function (h) {
      var li = d.createElement('li');
      var a = d.createElement('a');
      a.className = 'np-drawer__link';
      a.href = h[0];
      a.textContent = h[1];
      li.appendChild(a);
      list.appendChild(li);
    });
    var open = false;
    function openPanel() {
      if (open) return;
      open = true;
      scrim.hidden = false;
      void scrim.offsetWidth;
      scrim.classList.add('is-open');
      enter(panel);
      openBtn.setAttribute('aria-expanded', 'true');
      setText(status, '已打开 · Tab 在抽屉内循环，Esc 关闭');
      var first = q('.np-drawer__link', panel) || closeBtn;
      if (first) first.focus();
    }
    function close(back) {
      if (!open) return;
      open = false;
      openBtn.setAttribute('aria-expanded', 'false');
      exit(panel, function () { if (back) openBtn.focus(); });
      if (reduced()) { scrim.hidden = true; scrim.classList.remove('is-open'); }
      else {
        scrim.classList.remove('is-open');
        scrim.classList.add('is-closing');
        window.setTimeout(function () {
          scrim.classList.remove('is-closing');
          scrim.hidden = true;
        }, exitMs());
      }
      setText(status, back ? '已关闭 · 焦点回到触发按钮' : '已关闭');
    }
    ML.on(openBtn, 'click', function () { open ? close(true) : openPanel(); });
    ML.on(closeBtn, 'click', function () { close(true); });
    ML.on(scrim, 'click', function () { close(true); });
    ML.on(panel, 'keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); close(true); return; }
      trapTab(panel, ev);
    });
    ML.on(d, 'keydown', function (ev) { if (open && ev.key === 'Escape') close(true); });
  }

  /* ------------------------------------------- 11 锚点导航（scrollspy） */
  function bootAnchors() {
    var status = q('#np-anchor-status'), links = qa('.np-anchors__link');
    if (!links.length) return;
    var ids = ['np-sec-search', 'np-sec-structure', 'np-sec-mobile'];
    var secs = ids.map(function (id) { return q('#' + id); }).filter(Boolean);
    if (!secs.length) return;
    function paint(id, label) {
      links.forEach(function (a) {
        var target = a.getAttribute('href');
        a.setAttribute('aria-current', target === '#' + id ? 'true' : 'false');
      });
      setText(status, '当前节：' + label + '（滚动本页观察）');
    }
    function spy() {
      var probe = window.innerHeight * 0.35;
      var found = secs[0], i;
      for (i = 0; i < secs.length; i++) {
        if (secs[i].getBoundingClientRect().top <= probe) found = secs[i];
      }
      var idx = secs.indexOf(found);
      if (found.id !== activeId) {
        activeId = found.id;
        paint(found.id, '0' + (idx + 1) + ' ' + (idx === 0 ? '检索与跳转' : idx === 1 ? '结构与位置' : '移动与状态'));
      }
      var atTop = ML.scroll.y() < 80;
      links.forEach(function (a) {
        if (a.getAttribute('href') === '#main') a.setAttribute('aria-current', atTop ? 'true' : 'false');
      });
    }
    var activeId = null;
    ML.scroll.onScroll(spy);
    ML.on(window, 'resize', spy);
    spy();
  }

  /* ------------------------------------- 12 返回行为与状态保持 */
  function bootBackState() {
    var filters = q('#np-back-filters'), list = q('#np-back-list'), detail = q('#np-back-detail');
    var returnBtn = q('#np-back-return'), status = q('#np-back-status'), stateOut = q('#np-back-state');
    if (!filters || !list || !detail) return;
    var CATS = [['all', '全部'], ['comp', '组件'], ['page', '页面'], ['motion', '动效']];
    var ITEMS = [
      ['按钮按压物理', 'comp'], ['开关三段位移', 'comp'], ['页面转场方向', 'page'], ['面包屑折叠', 'page'],
      ['弹簧过冲', 'motion'], ['缓动曲线', 'motion'], ['复选框刻度', 'comp'], ['共享元素转场', 'page'],
      ['时长阶梯', 'motion'], ['抽屉焦点锁定', 'comp'], ['滚动揭示', 'motion'], ['步骤向导回退', 'page']
    ];
    var state = { view: 'list', filter: 'all', scroll: 0, item: -1 }, curFilter = 'all';

    function paint() {
      var shown = ITEMS.filter(function (it) { return curFilter === 'all' || it[1] === curFilter; });
      list.innerHTML = '';
      shown.forEach(function (it) {
        var idx = ITEMS.indexOf(it);
        var b = d.createElement('button');
        b.type = 'button';
        b.className = 'np-card';
        b.textContent = it[0];
        var tag = d.createElement('span');
        tag.className = 'np-card__tag';
        tag.textContent = CATS.filter(function (c) { return c[0] === it[1]; })[0][1];
        b.appendChild(tag);
        ML.on(b, 'click', function () { openDetail(idx); });
        list.appendChild(b);
      });
      if (!shown.length) {
        var empty = d.createElement('p');
        empty.className = 'np-empty';
        empty.textContent = '该分类下暂无条目';
        list.appendChild(empty);
      }
      filters.innerHTML = '';
      CATS.forEach(function (cat) {
        var b = d.createElement('button');
        b.type = 'button';
        b.className = 'np-chip';
        b.textContent = cat[1];
        b.setAttribute('aria-pressed', cat[0] === curFilter ? 'true' : 'false');
        ML.on(b, 'click', function () {
          curFilter = cat[0];
          state.filter = curFilter;
          state.scroll = 0;
          paint();
          save('筛选切换为「' + cat[1] + '」');
        });
        filters.appendChild(b);
      });
      paintState();
    }
    function paintState() {
      setText(stateOut, JSON.stringify({ view: state.view, filter: state.filter, scroll: Math.round(state.scroll), item: state.item }));
      setText(status, state.view === 'list'
        ? '当前：列表 · 筛选 ' + curFilter + ' · 已保存滚动 ' + Math.round(state.scroll) + 'px'
        : '当前：详情「' + (ITEMS[state.item] ? ITEMS[state.item][0] : '') + '」 · 筛选 ' + curFilter + ' · 返回将还原滚动位置');
    }
    function save(note) {
      try { window.localStorage.setItem('ml-nav-back', JSON.stringify(state)); } catch (e) { /* 忽略 */ }
      paintState();
      if (note) setText(status, note + ' · 已写入 history.state 与 localStorage');
    }
    function openDetail(idx) {
      state.view = 'detail';
      state.item = idx;
      state.filter = curFilter;
      state.scroll = list.scrollTop;
      detail.innerHTML = '';
      var h = d.createElement('h4');
      h.textContent = ITEMS[idx][0];
      var p = d.createElement('p');
      p.textContent = '分类：' + CATS.filter(function (c) { return c[0] === ITEMS[idx][1]; })[0][1] + ' · 离开列表时滚动位置 ' + Math.round(state.scroll) + 'px 已写入 history.state，返回时还原。';
      var back = d.createElement('button');
      back.type = 'button';
      back.className = 'btn btn--ghost';
      back.textContent = '返回列表';
      ML.on(back, 'click', function () { history.back(); });
      detail.appendChild(h); detail.appendChild(p); detail.appendChild(back);
      try { history.pushState({ npView: 'detail', npFilter: state.filter, npScroll: state.scroll, npItem: idx }, '', '#np-detail-' + idx); } catch (e) { /* file:// 下可能受限 */ }
      list.hidden = true;
      filters.hidden = true;
      detail.hidden = false;
      if (returnBtn) returnBtn.hidden = false;
      save();
      setText(status, '已进入详情 · 用浏览器后退或「返回列表」还原');
    }
    function restore(fromState, note) {
      var next = fromState && typeof fromState.npView === 'string' ? fromState : null;
      state.view = next ? next.npView : 'list';
      state.filter = next ? next.npFilter : 'all';
      state.scroll = next ? (next.npScroll || 0) : 0;
      state.item = next ? (next.npItem === undefined ? -1 : next.npItem) : -1;
      curFilter = state.filter || 'all';
      paint();
      if (state.view === 'list') {
        list.hidden = false;
        filters.hidden = false;
        detail.hidden = true;
        if (returnBtn) returnBtn.hidden = true;
        list.scrollTop = state.scroll;
        setText(status, (note || '已返回列表') + ' · 筛选「' + curFilter + '」与滚动 ' + Math.round(state.scroll) + 'px 已还原');
      } else {
        openDetailRaw(state.item);
      }
      paintState();
    }
    function openDetailRaw(idx) {
      if (idx < 0 || idx >= ITEMS.length) { restore({ npView: 'list', npFilter: state.filter, npScroll: 0 }, '目标条目不存在'); return; }
      detail.innerHTML = '';
      var h = d.createElement('h4');
      h.textContent = ITEMS[idx][0];
      var p = d.createElement('p');
      p.textContent = '从浏览器历史恢复的详情视图（item=' + idx + '）。';
      var back = d.createElement('button');
      back.type = 'button';
      back.className = 'btn btn--ghost';
      back.textContent = '返回列表';
      ML.on(back, 'click', function () { history.back(); });
      detail.appendChild(h); detail.appendChild(p); detail.appendChild(back);
      list.hidden = true;
      filters.hidden = true;
      detail.hidden = false;
      if (returnBtn) returnBtn.hidden = false;
      paintState();
    }
    ML.on(list, 'scroll', function () {
      if (state.view === 'list') {
        state.scroll = list.scrollTop;
        paintState();
      }
    }, { passive: true });
    if (returnBtn) ML.on(returnBtn, 'click', function () {
      if (history.length > 1) history.back();
      else restore(null, '直接返回');
    });
    ML.on(window, 'popstate', function (ev) { restore(ev.state, '浏览器后退'); });
    var saved = null;
    try { saved = JSON.parse(window.localStorage.getItem('ml-nav-back') || 'null'); } catch (e) { saved = null; }
    paint();
    if (saved && saved.filter) {
      curFilter = saved.filter;
      state.filter = saved.filter;
      paint();
      setText(status, '已从 localStorage 恢复上次筛选「' + curFilter + '」· 当前：列表');
    }
  }

  function boot() {
    if (!window.ML) return;
    hydrateIcons(d);
    [bootCommand, bootAutocomplete, bootMega, bootBreadcrumb, bootTabs, bootStepper, bootPager, bootToc, bootBottomNav, bootDrawer, bootAnchors, bootBackState]
      .forEach(function (fn) { try { fn(); } catch (err) { /* 单个 demo 失败不阻塞其它 */ } });
  }

  d.addEventListener('ml:ready', boot, { once: true });
})();
