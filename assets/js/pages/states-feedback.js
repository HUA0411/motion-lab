/* ============================================================================
   展厅 B · 状态与反馈 —— 页面脚本
   只使用 CONTRACT.md §3 的 ML.* API；无网络请求；无 console 输出。
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

  /* 把用户所处状态写回 localStorage —— inline.js 会在下次首帧前恢复，避免闪跳 */
  function persist(patch) {
    try {
      var cur = {};
      var raw = window.localStorage.getItem('ml-sf-state');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') cur = parsed;
      }
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
      }
      window.localStorage.setItem('ml-sf-state', JSON.stringify(cur));
    } catch (err) {
      /* 存储不可用：忽略，不影响交互 */
    }
  }

  function initialAttr(name) {
    return document.documentElement.getAttribute(name);
  }

  /* ==========================================================================
     01 骨架屏：形状匹配
     ========================================================================== */
  function initSkeleton() {
    var root = ML.q('[data-sf-skel]');
    if (!root) return;
    var card = ML.q('[data-sf-skel-card]', root);
    var real = ML.q('[data-sf-skel-real]', root);
    var body = ML.q('.sf-skel__body', root);
    if (!card || !real || !body) return;
    var para = ML.q('.sf-real__p', real);
    var runBtn = ML.q('[data-sf-skel-run]');
    var modeBtn = ML.q('[data-sf-skel-mode]');
    var h1Out = ML.q('[data-sf-skel-h1]');
    var h2Out = ML.q('[data-sf-skel-h2]');
    var dOut = ML.q('[data-sf-skel-delta]');
    var judge = ML.q('[data-sf-skel-judge]');

    var rowH = 26.4;
    var skelH = 0;
    var lines = 3;
    var busy = false;
    var busyTimer = null;

    /* 用 Range 数出真实段落的行盒数量，骨架行数照着它生成 */
    function measureLines() {
      var lh = para ? parseFloat(window.getComputedStyle(para).lineHeight) : NaN;
      if (!isFinite(lh) || lh <= 0) lh = 26.4;
      rowH = lh;
      var count = 0;
      if (para) {
        try {
          var range = document.createRange();
          range.selectNodeContents(para);
          var rects = range.getClientRects();
          count = rects && rects.length ? rects.length : 0;
        } catch (err) {
          count = 0;
        }
        if (!count) {
          var h = para.getBoundingClientRect().height;
          count = Math.max(1, Math.round(h / lh));
        }
      }
      if (!count) count = 3;
      return Math.max(1, Math.min(12, count));
    }

    function buildRows(n) {
      body.textContent = '';
      body.style.setProperty('--sf-row-h', rowH.toFixed(2) + 'px');
      for (var i = 0; i < n; i++) {
        var s = document.createElement('span');
        s.className = 'sf-skel__line skeleton';
        body.appendChild(s);
      }
    }

    function showSkeleton() {
      real.setAttribute('hidden', '');
      card.removeAttribute('hidden');
      skelH = card.getBoundingClientRect().height;
      text(h1Out, skelH.toFixed(1));
    }

    function showReal() {
      card.setAttribute('hidden', '');
      real.removeAttribute('hidden');
      var h = real.getBoundingClientRect().height;
      text(h2Out, h.toFixed(1));
      var delta = Math.abs(h - skelH);
      text(dOut, delta.toFixed(1));
      var good = delta <= 1.5;
      if (judge) {
        judge.setAttribute('data-verdict', good ? 'good' : 'bad');
        judge.textContent = good
          ? '布局位移 ' + delta.toFixed(1) + ' px —— 骨架行数与内容一致，切换瞬间没有任何跳动。'
          : '布局位移 ' + delta.toFixed(1) + ' px —— 骨架形状与内容不符，切换时下面的内容会被顶下去。';
      }
    }

    function load() {
      if (busy) return;
      busy = true;
      if (runBtn) runBtn.disabled = true;
      if (dOut) dOut.textContent = '—';
      if (judge) {
        judge.removeAttribute('data-verdict');
        judge.textContent = '加载中：1600ms 后替换为真实内容并重新测量。';
      }
      showSkeleton();
      window.clearTimeout(busyTimer);
      busyTimer = window.setTimeout(function () {
        showReal();
        busy = false;
        if (runBtn) runBtn.disabled = false;
      }, 1600);
    }

    /* 首屏测量：把真实内容临时脱离文档流并隐藏，只用来量尺寸 */
    function remeasure() {
      var wasHidden = real.hasAttribute('hidden');
      if (wasHidden) real.removeAttribute('hidden');
      real.style.position = 'absolute';
      real.style.left = '0';
      real.style.right = '0';
      real.style.visibility = 'hidden';
      lines = measureLines();
      real.style.position = '';
      real.style.left = '';
      real.style.right = '';
      real.style.visibility = '';
      if (wasHidden) real.setAttribute('hidden', '');
      if (!wasHidden) real.removeAttribute('hidden');
      buildRows(lines);
    }

    remeasure();
    card.setAttribute('hidden', '');
    showSkeleton();

    if (runBtn) ML.on(runBtn, 'click', load);
    if (modeBtn) {
      ML.on(modeBtn, 'click', function () {
        var bad = root.getAttribute('data-mode') === 'mismatch';
        root.setAttribute('data-mode', bad ? 'match' : 'mismatch');
        modeBtn.setAttribute('aria-pressed', bad ? 'false' : 'true');
        modeBtn.textContent = bad ? '形状错配（反例）' : '切回形状匹配';
        load();
      });
    }
    ML.on(window, 'resize', function () {
      if (busy) return;
      remeasure();
      showSkeleton();
    });
  }

  /* ==========================================================================
     02 加载进度（确定 + 不确定）
     ========================================================================== */
  function initProgress() {
    var wrap = ML.q('[data-sf-prog]');
    var fill = ML.q('[data-sf-prog-fill]');
    var indetBox = ML.q('[data-sf-indet]');
    var steps = ML.qa('.sf-steps__item', ML.q('[data-sf-steps]'));
    if (!wrap && !indetBox) return;

    var valOut = ML.q('[data-sf-prog-val]');
    var elOut = ML.q('[data-sf-prog-el]');
    var etaOut = ML.q('[data-sf-prog-eta]');
    var stepOut = ML.q('[data-sf-prog-step]');
    var stateOut = ML.q('[data-sf-prog-state]');
    var startBtn = ML.q('[data-sf-prog-start]');
    var pauseBtn = ML.q('[data-sf-prog-pause]');
    var resetBtn = ML.q('[data-sf-prog-reset]');
    var indetBtn = ML.q('[data-sf-prog-indet]');

    var TOTAL = 3.2;
    var p = 0;
    var elapsed = 0;
    var running = false;
    var cancel = null;

    function paintSteps() {
      var idx = p >= 1 ? 4 : Math.min(3, Math.floor(p * 4));
      steps.forEach(function (it, i) {
        it.classList.toggle('is-done', i < idx);
        it.classList.toggle('is-active', i === idx && p > 0 && p < 1);
      });
      text(stepOut, Math.min(4, idx + 1) + ' / 4');
    }

    function paint() {
      var pct = Math.round(p * 100);
      if (fill) fill.style.setProperty('--progress', p.toFixed(4));
      if (wrap) {
        wrap.setAttribute('aria-valuenow', String(pct));
        wrap.setAttribute('aria-valuetext', pct + '%');
      }
      text(valOut, pct + '%');
      text(elOut, elapsed.toFixed(1));
      text(etaOut, p >= 1 ? '0.0' : Math.max(0, TOTAL - elapsed).toFixed(1));
      paintSteps();
    }

    function stop() {
      running = false;
      if (cancel) { cancel(); cancel = null; }
    }

    function setState(s) {
      text(stateOut, s);
      if (startBtn) { startBtn.disabled = s === 'running'; startBtn.textContent = s === 'paused' ? '继续导出' : '开始导出'; }
      if (pauseBtn) pauseBtn.disabled = (s === 'idle' || s === 'done');
    }

    function run() {
      if (running || p >= 1) return;
      running = true;
      setState('running');
      cancel = ML.schedule(
        function (dt) {
          if (!running) return false;
          elapsed += dt;
          p = ML.clamp(elapsed / TOTAL, 0, 1);
          paint();
          if (p >= 1) {
            running = false;
            setState('done');
            ML.UI.toast({ title: '导出完成', desc: '报表已生成，共 4 个步骤。', variant: 'success', duration: 3000 });
            return false;
          }
          return undefined;
        },
        function () { cancel = null; }
      );
    }

    if (startBtn) ML.on(startBtn, 'click', run);
    if (pauseBtn) {
      ML.on(pauseBtn, 'click', function () {
        if (running) { stop(); setState('paused'); }
        else run();
      });
    }
    if (resetBtn) {
      ML.on(resetBtn, 'click', function () {
        stop();
        p = 0; elapsed = 0;
        paint();
        setState('idle');
      });
    }
    if (indetBtn && indetBox) {
      ML.on(indetBtn, 'click', function () {
        var on = indetBtn.getAttribute('aria-pressed') === 'true';
        indetBtn.setAttribute('aria-pressed', on ? 'false' : 'true');
        indetBox.classList.toggle('is-static', on);
        text(stateOut, on ? 'indeterminate 关闭：改为静态条纹 + 文字说明' : 'indeterminate 开启：扫光循环');
      });
    }

    paint();
    setState('idle');
  }

  /* ==========================================================================
     03 空状态
     ========================================================================== */
  function initEmpty() {
    var empty = ML.q('[data-sf-empty]');
    var list = ML.q('[data-sf-empty-list]');
    if (!empty || !list) return;
    var createBtn = ML.q('[data-sf-empty-create]');
    var moreBtn = ML.q('[data-sf-empty-more]');
    var clearBtn = ML.q('[data-sf-empty-clear]');
    var helpBtn = ML.q('[data-sf-empty-help]');
    var countOut = ML.q('[data-sf-empty-count]');
    var flagOut = ML.q('[data-sf-empty-flag]');

    var NAMES = ['预览环境', '预发环境', '生产环境', '压测环境'];
    var items = [];

    function paint() {
      var has = items.length > 0;
      empty.hidden = has;
      list.hidden = !has;
      text(countOut, String(items.length));
      text(flagOut, has ? '否' : '是');
      if (moreBtn) moreBtn.disabled = items.length >= NAMES.length;
      if (clearBtn) clearBtn.disabled = !has;
    }

    function addOne() {
      if (items.length >= NAMES.length) {
        ML.UI.toast({ title: '演示上限', desc: '这个 demo 最多创建 4 个环境。', variant: 'info', duration: 2600 });
        return;
      }
      var name = NAMES[items.length];
      var li = ML.create('li', { class: 'sf-list__item' });
      li.style.setProperty('--sf-delay', Math.min(items.length, 3) * 45 + 'ms');
      var dot = ML.create('span', { class: 'sf-list__dot' });
      dot.setAttribute('aria-hidden', 'true');
      var label = ML.create('span', { class: 'sf-list__name', text: name });
      var meta = ML.create('span', { class: 'sf-list__meta', text: '刚创建' });
      li.appendChild(dot);
      li.appendChild(label);
      li.appendChild(meta);
      list.appendChild(li);
      items.push(li);
      paint();
    }

    if (createBtn) {
      ML.on(createBtn, 'click', function () {
        addOne();
        addOne();
        addOne();
      });
    }
    if (moreBtn) ML.on(moreBtn, 'click', addOne);
    if (clearBtn) {
      ML.on(clearBtn, 'click', function () {
        items.forEach(function (li) { li.remove(); });
        items = [];
        paint();
      });
    }
    if (helpBtn) {
      ML.on(helpBtn, 'click', function () {
        ML.UI.toast({
          title: '别人通常这样用',
          desc: '预览环境接测试数据、预发接影子流量、生产只读。命名建议带上区域后缀。',
          variant: 'info',
          duration: 5200
        });
      });
    }

    paint();
  }

  /* ==========================================================================
     04 错误态
     ========================================================================== */
  function initError() {
    var alertBox = ML.q('[data-sf-err-alert]');
    if (!alertBox) return;
    var iconHost = ML.q('[data-sf-err-icon]', alertBox);
    var titleEl = ML.q('[data-sf-err-title]');
    var bodyEl = ML.q('[data-sf-err-body]');
    var input = ML.q('[data-sf-err-input]');
    var fieldMsg = ML.q('[data-sf-err-field]');
    var retryBtn = ML.q('[data-sf-err-retry]');
    var stepsBtn = ML.q('[data-sf-err-steps]');
    var stepsPanel = ML.q('#sf-err-steps');
    var kindBtn = ML.q('[data-sf-err-kind]');
    var attemptsOut = ML.q('[data-sf-err-attempts]');
    var stateOut = ML.q('[data-sf-err-state]');
    var idOut = ML.q('[data-sf-err-id]');

    var KINDS = [
      {
        name: 'network',
        title: '无法连接到保存服务',
        body: '请求在 12ms 内被拒绝。可能是代理拦截，或服务正在滚动重启。',
        field: '名称只能包含小写字母、数字与连字符，例如 atlas-finance。',
        icon: 'alert',
        variant: 'danger'
      },
      {
        name: 'validation',
        title: '有 1 个字段需要修正',
        body: '服务端校验未通过，已定位到具体字段。修正后可以立即重试。',
        field: '名称包含空格与大写字母，请改为 atlas-finance。',
        icon: 'warning',
        variant: 'warning'
      },
      {
        name: 'server',
        title: '服务端错误 500',
        body: '保存服务返回 500。这不是你的操作问题，重试通常能成功。',
        field: '当前值本身可以提交，错误来自服务端。',
        icon: 'x-circle',
        variant: 'danger'
      }
    ];

    var kindIndex = 0;
    var attempts = 0;
    var succeeded = false;
    var busy = false;

    if (fieldMsg && !fieldMsg.id) fieldMsg.id = 'sf-err-field-msg';
    if (input && fieldMsg) input.setAttribute('aria-describedby', fieldMsg.id);

    function paintKind() {
      var k = KINDS[kindIndex];
      if (iconHost) {
        iconHost.textContent = '';
        iconHost.appendChild(ML.UI.icon(k.icon, { size: 20 }));
      }
      text(titleEl, k.title);
      text(bodyEl, k.body);
      text(fieldMsg, k.field);
      alertBox.setAttribute('data-kind', k.name);
      alertBox.setAttribute('data-variant', k.variant);
      if (input) {
        if (k.name === 'validation') input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }

    function paintState() {
      text(attemptsOut, String(attempts));
      text(stateOut, succeeded ? 'saved' : (busy ? 'retrying' : 'error'));
    }

    function succeed() {
      succeeded = true;
      busy = false;
      alertBox.setAttribute('data-variant', 'success');
      if (iconHost) {
        iconHost.textContent = '';
        iconHost.appendChild(ML.UI.icon('check-circle', { size: 20 }));
      }
      text(titleEl, '保存成功');
      text(bodyEl, '工作区「atlas-finance」已保存，第 ' + attempts + ' 次尝试成功。');
      if (fieldMsg) fieldMsg.hidden = true;
      if (input) input.removeAttribute('aria-invalid');
      if (retryBtn) { retryBtn.disabled = true; retryBtn.textContent = '已保存'; }
      paintState();
      ML.UI.toast({ title: '保存成功', desc: '第 ' + attempts + ' 次尝试成功。', variant: 'success', duration: 3200 });
    }

    function retry() {
      if (busy || succeeded) return;
      busy = true;
      attempts++;
      paintState();
      if (idOut) idOut.textContent = 'req_' + (1000 + attempts * 137);
      text(stateOut, 'retrying');
      /* 第 1 次仍失败，第 2 次成功 —— 刻意让“重试”不总是立刻好 */
      window.setTimeout(function () {
        busy = false;
        if (attempts >= 2) succeed();
        else paintState();
      }, 700);
    }

    if (retryBtn) ML.on(retryBtn, 'click', retry);

    if (stepsBtn && stepsPanel) {
      ML.on(stepsBtn, 'click', function () {
        var open = stepsBtn.getAttribute('aria-expanded') === 'true';
        stepsBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (open) stepsPanel.setAttribute('hidden', '');
        else stepsPanel.removeAttribute('hidden');
      });
    }

    if (kindBtn) {
      ML.on(kindBtn, 'click', function () {
        if (succeeded) {
          succeeded = false;
          if (retryBtn) { retryBtn.disabled = false; retryBtn.textContent = '重试保存'; }
          if (fieldMsg) fieldMsg.hidden = false;
        }
        kindIndex = (kindIndex + 1) % KINDS.length;
        paintKind();
        paintState();
      });
    }

    if (input) {
      ML.on(input, 'input', function () {
        if (!input.value || input.value.indexOf(' ') >= 0) return;
        if (fieldMsg) fieldMsg.hidden = true;
        input.removeAttribute('aria-invalid');
      });
    }

    paintKind();
    paintState();
  }

  /* ==========================================================================
     05 超时态
     ========================================================================== */
  function initTimeout() {
    var fill = ML.q('[data-sf-to-fill]');
    var stateBox = ML.q('[data-sf-to-state]');
    if (!stateBox) return;
    var elOut = ML.q('[data-sf-to-el]');
    var outOut = ML.q('[data-sf-to-out]');
    var capOut = ML.q('[data-sf-to-cap]');
    var mockOut = ML.q('[data-sf-to-mock]');
    var runBtn = ML.q('[data-sf-to-run]');
    var cancelBtn = ML.q('[data-sf-to-cancel]');
    var fastBtn = ML.q('[data-sf-to-fast]');

    var LIMIT = 3000;
    var mockMs = 4000;
    var elapsed = 0;
    var running = false;
    var timedOut = false;
    var cancelRaf = null;
    var mockTimer = null;

    function setState(msg, variant) {
      stateBox.textContent = msg;
      if (variant) stateBox.setAttribute('data-variant', variant);
      else stateBox.removeAttribute('data-variant');
    }

    function paint() {
      var pct = Math.min(1, elapsed / LIMIT);
      if (fill) fill.style.setProperty('--progress', pct.toFixed(4));
      text(elOut, (elapsed / 1000).toFixed(1));
    }

    function clearTimers() {
      if (cancelRaf) { cancelRaf(); cancelRaf = null; }
      window.clearTimeout(mockTimer);
      mockTimer = null;
    }

    function settle(message, variant, result) {
      running = false;
      clearTimers();
      setState(message, variant);
      text(outOut, result);
      if (cancelBtn) cancelBtn.disabled = true;
      if (fastBtn) fastBtn.disabled = false;
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = '再发起一次慢请求'; }
    }

    function start(ms) {
      clearTimers();
      mockMs = ms;
      elapsed = 0;
      running = true;
      paint();
      text(outOut, '—');
      text(mockOut, (ms / 1000).toFixed(1));
      setState('requesting · 已发出请求，等待响应…', 'warning');
      if (cancelBtn) cancelBtn.disabled = false;
      if (runBtn) runBtn.disabled = true;
      if (fastBtn) fastBtn.disabled = true;

      /* 超时判定写在任务内部、结算放在 onDone —— 避免在 tick 迭代中取消自身 */
      cancelRaf = ML.schedule(
        function (dt) {
          if (!running) return false;
          elapsed += dt * 1000;
          paint();
          if (elapsed >= LIMIT) {
            timedOut = true;
            return false;
          }
          return undefined;
        },
        function () {
          cancelRaf = null;
          if (!timedOut) return;
          timedOut = false;
          settle('timeout · 已等待 ' + (LIMIT / 1000).toFixed(1) + ' s，达到上限并主动中止。数据未保存。', 'danger', '超时中止');
        }
      );

      mockTimer = window.setTimeout(function () {
        if (!running) return;
        settle('success · 服务端在 ' + (ms / 1000).toFixed(1) + ' s 内返回，赶在超时之前。', 'success', '成功');
      }, ms);
    }

    if (runBtn) ML.on(runBtn, 'click', function () { start(4000); });
    if (fastBtn) ML.on(fastBtn, 'click', function () { start(600); });
    if (cancelBtn) {
      ML.on(cancelBtn, 'click', function () {
        if (!running) return;
        var waited = (elapsed / 1000).toFixed(1);
        settle('cancelled · 你在 ' + waited + ' s 时主动取消，已释放连接。', 'warning', '已取消');
      });
    }

    text(capOut, (LIMIT / 1000).toFixed(1));
    text(mockOut, (mockMs / 1000).toFixed(1));
    setState('idle · 尚未发起');
  }

  /* ==========================================================================
     06 离线态
     ========================================================================== */
  function initOffline() {
    var root = ML.q('[data-sf-offline]');
    var outbox = ML.q('[data-sf-outbox]');
    if (!root || !outbox) return;
    var banner = ML.q('[data-sf-offline-banner]');
    var bannerText = ML.q('[data-sf-offline-text]');
    var modeOut = ML.q('[data-sf-offline-mode]');
    var nativeOut = ML.q('[data-sf-offline-native]');
    var toggle = ML.q('[data-sf-offline-toggle]');
    var addBtn = ML.q('[data-sf-offline-add]');
    var flushBtn = ML.q('[data-sf-offline-flush]');
    var pendingOut = ML.q('[data-sf-offline-pending]');
    var syncedOut = ML.q('[data-sf-offline-synced]');

    var forced = initialAttr('data-sf-offline') === 'on';
    var pending = 0;
    var syncedCount = 0;
    var seq = 0;
    var flushing = false;
    var emptyHint = ML.create('li', { class: 'sf-outbox__empty', text: '队列为空：联网状态下改动会直接同步。' });
    outbox.appendChild(emptyHint);

    function offline() {
      if (forced) return true;
      return navigator.onLine === false;
    }

    function paint() {
      var off = offline();
      if (banner) {
        if (off) banner.removeAttribute('hidden');
        else banner.setAttribute('hidden', '');
      }
      if (bannerText) {
        bannerText.textContent = off
          ? '离线中（' + (forced ? '手动模拟' : '浏览器上报') + '）：改动会先存在本地，联网后自动同步。'
          : '';
      }
      text(modeOut, off ? '离线' : '在线');
      text(nativeOut, navigator.onLine === false ? 'offline' : 'online');
      text(pendingOut, String(pending));
      text(syncedOut, String(syncedCount));
      if (toggle) toggle.setAttribute('aria-pressed', forced ? 'true' : 'false');
      if (toggle) toggle.textContent = forced ? '恢复联网' : '模拟离线';
      if (flushBtn) flushBtn.disabled = off || pending === 0 || flushing;
      if (emptyHint) {
        if (outbox.children.length === 0) outbox.appendChild(emptyHint);
        else if (emptyHint.parentNode) emptyHint.remove();
      }
    }

    function addItem() {
      seq++;
      var off = offline();
      var li = ML.create('li', { class: 'sf-outbox__item' });
      li.setAttribute('data-state', off ? 'pending' : 'synced');
      var label = ML.create('span', { text: '改动 #' + seq + ' · 调整了卡片间距' });
      var tag = ML.create('span', { class: 'sf-outbox__tag', text: off ? '待同步' : '已同步' });
      li.appendChild(label);
      li.appendChild(tag);
      outbox.appendChild(li);
      if (off) pending++;
      else syncedCount++;
      paint();
    }

    function flush() {
      if (offline() || flushing || pending === 0) return;
      flushing = true;
      var items = ML.qa('.sf-outbox__item[data-state="pending"]', outbox);
      items.forEach(function (li, i) {
        window.setTimeout(function () {
          li.setAttribute('data-state', 'synced');
          var tag = ML.q('.sf-outbox__tag', li);
          text(tag, '已同步');
          pending = Math.max(0, pending - 1);
          syncedCount++;
          paint();
          if (i === items.length - 1) {
            flushing = false;
            paint();
            ML.UI.toast({ title: '同步完成', desc: '本地的 ' + items.length + ' 条改动已推送到服务端。', variant: 'success', duration: 3000 });
          }
        }, i * 220);
      });
    }

    if (toggle) {
      ML.on(toggle, 'click', function () {
        forced = !forced;
        persist({ offline: forced });
        paint();
        if (!offline()) flush();
        else ML.UI.toast({ title: '已切到离线', desc: '接下来的改动会进入待同步队列。', variant: 'warning', duration: 2600 });
      });
    }
    if (addBtn) ML.on(addBtn, 'click', addItem);
    if (flushBtn) ML.on(flushBtn, 'click', flush);

    ML.on(window, 'online', function () { paint(); flush(); });
    ML.on(window, 'offline', function () {
      paint();
      ML.UI.toast({ title: '网络已断开', desc: '改动先存在本地。', variant: 'warning', duration: 2600 });
    });

    paint();
  }

  /* ==========================================================================
     07 乐观更新（失败自动回滚）
     ========================================================================== */
  function initOptimistic() {
    var input = ML.q('[data-sf-opt-input]');
    var sendBtn = ML.q('[data-sf-opt-send]');
    if (!sendBtn) return;
    var outcomeBtn = ML.q('[data-sf-opt-outcome]');
    var feed = ML.q('[data-sf-opt-feed]');
    var pendingOut = ML.q('[data-sf-opt-pending]');
    var okOut = ML.q('[data-sf-opt-ok]');
    var rolledOut = ML.q('[data-sf-opt-rolled]');

    var failNext = false;
    var pending = 0;
    var ok = 0;
    var rolled = 0;
    var busy = false;
    var emptyHint = ML.create('li', { class: 'sf-feed__empty', text: '还没有评论。发送后条目会先以「同步中」出现。' });
    if (feed) feed.appendChild(emptyHint);

    function paint() {
      text(pendingOut, String(pending));
      text(okOut, String(ok));
      text(rolledOut, String(rolled));
      if (feed && emptyHint) {
        if (feed.querySelectorAll('.sf-feed__item').length === 0) {
          if (!emptyHint.parentNode) feed.appendChild(emptyHint);
        } else if (emptyHint.parentNode) {
          emptyHint.remove();
        }
      }
    }

    function send() {
      if (!input || !feed) return;
      var value = (input.value || '').trim();
      if (!value) {
        ML.UI.toast({ title: '内容为空', desc: '先写一句评论再发送。', variant: 'warning', duration: 2400 });
        return;
      }
      if (busy) return;
      busy = true;
      var willFail = failNext;
      failNext = false;
      if (outcomeBtn) {
        outcomeBtn.setAttribute('aria-pressed', 'false');
        outcomeBtn.textContent = '下一次服务端结果：失败';
      }

      var li = ML.create('li', { class: 'sf-feed__item' });
      li.setAttribute('data-state', 'pending');
      var p = ML.create('p', { class: 'sf-feed__text', text: value });
      var metaRow = ML.create('p', { class: 'sf-feed__meta' });
      var stateSpan = ML.create('span', { class: 'sf-feed__state', text: '同步中…' });
      var timeSpan = ML.create('span', { text: '刚刚' });
      metaRow.appendChild(stateSpan);
      metaRow.appendChild(timeSpan);
      li.appendChild(p);
      li.appendChild(metaRow);
      feed.appendChild(li);
      pending++;
      paint();
      input.value = '';

      window.setTimeout(function () {
        if (willFail) {
          li.setAttribute('data-state', 'rolled');
          text(stateSpan, '已回滚');
          li.classList.add('is-out');
          window.setTimeout(function () {
            li.remove();
            pending = Math.max(0, pending - 1);
            rolled++;
            paint();
            input.value = value; /* 草稿原样归还，用户不必重打 */
            ML.UI.toast({
              title: '发送失败，已回滚',
              desc: '服务端拒绝了这条评论。内容已放回输入框，改完可以直接重发。',
              variant: 'danger',
              duration: 4800
            });
          }, soft() ? 0 : 170);
        } else {
          li.setAttribute('data-state', 'ok');
          text(stateSpan, '已同步');
          pending = Math.max(0, pending - 1);
          ok++;
          paint();
        }
        busy = false;
      }, 900);
    }

    ML.on(sendBtn, 'click', send);
    ML.on(window, 'keydown', function (e) {
      if (e.key === 'Enter' && document.activeElement === input) send();
    });

    if (outcomeBtn) {
      ML.on(outcomeBtn, 'click', function () {
        failNext = !failNext;
        outcomeBtn.setAttribute('aria-pressed', failNext ? 'true' : 'false');
        outcomeBtn.textContent = failNext ? '下一次服务端结果：失败（已就绪）' : '下一次服务端结果：失败';
      });
    }

    paint();
  }

  /* ==========================================================================
     08 指数退避重试
     ========================================================================== */
  function initBackoff() {
    var bar = ML.q('[data-sf-bo-bar]');
    var logEl = ML.q('[data-sf-bo-log]');
    if (!bar || !logEl) return;
    var cdOut = ML.q('[data-sf-bo-cd]');
    var nOut = ML.q('[data-sf-bo-n]');
    var waitOut = ML.q('[data-sf-bo-wait]');
    var stateOut = ML.q('[data-sf-bo-state]');
    var runBtn = ML.q('[data-sf-bo-run]');
    var nowBtn = ML.q('[data-sf-bo-now]');
    var abortBtn = ML.q('[data-sf-bo-abort]');

    var BASE = 500;
    var CAP = 8000;
    var JITTER = 0.2;
    var MAX_ATTEMPTS = 6;
    var CIRC = 251.33;

    var n = 0;
    var stopped = true;
    var waiting = false;
    var due = false;
    var waitMs = 0;
    var remain = 0;
    var cancelRaf = null;

    function setState(s) { text(stateOut, s); }
    function paintRing(t) {
      bar.style.setProperty('--sf-bo', ML.clamp(t, 0, 1).toFixed(4));
    }
    function log(msg, tone) {
      var li = document.createElement('li');
      li.textContent = msg;
      if (tone) li.setAttribute('data-tone', tone);
      logEl.appendChild(li);
      while (logEl.children.length > 6) logEl.removeChild(logEl.firstChild);
    }
    function buttons(active) {
      if (runBtn) runBtn.disabled = active;
      if (nowBtn) nowBtn.disabled = !active;
      if (abortBtn) abortBtn.disabled = !active;
    }

    function clearTimers() {
      if (cancelRaf) { cancelRaf(); cancelRaf = null; }
      waiting = false;
    }

    function finish(ok) {
      clearTimers();
      stopped = true;
      buttons(false);
      if (ok) {
        setState('success');
        text(cdOut, '✓');
        paintRing(1);
        log('第 ' + n + ' 次请求成功 · 共等待 ' + '若干' + 'ms', 'success');
        ML.UI.toast({ title: '重试成功', desc: '第 ' + n + ' 次尝试终于拿到 200。', variant: 'success', duration: 3200 });
      } else {
        setState('aborted');
        text(cdOut, '—');
        paintRing(0);
        log('已放弃重试', 'warn');
      }
    }

    function afterFail() {
      if (stopped) return;
      if (n >= MAX_ATTEMPTS) { finish(true); return; }
      var base = Math.min(CAP, BASE * Math.pow(2, n - 1));
      var jitter = base * JITTER * (Math.random() * 2 - 1);
      waitMs = Math.max(120, Math.round(base + jitter));
      remain = waitMs;
      waiting = true;
      setState('waiting');
      text(waitOut, String(waitMs));
      log('第 ' + n + ' 次失败 · ' + (base >= CAP ? 'min(cap, …) = ' + CAP : 'base×2^' + (n - 1) + ' = ' + base) +
        ' + 抖动 → 等待 ' + waitMs + 'ms', 'warn');
      paintRing(1);
      cancelRaf = ML.schedule(
        function (dt) {
          if (!waiting || stopped) return false;
          remain -= dt * 1000;
          paintRing(remain / waitMs);
          text(cdOut, Math.max(0, remain / 1000).toFixed(1) + 's');
          if (remain <= 0) {
            waiting = false;
            due = true;
            return false;
          }
          return undefined;
        },
        function () {
          cancelRaf = null;
          if (!due) return;
          due = false;
          if (!stopped) request();
        }
      );
    }

    function request() {
      if (stopped) return;
      n++;
      text(nOut, String(n));
      setState('requesting');
      text(waitOut, '—');
      text(cdOut, '···');
      window.setTimeout(function () {
        if (stopped) return;
        afterFail();
      }, 420);
    }

    function start() {
      clearTimers();
      logEl.textContent = '';
      n = 0;
      stopped = false;
      buttons(true);
      setState('requesting');
      log('开始：base ' + BASE + 'ms · cap ' + CAP + 'ms · jitter ±' + (JITTER * 100) + '% · 最多 ' + MAX_ATTEMPTS + ' 次');
      request();
    }

    if (runBtn) ML.on(runBtn, 'click', start);
    if (abortBtn) ML.on(abortBtn, 'click', function () { finish(false); });
    if (nowBtn) {
      ML.on(nowBtn, 'click', function () {
        if (stopped || !waiting) return;
        remain = 0;
        waiting = false;
        log('手动跳过等待，直接重试');
        request();
      });
    }

    paintRing(0);
    setState('idle');
  }

  /* ==========================================================================
     09 禁用态
     ========================================================================== */
  function initDisabled() {
    var ack = ML.q('[data-sf-dis-ack]');
    var submit = ML.q('[data-sf-dis-submit]');
    if (!ack || !submit) return;
    var ariabtn = ML.q('[data-sf-dis-aria]');
    var why = ML.q('[data-sf-dis-why]');
    var stateOut = ML.q('[data-sf-dis-state]');
    var focusOut = ML.q('[data-sf-dis-focus]');
    var hitsOut = ML.q('[data-sf-dis-hits]');
    var hits = 0;

    function paint() {
      var allowed = ack.checked;
      submit.disabled = !allowed;
      text(stateOut, allowed ? 'false' : 'true');
      if (why) {
        why.textContent = allowed
          ? '条件已满足，按钮已启用。若之后取消勾选，按钮会立刻回到禁用并保留同样的说明。'
          : '需要先勾选条款。原因写在界面上，而不是只藏在 tooltip 里。';
      }
    }

    ML.on(ack, 'change', paint);

    ML.on(submit, 'click', function () {
      ML.UI.toast({ title: '开始发布', desc: '前置条件已满足，发布任务已创建。', variant: 'success', duration: 2800 });
    });

    if (ariabtn) {
      ML.on(ariabtn, 'click', function () {
        hits++;
        text(hitsOut, String(hits));
        ML.UI.toast({
          title: '草稿暂不能保存',
          desc: '同样的前置条件未满足，但这个按钮保留了可聚焦能力，所以读屏用户能听到原因。',
          variant: 'warning',
          duration: 4200
        });
      });
      ML.on(ariabtn, 'focus', function () { text(focusOut, '是（aria-disabled 可聚焦）'); });
      ML.on(ariabtn, 'blur', function () { text(focusOut, '否'); });
    }

    paint();
  }

  /* ==========================================================================
     10 只读 vs 禁用
     ========================================================================== */
  function initReadonlyDisabled() {
    var form = ML.q('[data-sf-ro-form]');
    var out = ML.q('[data-sf-ro-out]');
    var copyBtn = ML.q('[data-sf-ro-copy]');
    if (!form || !out) return;

    ML.on(form, 'submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var lines = [];
      lines.push('FormData 实际收到的字段：');
      fd.forEach(function (v, k) { lines.push('  ' + k + ' = ' + v); });
      if (!fd.has('disabled_sku')) lines.push('  （disabled_sku 未出现：禁用的控件被浏览器丢弃）');
      out.textContent = lines.join('\n');
    });

    if (copyBtn) {
      ML.on(copyBtn, 'click', function () {
        var a = ML.q('#sf-ro-1');
        var b = ML.q('#sf-ro-2');
        out.textContent = [
          '脚本读取（DOM 永远能拿到值）：',
          '  readonly.value = ' + (a ? a.value : '—'),
          '  disabled.value = ' + (b ? b.value : '—'),
          '结论：值可读 ≠ 值会提交。disabled 只影响表单序列化与可聚焦性，不影响 DOM。'
        ].join('\n');
      });
    }
  }

  /* ==========================================================================
     11 无权限态
     ========================================================================== */
  function initPermission() {
    var root = ML.q('[data-sf-perm]');
    if (!root) return;
    var titleEl = ML.q('[data-sf-perm-title]');
    var descEl = ML.q('[data-sf-perm-desc]');
    var applyBtn = ML.q('[data-sf-perm-apply]');
    var switchBtn = ML.q('[data-sf-perm-switch]');
    var backBtn = ML.q('[data-sf-perm-back]');
    var reasonInput = ML.q('[data-sf-perm-reason]');
    var granted = ML.q('[data-sf-perm-granted]');
    var stateOut = ML.q('[data-sf-perm-state]');
    var logOut = ML.q('[data-sf-perm-log]');

    var level = 'locked';

    function paint(next) {
      level = next;
      root.setAttribute('data-level', level);
      text(stateOut, level);
      persist({ perm: level });
      if (granted) {
        if (level === 'granted') granted.removeAttribute('hidden');
        else granted.setAttribute('hidden', '');
      }
      if (titleEl) {
        titleEl.textContent = level === 'locked'
          ? '你没有查看「项目 Atlas · 财务报表」的权限'
          : '临时权限已生效（24 小时后自动回收）';
      }
      if (descEl) {
        descEl.textContent = level === 'locked'
          ? '这份报表属于「财务」组。你可以申请 24 小时临时权限，或请管理员把项目权限开到你的账号。'
          : '审计日志会记录这次访问。到期后再次访问会回到无权限态，可以重新申请。';
      }
      if (applyBtn) {
        applyBtn.disabled = level !== 'locked';
        applyBtn.textContent = level === 'pending' ? '申请已提交' : '申请权限';
      }
      if (switchBtn) {
        switchBtn.textContent = level === 'granted' ? '退回无权限态' : '以管理员身份查看';
      }
      if (reasonInput) reasonInput.disabled = level !== 'locked';
    }

    if (applyBtn) {
      ML.on(applyBtn, 'click', function () {
        var reason = reasonInput ? (reasonInput.value || '').trim() : '';
        if (!reason) {
          ML.UI.toast({ title: '还差一步', desc: '请填写申请理由，审批人需要它来判断。', variant: 'warning', duration: 3000 });
          if (reasonInput) reasonInput.focus();
          return;
        }
        ML.UI.confirm({
          title: '提交权限申请？',
          desc: '理由：「' + reason + '」。审批通过后你会收到通知，权限维持 24 小时。',
          confirmText: '提交申请'
        }).then(function (ok) {
          if (!ok) return;
          paint('pending');
          text(logOut, '已提交 · 预计 2 小时内审批');
          ML.UI.toast({ title: '申请已提交', desc: '审批人：财务组管理员。', variant: 'success', duration: 3600 });
        });
      });
    }

    if (switchBtn) {
      ML.on(switchBtn, 'click', function () {
        if (level === 'granted') {
          paint('locked');
          return;
        }
        paint('granted');
        text(logOut, '管理员预览 · 已记录审计日志');
      });
    }

    if (backBtn) ML.on(backBtn, 'click', function () { paint('locked'); });

    paint(initialAttr('data-sf-perm') === 'granted' ? 'granted' : 'locked');
    if (level === 'locked') text(logOut, '无');
  }

  /* ==========================================================================
     12 冲突态
     ========================================================================== */
  function initConflict() {
    var host = ML.q('[data-sf-diff]');
    if (!host) return;
    var countOut = ML.q('[data-sf-diff-count]');
    var doneOut = ML.q('[data-sf-diff-done]');
    var stateOut = ML.q('[data-sf-diff-state]');
    var mergeBtn = ML.q('[data-sf-diff-merge]');
    var mineBtn = ML.q('[data-sf-diff-mine]');
    var theirsBtn = ML.q('[data-sf-diff-theirs]');

    var FIELDS = [
      { key: '标题', mine: 'Q3 增长复盘', theirs: 'Q3 增长复盘（终版）' },
      { key: '负责人', mine: '受访者 A', theirs: '项目 Atlas 团队' },
      { key: '截止日', mine: '10-24', theirs: '10-24' },
      { key: '预算', mine: '¥120,000', theirs: '¥96,000' }
    ];

    var choice = {};
    var conflicts = [];
    var rows = [];

    function resolvedCount() {
      var n = 0;
      conflicts.forEach(function (f) { if (choice[f.key]) n++; });
      return n;
    }

    function paint() {
      text(countOut, String(conflicts.length));
      text(doneOut, String(resolvedCount()));
      rows.forEach(function (r) {
        var f = r.field;
        if (r.node) {
          var done = !!choice[f.key];
          r.node.setAttribute('data-resolved', done ? 'true' : 'false');
        }
        r.opts.forEach(function (o) {
          o.setAttribute('aria-pressed', choice[f.key] === o.getAttribute('data-side') ? 'true' : 'false');
        });
      });
    }

    function build() {
      host.textContent = '';
      rows = [];
      FIELDS.forEach(function (f) {
        var diff = f.mine !== f.theirs;
        var row = ML.create('div', { class: 'sf-diff__row' });
        row.setAttribute('data-diff', diff ? 'true' : 'false');
        row.setAttribute('data-resolved', 'false');

        var head = ML.create('div', { class: 'sf-diff__head' });
        head.appendChild(ML.create('span', { class: 'sf-diff__key', text: f.key }));
        head.appendChild(ML.create('span', {
          class: 'sf-diff__flag',
          text: diff ? (choice[f.key] ? '已解决' : '差异') : '两版一致'
        }));
        row.appendChild(head);

        var opts = [];
        if (diff) {
          conflicts.push(f);
          var wrap = ML.create('div', { class: 'sf-diff__opts' });
          [['mine', '我的版本', f.mine], ['theirs', '服务端版本', f.theirs]].forEach(function (pair) {
            var btn = ML.create('button', { class: 'sf-diff__opt' });
            btn.type = 'button';
            btn.setAttribute('data-side', pair[0]);
            btn.setAttribute('aria-pressed', 'false');
            var small = ML.create('small', { text: pair[1] });
            var strong = ML.create('span', { text: pair[2] });
            btn.appendChild(small);
            btn.appendChild(strong);
            ML.on(btn, 'click', function () {
              choice[f.key] = pair[0];
              var flag = ML.q('.sf-diff__flag', row);
              text(flag, '已解决');
              paint();
            });
            wrap.appendChild(btn);
            opts.push(btn);
          });
          row.appendChild(wrap);
        } else {
          row.appendChild(ML.create('p', { class: 'sf-diff__same', text: '两版内容相同：' + f.mine + '（无需处理）' }));
        }

        host.appendChild(row);
        rows.push({ field: f, node: row, opts: opts });
      });
    }

    function chooseAll(side) {
      conflicts.forEach(function (f) { choice[f.key] = side; });
      rows.forEach(function (r) {
        var flag = ML.q('.sf-diff__flag', r.node);
        if (r.field.mine !== r.field.theirs) text(flag, '已解决');
      });
      paint();
      text(stateOut, 'resolved');
    }

    if (mergeBtn) {
      ML.on(mergeBtn, 'click', function () {
        if (resolvedCount() < conflicts.length) {
          var first = null;
          rows.forEach(function (r) {
            if (!first && r.field.mine !== r.field.theirs && !choice[r.field.key]) first = r;
          });
          if (first && first.opts.length) first.opts[0].focus();
          ML.UI.toast({
            title: '还有 ' + (conflicts.length - resolvedCount()) + ' 个字段没选',
            desc: '逐个选择保留哪一版，或直接用「全部保留我的 / 全部采用服务端」。',
            variant: 'warning',
            duration: 4200
          });
          return;
        }
        text(stateOut, 'saved');
        ML.UI.toast({ title: '已合并保存', desc: '解决了 ' + conflicts.length + ' 个字段冲突，版本号 +1。', variant: 'success', duration: 3400 });
      });
    }
    if (mineBtn) ML.on(mineBtn, 'click', function () { chooseAll('mine'); });
    if (theirsBtn) ML.on(theirsBtn, 'click', function () { chooseAll('theirs'); });

    build();
    paint();
    text(stateOut, 'conflict');
  }

  /* ==========================================================================
     boot
     ========================================================================== */
  function boot() {
    if (!window.ML || typeof ML.q !== 'function') return;
    initSkeleton();
    initProgress();
    initEmpty();
    initError();
    initTimeout();
    initOffline();
    initOptimistic();
    initBackoff();
    initDisabled();
    initReadonlyDisabled();
    initPermission();
    initConflict();
  }

  document.addEventListener('ml:ready', boot, { once: true });
})();
