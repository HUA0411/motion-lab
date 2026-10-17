/* 展厅 F · 表单交互 — 15 个真实可交互 demo（无网络请求，全部本地模拟） */
(function () {
  'use strict';

  var d = document;

  function q(sel, root) { return ML.q(sel, root || d); }
  function qa(sel, root) { return ML.qa(sel, root || d); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function reduced() { return ML.reduced === true || (ML.motion && ML.motion.get() !== 'on'); }
  function icon(name, size) { return (ML.UI && ML.UI.icon) ? ML.UI.icon(name, { size: size || 18 }) : d.createElement('span'); }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function clock(date) { return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds()); }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function hydrateIcons(root) {
    qa('[data-fp-icon]', root || d).forEach(function (el) {
      if (el.dataset.fpIconDone === '1') return;
      el.dataset.fpIconDone = '1';
      el.appendChild(icon(el.getAttribute('data-fp-icon'), 16));
    });
  }

  /* ------------------------------------------ 01 浮动标签 */
  function bootFloat() {
    var wrap = q('#demo-float');
    if (!wrap) return;
    var status = q('#fp-float-status');
    var boxes = qa('.fp-floatbox', wrap);
    function sync(box) {
      var input = q('.fp-input', box);
      if (!input) return;
      box.classList.toggle('is-filled', input.value.length > 0);
    }
    boxes.forEach(function (box) {
      var input = q('.fp-input', box);
      if (!input) return;
      ['input', 'change', 'blur', 'focus'].forEach(function (evt) {
        ML.on(input, evt, function () { sync(box); });
      });
    });
    var fill = q('#fp-float-fill'), clear = q('#fp-float-clear');
    if (fill) ML.on(fill, 'click', function () {
      var name = q('#fp-float-name'), mail = q('#fp-float-mail');
      name.value = '受访者 A';
      mail.value = 'a@example.com';
      boxes.forEach(sync);
      setText(status, '已填入示例值并进入上浮态（真实浏览器自动填充也会触发同样的 change 事件）');
      name.focus();
    });
    if (clear) ML.on(clear, 'click', function () {
      q('#fp-float-name').value = '';
      q('#fp-float-mail').value = '';
      boxes.forEach(sync);
      setText(status, '已清空 · 标签回落，label 始终可见');
    });
  }

  /* ------------------------------------------ 02 帮助文本与 required */
  function bootHints() {
    var btn = q('#fp-hints-toggle'), wrap = q('#demo-hints'), status = q('#fp-hints-status');
    if (!btn || !wrap) return;
    var hints = qa('.hint', wrap);
    var inputs = qa('.fp-input', wrap);
    var on = true;
    ML.on(btn, 'click', function () {
      on = !on;
      btn.setAttribute('aria-pressed', String(on));
      setText(btn.querySelector('span:last-child') || btn, on ? '隐藏帮助文本' : '显示帮助文本');
      hints.forEach(function (h) {
        if (on) {
          h.hidden = false;
          h.style.opacity = '1';
        } else {
          h.hidden = true;
        }
      });
      inputs.forEach(function (input) {
        var id = input.getAttribute('data-hint-id');
        if (!id) {
          var described = (input.getAttribute('aria-describedby') || '').split(' ')[0];
          if (described) { input.setAttribute('data-hint-id', described); id = described; }
        }
        if (!id) return;
        if (on) {
          var keep = input.getAttribute('aria-describedby') || '';
          if (keep.indexOf(id) < 0) input.setAttribute('aria-describedby', (keep + ' ' + id).trim());
        } else {
          var next = (input.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== id; }).join(' ');
          if (next) input.setAttribute('aria-describedby', next);
          else input.removeAttribute('aria-describedby');
        }
      });
      setText(status, on ? '帮助文本：显示中（aria-describedby 已接线）' : '帮助文本：已收起（aria-describedby 已移除，字段仍可访问）');
    });
  }

  /* ------------------------------------------ 03 只读 vs 禁用 */
  function bootReadonly() {
    var copyBtn = q('#fp-ro-copy'), focusBtn = q('#fp-ro-focus'), status = q('#fp-ro-status');
    var ro = q('#fp-ro-1'), dis = q('#fp-ro-2');
    if (!ro || !dis) return;
    if (copyBtn) ML.on(copyBtn, 'click', function () {
      ML.copy(ro.value);
      setText(status, '已复制只读值「' + ro.value + '」· 禁用字段无法被复制按钮读取（disabled 不进入表单数据）');
    });
    if (focusBtn) ML.on(focusBtn, 'click', function () {
      ro.focus();
      setText(status, '焦点已移到只读字段：' + (d.activeElement === ro ? '成功' : '失败') + ' · 接下来按 Tab 会直接跳过禁用字段');
    });
    ML.on(ro, 'focus', function () { setText(status, '只读字段获得焦点 · 可按 Ctrl/⌘+A 全选后复制'); });
    ML.on(dis, 'click', function () { setText(status, '禁用字段不响应焦点与点击事件'); });
  }

  /* ------------------------------------------ 04 fieldset / legend */
  function bootFieldset() {
    var form = q('#fp-group-form'), status = q('#fp-group-status');
    if (!form) return;
    var groups = qa('fieldset', form);
    ML.on(form, 'focusin', function (ev) {
      var fs = ev.target.closest ? ev.target.closest('fieldset') : null;
      var legend = fs ? q('legend', fs) : null;
      var idx = fs ? groups.indexOf(fs) + 1 : 0;
      setText(status, '焦点位于第 ' + idx + ' 组「' + (legend ? legend.textContent : '—') + '」· 读屏会先播报组名再读字段');
    });
    ML.on(form, 'submit', function (ev) { ev.preventDefault(); });
  }

  /* ------------------------------------------ 05 autocomplete */
  function bootAutofill() {
    var form = q('#fp-auto-form'), map = q('#fp-auto-map'), fill = q('#fp-auto-fill'), clear = q('#fp-auto-clear'), status = q('#fp-auto-status');
    if (!form || !map) return;
    var inputs = qa('input', form);
    var VALUES = {
      'fp-a-given': '受访者', 'fp-a-family': 'A', 'fp-a-tel': '13800000000',
      'fp-a-street': '示例路 18 号 3 单元 501', 'fp-a-city': '示例市', 'fp-a-zip': '100000'
    };
    inputs.forEach(function (input) {
      var label = q('label[for="' + input.id + '"]', form);
      var row = d.createElement('div');
      var dt = d.createElement('dt');
      dt.textContent = label ? label.textContent : input.id;
      var dd = d.createElement('dd');
      dd.textContent = input.getAttribute('autocomplete') || '（未设置）';
      row.appendChild(dt); row.appendChild(dd);
      map.appendChild(row);
    });
    if (fill) ML.on(fill, 'click', function () {
      inputs.forEach(function (input) {
        input.value = VALUES[input.id] || input.value;
        input.classList.add('is-autofilled');
      });
      window.setTimeout(function () {
        inputs.forEach(function (input) { input.classList.remove('is-autofilled'); });
      }, 1800);
      setText(status, '已填入 6 个字段并高亮 1.8s（真实自动填充同样由浏览器触发 change 事件）');
    });
    if (clear) ML.on(clear, 'click', function () {
      inputs.forEach(function (input) { input.value = ''; input.classList.remove('is-autofilled'); });
      setText(status, '已清空 · autocomplete 属性保持不变');
    });
    ML.on(form, 'submit', function (ev) { ev.preventDefault(); });
  }

  /* ------------------------------------------ 06 内联校验 */
  function bootInline() {
    var status = q('#fp-inline-status');
    var fields = [
      { field: '#fp-in-user-field', input: '#fp-in-user', err: '#fp-in-user-err', hint: 'fp-in-user-h',
        test: function (v) { return v.trim().length >= 3 ? '' : '用户名至少 3 个字符（当前 ' + v.trim().length + ' 个）'; } },
      { field: '#fp-in-mail-field', input: '#fp-in-mail', err: '#fp-in-mail-err', hint: 'fp-in-mail-h',
        test: function (v) { return EMAIL.test(v.trim()) ? '' : '请输入形如 name@example.com 的邮箱地址'; } }
    ];
    var typing = 0;
    function apply(cfg, msg) {
      var input = q(cfg.input), err = q(cfg.err);
      if (!input || !err) return;
      if (msg) {
        err.textContent = msg;
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', cfg.hint + ' ' + err.id);
      } else {
        err.textContent = '';
        err.hidden = true;
        input.removeAttribute('aria-invalid');
        input.setAttribute('aria-describedby', cfg.hint);
      }
    }
    fields.forEach(function (cfg) {
      var input = q(cfg.input);
      if (!input) return;
      ML.on(input, 'blur', function () {
        var msg = cfg.test(input.value);
        apply(cfg, msg);
        setText(status, msg ? '失焦校验：' + msg : '失焦校验通过 · “' + input.value.trim() + '”可用');
      });
      ML.on(input, 'input', function () {
        typing++;
        if (input.getAttribute('aria-invalid') === 'true') {
          var msg = cfg.test(input.value);
          if (!msg) {
            apply(cfg, '');
            setText(status, '错误已在输入中即时清除（累计输入 ' + typing + ' 次，从未打断输入）');
            return;
          }
        }
        setText(status, '输入中：不校验、不抖动（第 ' + typing + ' 次输入）');
      });
    });
  }

  /* ------------------------------------------ 07 错误汇总锚点 */
  function bootSummary() {
    var form = q('#fp-sum-form'), alert = q('#fp-sum-alert'), list = q('#fp-sum-list'), count = q('#fp-sum-count');
    var reset = q('#fp-sum-reset'), status = q('#fp-sum-status');
    if (!form || !alert || !list) return;
    var RULES = [
      { id: 'fp-s-name', label: '姓名', test: function (v) { return v.trim().length >= 2 ? '' : '姓名至少 2 个字符'; } },
      { id: 'fp-s-mail', label: '邮箱', test: function (v) { return EMAIL.test(v.trim()) ? '' : '邮箱格式不正确'; } },
      { id: 'fp-s-age', label: '年龄', test: function (v) { var n = parseInt(v, 10); return (n >= 18 && n <= 99) ? '' : '年龄需为 18–99 的整数'; } },
      { id: 'fp-s-note', label: '备注', test: function (v) { return v.trim().length > 0 ? '' : '备注不能为空'; } }
    ];
    function clearOne(rule) {
      var input = q('#' + rule.id), err = q('#' + rule.id + '-err');
      if (!input || !err) return;
      err.hidden = true;
      err.textContent = '';
      input.removeAttribute('aria-invalid');
    }
    ML.on(form, 'submit', function (ev) {
      ev.preventDefault();
      var errors = [];
      RULES.forEach(function (rule) {
        var input = q('#' + rule.id), err = q('#' + rule.id + '-err');
        if (!input || !err) return;
        var msg = rule.test(input.value);
        if (msg) {
          err.textContent = msg;
          err.hidden = false;
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute('aria-describedby', err.id);
          errors.push({ rule: rule, msg: msg });
        } else {
          clearOne(rule);
        }
      });
      list.innerHTML = '';
      if (!errors.length) {
        alert.hidden = true;
        setText(status, '校验通过：4 个字段全部有效，可以提交');
        return;
      }
      errors.forEach(function (item) {
        var li = d.createElement('li');
        var a = d.createElement('a');
        a.className = 'fp-alert__link';
        a.href = '#' + item.rule.id;
        a.textContent = item.rule.label + '：' + item.msg;
        li.appendChild(a);
        list.appendChild(li);
      });
      alert.hidden = false;
      setText(count, String(errors.length));
      setText(status, '发现 ' + errors.length + ' 处错误 · 汇总中的链接会聚焦对应字段（键盘 Enter 同样可用）');
      var first = q('.fp-alert__link', alert);
      if (first) first.focus();
    });
    if (reset) ML.on(reset, 'click', function () {
      RULES.forEach(function (rule) {
        var input = q('#' + rule.id);
        if (input) input.value = '';
        clearOne(rule);
      });
      alert.hidden = true;
      setText(status, '已重置 · 点击提交查看汇总');
    });
  }

  /* ------------------------------------------ 08 首个错误自动聚焦 */
  function bootFirstError() {
    var grid = q('#fp-first-grid'), form = q('#fp-first-form');
    var status = q('#fp-first-status'), fill = q('#fp-first-fill');
    if (!grid || !form) return;
    var FIELDS = [
      { label: '姓名', type: 'text', test: function (v) { return v.trim() ? '' : '请输入姓名'; } },
      { label: '邮箱', type: 'email', test: function (v) { return EMAIL.test(v.trim()) ? '' : '邮箱格式不正确'; } },
      { label: '年龄', type: 'text', test: function (v) { var n = parseInt(v, 10); return (n >= 18 && n <= 120) ? '' : '年龄需为 ≥18 的整数'; } },
      { label: '城市', type: 'text', test: function (v) { return v.trim() ? '' : '请输入城市'; } },
      { label: '邮编', type: 'text', test: function (v) { return /^\d{5,6}$/.test(v.trim()) ? '' : '邮编需为 5–6 位数字'; } },
      { label: '备注', type: 'text', test: function () { return ''; } }
    ];
    var okBox = null;
    FIELDS.forEach(function (f, i) {
      var wrap = d.createElement('div');
      wrap.className = 'fp-field';
      var label = d.createElement('label');
      label.className = 'label';
      label.setAttribute('for', 'fp-f-' + i);
      label.textContent = f.label;
      var input = d.createElement('input');
      input.className = 'fp-input';
      input.id = 'fp-f-' + i;
      input.type = f.type;
      var err = d.createElement('p');
      err.className = 'error';
      err.id = 'fp-f-' + i + '-err';
      err.setAttribute('role', 'alert');
      err.hidden = true;
      wrap.appendChild(label); wrap.appendChild(input); wrap.appendChild(err);
      grid.appendChild(wrap);
    });
    function show(i, msg) {
      var input = q('#fp-f-' + i), err = q('#fp-f-' + i + '-err');
      if (msg) {
        err.textContent = msg;
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', err.id);
      } else {
        err.hidden = true;
        err.textContent = '';
        input.removeAttribute('aria-invalid');
      }
    }
    ML.on(form, 'submit', function (ev) {
      ev.preventDefault();
      var firstBad = -1, bad = 0;
      FIELDS.forEach(function (f, i) {
        var input = q('#fp-f-' + i);
        var msg = f.test(input.value);
        show(i, msg);
        if (msg) { bad++; if (firstBad < 0) firstBad = i; }
      });
      if (okBox && okBox.parentNode) okBox.parentNode.removeChild(okBox);
      if (firstBad >= 0) {
        var target = q('#fp-f-' + firstBad);
        target.focus();
        ML.scroll.to(target, { offset: 120 });
        setText(status, '共 ' + bad + ' 处错误 · 焦点已移到第 ' + (firstBad + 1) + ' 个字段「' + FIELDS[firstBad].label + '」（当前焦点：' + (d.activeElement === target ? '已就位' : '未就位') + '）');
        return;
      }
      okBox = d.createElement('p');
      okBox.className = 'fp-status mono';
      okBox.tabIndex = -1;
      okBox.textContent = '校验通过：6 个字段全部有效，焦点已移到本提示。';
      form.appendChild(okBox);
      okBox.focus();
      setText(status, '校验通过 · 焦点移到成功提示（Tab 继续向下即可离开表单）');
    });
    if (fill) ML.on(fill, 'click', function () {
      var vals = ['受访者 A', 'a@example.com', '32', '示例市', '100000', '—'];
      FIELDS.forEach(function (f, i) { q('#fp-f-' + i).value = vals[i]; });
      setText(status, '已填入合法值 · 再提交会走成功分支');
    });
  }

  /* ------------------------------------------ 09 密码强度 */
  function bootPassword() {
    var input = q('#fp-pass'), wrap = q('#demo-password'), meter = q('#fp-pass-meter');
    var strength = q('#fp-pass-strength'), rules = q('#fp-pass-rules'), toggle = q('#fp-pass-toggle');
    if (!input || !wrap || !rules) return;
    var RULES = [
      { label: '至少 8 个字符', test: function (v) { return v.length >= 8; } },
      { label: '包含大小写字母', test: function (v) { return /[a-z]/.test(v) && /[A-Z]/.test(v); } },
      { label: '包含数字', test: function (v) { return /\d/.test(v); } },
      { label: '包含符号', test: function (v) { return /[^A-Za-z0-9]/.test(v); } }
    ];
    var TEXT = ['未输入', '弱', '一般', '较强', '强'];
    var ruleEls = RULES.map(function (r) {
      var li = d.createElement('li');
      li.className = 'fp-rule';
      var mark = d.createElement('span');
      mark.className = 'fp-rule__mark';
      var text = d.createElement('span');
      text.textContent = r.label;
      li.appendChild(mark); li.appendChild(text);
      rules.appendChild(li);
      return { el: li, mark: mark, rule: r, pass: false };
    });
    function update() {
      var v = input.value;
      var pass = 0;
      ruleEls.forEach(function (row) {
        row.pass = row.rule.test(v);
        if (row.pass) pass++;
        row.el.classList.toggle('is-pass', row.pass);
        row.mark.innerHTML = '';
        row.mark.appendChild(icon(row.pass ? 'check' : 'close', 12));
      });
      var level = v.length ? clamp(pass, 1, 4) : 0;
      wrap.setAttribute('data-level', String(level));
      if (meter) meter.setAttribute('data-level', String(level));
      setText(strength, '强度：' + TEXT[level] + '（通过 ' + pass + '/4 条规则，字符数 ' + v.length + '）');
    }
    ML.on(input, 'input', update);
    var shown = false;
    if (toggle) ML.on(toggle, 'click', function () {
      shown = !shown;
      input.type = shown ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(shown));
      toggle.setAttribute('aria-label', shown ? '隐藏密码' : '显示密码');
      toggle.innerHTML = '';
      toggle.appendChild(icon(shown ? 'eye-off' : 'eye', 18));
      setText(strength, '密码' + (shown ? '已明文显示（仅本 demo 的输入框）' : '已隐藏') + ' · 强度：' + TEXT[clamp(ruleEls.filter(function (r) { return r.pass; }).length, input.value.length ? 1 : 0, 4)]);
      input.focus();
    });
    update();
  }

  /* ------------------------------------------ 10 多步进度 */
  function bootMultistep() {
    var stepsEl = q('#fp-ms-steps'), body = q('#fp-ms-body'), fill = q('#fp-ms-fill');
    var prev = q('#fp-ms-prev'), next = q('#fp-ms-next'), status = q('#fp-ms-status');
    if (!stepsEl || !body || !prev || !next) return;
    var STEPS = [
      { label: '账户', fields: [{ id: 'fp-ms-user', label: '用户名', hint: '3–16 字符' }] },
      { label: '项目', fields: [{ id: 'fp-ms-proj', label: '项目代号', hint: '例如 项目 Atlas' }] },
      { label: '确认', fields: [{ id: 'fp-ms-note', label: '备注', hint: '可留空' }] }
    ];
    var values = {}, cur = 0, dots = [];
    STEPS.forEach(function (s, i) {
      var li = d.createElement('li');
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'fp-ms__step';
      b.textContent = (i + 1) + ' ' + s.label;
      b.setAttribute('aria-current', i === 0 ? 'step' : 'false');
      ML.on(b, 'click', function () { go(i); });
      li.appendChild(b);
      stepsEl.appendChild(li);
      dots.push(b);
    });
    function render() {
      body.innerHTML = '';
      STEPS[cur].fields.forEach(function (f) {
        var wrap = d.createElement('div');
        wrap.className = 'fp-field';
        var label = d.createElement('label');
        label.className = 'label';
        label.setAttribute('for', f.id);
        label.textContent = f.label;
        var input = d.createElement('input');
        input.className = 'fp-input';
        input.id = f.id;
        input.value = values[f.id] || '';
        var hint = d.createElement('p');
        hint.className = 'hint';
        hint.id = f.id + '-h';
        hint.textContent = f.hint;
        input.setAttribute('aria-describedby', hint.id);
        ML.on(input, 'input', function () { values[f.id] = input.value; });
        wrap.appendChild(label); wrap.appendChild(input); wrap.appendChild(hint);
        body.appendChild(wrap);
      });
      if (cur === STEPS.length - 1) {
        var sum = d.createElement('p');
        sum.className = 'hint mono tnum';
        sum.textContent = '当前已填：' + STEPS.map(function (s) {
          var v = values[s.fields[0].id];
          return s.label + '=' + (v ? v : '（空）');
        }).join(' · ');
        body.appendChild(sum);
      }
      dots.forEach(function (b, i) {
        b.setAttribute('aria-current', i === cur ? 'step' : 'false');
        b.classList.toggle('is-done', i < cur);
      });
      if (fill) fill.style.transform = 'scaleX(' + ((cur + 1) / STEPS.length) + ')';
      prev.disabled = cur === 0;
      next.textContent = cur === STEPS.length - 1 ? '完成' : '下一步';
      var left = STEPS.length - cur - 1;
      setText(status, '第 ' + (cur + 1) + ' / ' + STEPS.length + ' 步 · 还剩 ' + left + ' 步 · 已填 ' +
        Object.keys(values).filter(function (k) { return values[k]; }).length + ' 项（回退不丢失）');
    }
    function go(i) { cur = clamp(i, 0, STEPS.length - 1); render(); }
    ML.on(prev, 'click', function () { go(cur - 1); });
    ML.on(next, 'click', function () { go(cur + 1); });
    render();
  }

  /* ------------------------------------------ 11 自动保存草稿 */
  function bootDraft() {
    var title = q('#fp-dr-title'), body = q('#fp-dr-body'), status = q('#fp-draft-status');
    var saveBtn = q('#fp-draft-save'), clearBtn = q('#fp-draft-clear'), wrap = q('#demo-draft');
    if (!title || !body) return;
    var KEY = 'ml-form-draft';
    var timer = null;
    function setState(cls) {
      if (!wrap) return;
      wrap.classList.remove('is-saving', 'is-saved');
      if (cls) wrap.classList.add(cls);
    }
    function save(reason) {
      var payload = { title: title.value, body: body.value, at: new Date().toISOString(), chars: title.value.length + body.value.length };
      try { window.localStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) { /* 忽略 */ }
      setState('is-saved');
      setText(status, '已保存 ' + clock(new Date()) + ' · ' + payload.chars + ' 字（' + reason + '）· 存于 localStorage["' + KEY + '"]');
    }
    function schedule() {
      setState('is-saving');
      setText(status, '正在保存…（输入停止 800ms 后写入）');
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () { save('防抖触发'); }, 800);
    }
    ML.on(title, 'input', schedule);
    ML.on(body, 'input', schedule);
    if (saveBtn) ML.on(saveBtn, 'click', function () {
      if (timer) window.clearTimeout(timer);
      save('手动保存');
    });
    if (clearBtn) ML.on(clearBtn, 'click', function () {
      if (timer) window.clearTimeout(timer);
      try { window.localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
      title.value = '';
      body.value = '';
      setState(null);
      setText(status, '草稿已清除 · 重新输入会再次自动保存');
    });
    var saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && (saved.title || saved.body)) {
      title.value = saved.title || '';
      body.value = saved.body || '';
      setState('is-saved');
      var when = saved.at ? new Date(saved.at) : new Date();
      setText(status, '已恢复上次草稿（保存于 ' + clock(when) + '，' + (saved.chars || 0) + ' 字）· 继续输入将自动保存');
    } else {
      setText(status, '尚未保存 · 输入后 800ms 自动写入草稿');
    }
  }

  /* ------------------------------------------ 12 提交 loading → 成功 */
  function bootSubmit() {
    var form = q('#fp-sub-form'), btn = q('#fp-sub-btn'), iconBox = q('#fp-sub-icon'), text = q('#fp-sub-text');
    var status = q('#fp-sub-status'), wrap = q('#demo-submit'), mail = q('#fp-sub-mail');
    if (!form || !btn || !iconBox || !text) return;
    var busy = false;
    function paint(kind) {
      iconBox.innerHTML = '';
      iconBox.appendChild(icon(kind === 'loading' ? 'loader' : kind === 'success' ? 'check-circle' : 'arrow-right', 18));
      if (wrap) {
        wrap.classList.remove('is-loading', 'is-success', 'is-error');
        if (kind === 'loading') wrap.classList.add('is-loading');
        if (kind === 'success') wrap.classList.add('is-success');
        if (kind === 'error') wrap.classList.add('is-error');
      }
    }
    ML.on(form, 'submit', function (ev) {
      ev.preventDefault();
      if (busy) return;
      if (!EMAIL.test(mail.value.trim())) {
        setText(status, '邮箱格式不正确：' + mail.value + '（提交被拦截，按钮未进入 loading）');
        mail.focus();
        return;
      }
      busy = true;
      btn.disabled = true;
      text.textContent = '提交中…';
      paint('loading');
      setText(status, '提交中 · 按钮 disabled + 内联 loader，宽度保持 ' + Math.round(btn.offsetWidth) + 'px 不跳动');
      window.setTimeout(function () {
        busy = false;
        btn.disabled = false;
        text.textContent = '已提交';
        paint('success');
        setText(status, '提交成功 ' + clock(new Date()) + ' · 已向 ' + mail.value + ' 发送确认；2.6s 后可再次提交');
        window.setTimeout(function () {
          text.textContent = '提交申请';
          paint('idle');
          setText(status, '等待提交（可重复演示）');
        }, 2600);
      }, 1200);
    });
    paint('idle');
  }

  /* ------------------------------------------ 13 超时与错误恢复 */
  function bootTimeout() {
    var scene = q('#fp-to-scene'), note = q('#fp-to-note'), send = q('#fp-to-send'), retry = q('#fp-to-retry');
    var banner = q('#fp-to-banner'), title = q('#fp-to-title'), text = q('#fp-to-text'), status = q('#fp-to-status');
    if (!scene || !send || !banner) return;
    var timer = null;
    function showBanner(kind) {
      banner.hidden = false;
      if (kind === 'slow') {
        setText(title, '请求超时（8000ms 无响应）');
        setText(text, '服务器未在超时阈值内返回。已填的 ' + note.value.length + ' 个字符仍在输入框里 —— 把场景切回「正常返回」后点重试即可继续。');
      } else if (kind === 'err') {
        setText(title, '服务器错误 500');
        setText(text, '服务端处理失败，已保留你填写的 ' + note.value.length + ' 个字符。切回「正常返回」后重试。');
      }
      retry.hidden = false;
      retry.focus();
    }
    function run() {
      banner.hidden = true;
      retry.hidden = true;
      send.disabled = true;
      var chars = note.value.length;
      var mode = scene.value;
      setText(status, '提交中 · 场景「' + scene.options[scene.selectedIndex].text + '」· 待提交 ' + chars + ' 字');
      if (timer) window.clearTimeout(timer);
      if (mode === 'ok') {
        timer = window.setTimeout(function () {
          send.disabled = false;
          setText(status, '提交成功（1200ms）· ' + chars + ' 字全部送达 · 可再次演示失败场景');
        }, 1200);
        return;
      }
      if (mode === 'err') {
        timer = window.setTimeout(function () {
          send.disabled = false;
          setText(status, '失败：500 · 已填 ' + note.value.length + ' 字仍在（错误面板已聚焦重试按钮）');
          showBanner('err');
        }, 700);
        return;
      }
      timer = window.setTimeout(function () {
        send.disabled = false;
        setText(status, '失败：超时 8000ms · 已填 ' + note.value.length + ' 字仍在');
        showBanner('slow');
      }, 8000);
    }
    ML.on(send, 'click', run);
    if (retry) ML.on(retry, 'click', run);
  }

  /* ------------------------------------------ 14 危险操作二次确认 */
  function bootConfirm() {
    var del = q('#fp-cf-del'), dry = q('#fp-cf-dry'), status = q('#fp-cf-status');
    if (!del) return;
    ML.on(del, 'click', function () {
      if (!ML.UI || !ML.UI.confirm) {
        setText(status, '内核未提供 ML.UI.confirm，本 demo 无法运行');
        return;
      }
      ML.UI.confirm({
        title: '删除项目 Atlas？',
        desc: '48 条交互条目与全部规格标注会被移除，此操作不可恢复。',
        confirmText: '确认删除',
        danger: true
      }).then(function (ok) {
        setText(status, ok
          ? '已确认删除（' + clock(new Date()) + '）· 真实项目中此时调用删除接口；焦点已回到触发按钮'
          : '已取消 · 未产生任何副作用，焦点已回到触发按钮');
        if (ok && ML.UI.toast) ML.UI.toast({ title: '项目 Atlas 已删除', variant: 'danger', duration: 4000 });
      });
    });
    if (dry) ML.on(dry, 'click', function () {
      if (ML.UI && ML.UI.toast) {
        ML.UI.toast({ title: '影响范围', desc: '48 条条目 · 12 个展厅 · 3 份规格表将被移除', variant: 'warning', duration: 5000 });
      }
      setText(status, '已展示影响范围（toast，5s 后自动消失）· 尚未执行删除');
    });
  }

  /* ------------------------------------------ 15 撤销删除 */
  function bootUndo() {
    var list = q('#fp-undo-list'), bar = q('#fp-undo-bar'), fill = q('#fp-undo-fill'), barText = q('#fp-undo-text');
    var undoBtn = q('#fp-undo-btn'), status = q('#fp-undo-status');
    if (!list || !bar) return;
    var ITEMS = [
      { name: '条目 · 按钮按压物理', tag: '展厅 A' },
      { name: '条目 · 弹簧调参器', tag: '展厅 H' },
      { name: '条目 · 面包屑折叠', tag: '展厅 E' }
    ];
    var pending = null, commitTimer = null, tickTimer = null;
    function render() {
      list.innerHTML = '';
      ITEMS.forEach(function (item, i) {
        if (item.removed && !item.undoing) return;
        var li = d.createElement('li');
        li.className = 'fp-undo__item';
        li.tabIndex = 0;
        li.dataset.index = String(i);
        var span = d.createElement('span');
        span.textContent = item.name;
        var tag = d.createElement('span');
        tag.className = 'fp-undo__tag';
        tag.textContent = item.tag;
        var btn = d.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--ghost btn--icon';
        btn.setAttribute('aria-label', '删除 ' + item.name);
        btn.appendChild(icon('trash', 16));
        ML.on(btn, 'click', function () { remove(i); });
        ML.on(li, 'keydown', function (ev) {
          if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); remove(i); }
        });
        li.appendChild(span); li.appendChild(tag); li.appendChild(btn);
        list.appendChild(li);
      });
      var alive = ITEMS.filter(function (it) { return !it.removed || it.undoing; }).length;
      if (!alive) {
        var empty = d.createElement('p');
        empty.className = 'fp-empty mono';
        empty.textContent = '列表已空 · 全部条目已删除（撤销窗口已过期）';
        list.appendChild(empty);
      }
      setText(status, alive + ' 个条目 · 删除后 5 秒内可撤销');
    }
    function clearTimers() {
      if (commitTimer) { window.clearTimeout(commitTimer); commitTimer = null; }
      if (tickTimer) { window.clearInterval(tickTimer); tickTimer = null; }
    }
    function remove(i) {
      var item = ITEMS[i];
      if (!item || item.removed) return;
      if (pending !== null && pending !== i) commit(pending);
      item.removed = true;
      pending = i;
      render();
      bar.hidden = false;
      setText(barText, '已删除「' + item.name + '」· 5 秒内可撤销');
      if (fill) {
        fill.style.transition = 'none';
        fill.style.transform = 'scaleX(1)';
        void fill.offsetWidth;
        fill.style.transition = reduced() ? 'none' : 'transform 5000ms linear';
        fill.style.transform = 'scaleX(0)';
      }
      clearTimers();
      if (reduced() && status) {
        var left = 5;
        tickTimer = window.setInterval(function () {
          left--;
          setText(barText, '已删除「' + item.name + '」· 剩余 ' + Math.max(0, left) + ' 秒（降级：文字倒计时）');
          if (left <= 0) { window.clearInterval(tickTimer); tickTimer = null; }
        }, 1000);
      }
      commitTimer = window.setTimeout(function () { commit(i); }, 5000);
      var u = q('.btn', bar);
      if (u) u.focus();
      setText(status, '已删除「' + item.name + '」· 数据仍保留在内存中，超时或删除下一条才会真正生效');
    }
    function commit(i) {
      var item = ITEMS[i];
      if (!item) return;
      clearTimers();
      item.undoing = false;
      pending = null;
      bar.hidden = true;
      render();
      setText(status, '「' + item.name + '」的撤销窗口已关闭 · 现在真正移除了');
    }
    if (undoBtn) ML.on(undoBtn, 'click', function () {
      if (pending === null) return;
      var item = ITEMS[pending];
      item.removed = false;
      item.undoing = true;
      clearTimers();
      pending = null;
      bar.hidden = true;
      render();
      setText(status, '已撤销删除：「' + item.name + '」回到列表中（位置保持不变）');
      var restored = q('[data-index="' + ITEMS.indexOf(item) + '"]', list);
      if (restored) restored.focus();
      item.undoing = false;
    });
    render();
    bar.hidden = true;
  }

  function boot() {
    if (!window.ML) return;
    hydrateIcons(d);
    [bootFloat, bootHints, bootReadonly, bootFieldset, bootAutofill, bootInline, bootSummary, bootFirstError,
      bootPassword, bootMultistep, bootDraft, bootSubmit, bootTimeout, bootConfirm, bootUndo]
      .forEach(function (fn) { try { fn(); } catch (err) { /* 单个 demo 失败不阻塞其它 */ } });
  }

  d.addEventListener('ml:ready', boot, { once: true });
})();
