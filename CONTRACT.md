# 共享契约：外壳 DOM · ML 内核 API · 图标集（冻结版 v1.0）

> 页面负责人**必须**只使用本文列出的 API、类名与图标名。内核文件由 Lead 负责，页面不得修改。
> 所有内核元素（`#site-header` / `#site-footer` / `#site-overlays`）留空占位即可，由 `site.js` 注入。

---

## 1. 页面 HTML 骨架（复制即用）

```html
<!DOCTYPE html>
<html lang="zh-CN" data-motion="on" data-theme="dark" data-page="micro-interactions">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>微交互 · MOTION LAB</title>
  <meta name="description" content="一句话说明本展厅内容（50–120 字）。">
  <meta name="theme-color" content="#0A0B0D">
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/motion.css">
  <link rel="stylesheet" href="assets/css/site.css">
  <link rel="stylesheet" href="assets/css/pages/micro-interactions.css">
  <script src="assets/js/motion.js"></script>
  <script src="assets/js/ui.js"></script>
  <script src="assets/js/pages/micro-interactions.inline.js"></script>
</head>
<body>
  <a class="skip-link" href="#main">跳到主内容</a>
  <div id="site-header"></div>

  <main id="main" class="page">
    <!-- 页头：由页面自己写 -->
    <header class="page-head shell">
      <p class="eyebrow">展厅 A · MICRO-INTERACTIONS</p>
      <h1 class="h1">微交互</h1>
      <p class="lede">……导语（1–2 句）……</p>
      <ul class="meta-chips">
        <li class="chip">14 个可交互 demo</li>
        <li class="chip">全部含规格标注</li>
        <li class="chip">支持 reduced-motion</li>
      </ul>
    </header>

    <section class="section shell" id="buttons">
      <div class="section-head">
        <p class="eyebrow">01</p>
        <h2 class="h2">按钮与按压反馈</h2>
        <p class="lede">说明这一段解决什么问题。</p>
      </div>

      <div class="demo-grid">
        <article class="demo reveal">
          <header class="demo__label">
            <span class="demo__index">01</span>
            <h3 class="demo__title">按压物理</h3>
            <p class="demo__desc">按下 0.97 缩放，150ms 出、100ms 回。</p>
          </header>
          <div class="demo__stage"><!-- 真实可交互 demo --></div>
          <footer class="demo__spec">
            <dl class="spec-table">
              <div class="spec-row"><dt class="spec-key">缓动</dt><dd class="spec-val">--ease-out-quint</dd></div>
              <div class="spec-row"><dt class="spec-key">时长</dt><dd class="spec-val">150ms / 100ms</dd></div>
              <div class="spec-row"><dt class="spec-key">降级</dt><dd class="spec-val">reduced-motion: 仅颜色切换</dd></div>
            </dl>
          </footer>
        </article>
        <!-- 更多 .demo -->
      </div>
    </section>

    <!-- 页尾：上一站 / 下一站 -->
    <nav class="page-nav shell" aria-label="展厅导航">
      <a class="page-nav__link" href="states-feedback.html">…</a>
    </nav>
  </main>

  <div id="site-footer"></div>
  <div id="site-overlays"></div>

  <script src="assets/js/site.js"></script>
  <script src="assets/js/pages/micro-interactions.js"></script>
</body>
</html>
```

**`.demo` 是三段结构，必须完整**：`__label`（序号/标题/说明）、`__stage`（真实 demo）、`__spec`（规格标注）。
`.demo.reveal` 自动获得滚动揭示；`.demo-grid` 自动两/三列自适应。

---

## 2. `site.js` 注入的外壳 DOM（选择器可直接依赖）

```html
<!-- #site-header 内 -->
<header class="hdr" id="hdr" data-scrolled="false">
  <div class="scroll-progress"><span class="scroll-progress__bar" id="scroll-progress"></span></div>
  <div class="hdr__inner shell">
    <a class="brand" href="index.html">
      <span class="brand__mark" aria-hidden="true"><svg …></svg></span>
      <span class="brand__text">MOTION<span class="brand__dot">.</span>LAB</span>
      <span class="visually-hidden">返回首页</span>
    </a>

    <nav class="nav" id="primary-nav" aria-label="主导航">
      <a class="nav__link" data-nav="index" href="index.html">首页</a>
      <a class="nav__link" data-nav="atlas" href="atlas.html">交互地图</a>
      <a class="nav__link" data-nav="micro" href="micro-interactions.html">微交互</a>
      <a class="nav__link" data-nav="states" href="states-feedback.html">状态反馈</a>
      <a class="nav__link" data-nav="motion" href="motion-physics.html">运动物理</a>
      <button class="nav__link nav__link--more" id="nav-more" aria-expanded="false" aria-controls="nav-more-panel">
        全部展厅 <svg class="icon" …>
      </button>
      <div class="nav__panel" id="nav-more-panel" hidden>…12 个展厅链接 + 设计系统…</div>
    </nav>

    <div class="hdr__actions">
      <button class="btn btn--ghost btn--icon" id="btn-command" aria-keyshortcuts="Meta+K Control+K"
              aria-label="打开命令面板（快捷键 ⌘K）" title="命令面板 ⌘K">…</button>
      <button class="btn btn--ghost btn--icon" id="btn-motion" aria-pressed="false" title="动效强度：跟随系统 / 完整 / 精简 / 关闭">…</button>
      <button class="btn btn--ghost btn--icon" id="btn-theme" aria-label="切换主题" title="切换明暗主题">…</button>
      <button class="btn btn--ghost btn--icon" id="btn-menu" aria-expanded="false" aria-controls="mobile-drawer"
              aria-label="打开菜单">…</button>
    </div>
  </div>
</header>

<!-- 移动端抽屉 -->
<div class="drawer" id="mobile-drawer" hidden>…</div>

<!-- 命令面板 -->
<div class="palette" id="palette" hidden>
  <div class="palette__scrim" data-palette-close></div>
  <div class="palette__box" role="dialog" aria-modal="true" aria-label="命令面板">
    <div class="palette__field"><input id="palette-input" type="search" role="combobox" aria-expanded="true"
      aria-controls="palette-list" placeholder="搜索展厅 / 交互条目…（↑↓ 选择，↵ 打开，Esc 关闭）"></div>
    <ul class="palette__list" id="palette-list" role="listbox"></ul>
    <p class="palette__hint">…</p>
  </div>
</div>

<!-- #site-footer 内 -->
<footer class="ftr">
  <div class="shell ftr__inner">
    <p class="eyebrow">MOTION LAB · 交互交付展</p>
    <p class="ftr__claim">丝滑不是感觉，是可复现的参数。</p>
    <nav class="ftr__nav" aria-label="页脚导航">…全部展厅…</nav>
    <div class="ftr__meta">
      <button class="btn btn--ghost" id="btn-motion-2">动效强度：完整</button>
      <button class="btn btn--ghost" id="btn-theme-2">主题：暗</button>
      <p class="ftr__note tnum">静态站点 · 零依赖 · 13 页 · 全部 demo 真实可交互</p>
    </div>
  </div>
</footer>

<!-- #site-overlays 内 -->
<div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="false"></div>
<div class="grain" aria-hidden="true"></div>
```

- `<html data-page="…">` 决定 `[data-nav]` 高亮项（映射见 §4）。
- 抽屉、命令面板、Toast 由内核负责焦点管理与 Esc 关闭，页面无需重复实现。

---

## 3. `window.ML` 内核 API（页面脚本唯一可用工具库）

```js
ML.q(sel, root?)            // → Element | null
ML.qa(sel, root?)           // → Element[]
ML.create(tag, attrs?, html?) // → Element，attrs 支持 class/text/html/data-*/aria-*；'on:click' 绑定事件
ML.on(target, type, handler, opts?)   // target 可为元素或 document；自动 addEventListener
ML.once(el, event, fn)      // 一次性监听

// —— 动效档位 ——
ML.motion.get()             // → 'on' | 'lite' | 'off'（含系统 prefers-reduced-motion 的结果）
ML.motion.set(mode)         // 手动设置并写入 localStorage（'system' 可恢复跟随系统）
ML.motion.isSystem()        // → boolean：用户是否仍在跟随系统
ML.motion.onChange(fn)      // → unsubscribe；fn(mode, source)
ML.reduced                  // → boolean：当前是否应弱化动效（lite/off 皆为 true）

// —— 过渡 ——
ML.transition(el, to, opts) // {{duration,easing,delay,fill}} → Promise，自动兜底兜底为瞬时完成
ML.transitionBy(el, delta, opts)
ML.wait(ms)                 // → Promise，尊重 ML.reduced（弱化为 1 帧）

// —— 弹簧物理（可打断、可重定向、带速度衔接） ——
ML.presets                  // → {{snap,standard,soft,playful}} 各自 {{stiffness,damping,mass}}
ML.spring(handle, from, to, opts)   // handle={{onUpdate(v,velocity), onComplete?}}；opts={{preset|stiffness,damping,mass,velocity,restDelta,onComplete}}；返回句柄
                              // 句柄方法：.stop() .setTarget(v) .set(v) .get() .isRunning
ML.springTo(el, prop, to, opts)     // 直接驱动元素数值属性：prop ∈ 'x' | 'y' | 'scale' | 'rotate' | 'opacity'
ML.raf(fn)                  // → 取消函数；**单次** rAF 包装，fn() 只执行一帧（常用于「下一帧再读布局」）
ML.schedule(fn, onDone?)    // → 取消函数；**逐帧任务**，fn(dtSeconds, timeMs)，返回 false 表示完成，
                            //   完成后调用 onDone。所有逐帧循环（进度、倒计时、自定义物理）必须用这个，
                            //   不要用 ML.raf 循环（那只会走一帧）。
ML.lerp(a, b, t)
ML.clamp(v, min, max)
ML.mapRange(v, a1, b1, a2, b2, clamp?)

// —— 滚动 ——
ML.scroll.progress()        // → 0..1（页面整体进度）
ML.scroll.y()               // → 当前 scrollY
ML.scroll.onScroll(fn, {passive:true}) // → unsubscribe；fn(y, progress)
ML.scroll.to(target, opts?) // 平滑滚动到元素/选择器/数值；尊重 reduced-motion 与聚焦元素
ML.scroll.lock() / .unlock()// 锁定页面滚动（模态用），自动补偿滚动条宽度

// —— 声明式增强（自动扫描，页面 HTML 写 data 属性即生效） ——
ML.reveal(root?)            // 扫描 [data-reveal] / .reveal，进入视口后加 --in；支持 data-reveal-delay / data-reveal-stagger（作用于子项）
ML.parallax(root?)          // 扫描 [data-parallax="0.12"]（正数向下偏移，负数反向）
ML.tilt(root?)              // 扫描 [data-tilt="8"]（最大角度）、[data-tilt-glare]
ML.countUp(root?)           // 扫描 [data-count="1234" data-count-decimals="0" data-count-prefix="¥" data-count-suffix="%"]
ML.magnetic(root?)          // 扫描 [data-magnetic="6"] 磁吸位移
ML.copy(text, opts?)        // 复制文本 → Promise；失败自动降级；成功/失败已由内核 toast 反馈
ML.init(root?)              // 在 DOMContentLoaded 之后由 site.js 调用一次；页面无需调用

// —— 测量 ——
ML.observeSize(el, cb)      // → unsubscribe（ResizeObserver）
ML.prefers('reduced-motion')// → boolean
ML.viewport()               // → {{w,h,dpr,isMobile,isTablet,isDesktop}}
```

**约定**：所有动画写 DOM 一律在 `rAF` 内；只允许 `transform` / `opacity` / `filter` / CSS 变量。
页面脚本必须包在 `ML.on(document, 'ml:ready', () => { … })` 内（`site.js` 注入外壳后触发），
或使用 `ML.init` 的幂等模式（见下）：

```js
(function () {
  'use strict';
  function boot() { /* 页面逻辑 */ }
  if (document.readyState === 'loading') {
    document.addEventListener('ml:ready', boot, { once: true });
  } else { document.addEventListener('ml:ready', boot, { once: true }); }
})();
```

---

## 4. `data-page` → 导航高亮映射

| data-page | 高亮项 | 页面文件 |
|---|---|---|
| `index` | 首页 | index.html |
| `atlas` | 交互地图 | atlas.html |
| `micro-interactions` | 微交互 | micro-interactions.html |
| `states-feedback` | 状态反馈 | states-feedback.html |
| `scroll-motion` | 全部展厅 | scroll-motion.html |
| `page-transitions` | 全部展厅 | page-transitions.html |
| `navigation` | 全部展厅 | navigation.html |
| `forms` | 全部展厅 | forms.html |
| `gestures` | 全部展厅 | gestures.html |
| `motion-physics` | 运动物理 | motion-physics.html |
| `feedback` | 全部展厅 | feedback.html |
| `accessibility` | 全部展厅 | accessibility.html |
| `data-viz` | 全部展厅 | data-viz.html |
| `design-system` | 全部展厅 | design-system.html |

---

## 5. `ML.UI` 组件工厂（反馈与浮层，页面直接用，避免各写一套）

```js
ML.UI.icon(name, {size=20, cls=''})        // → SVG 元素（图标集见 §6），默认可内联进按钮
ML.UI.toast({title, desc, variant='info', duration=4000, action})  // variant: info|success|warning|danger
                                            // → {{el, close()}}；自动 aria-live 播报、hover 暂停、最多 4 条
ML.UI.dialog({title, body, actions, size='sm', onOpen, onClose})   // → {{el, open(), close()}}；焦点锁定 + Esc + 还原焦点
ML.UI.confirm({title, desc, confirmText='确认', danger=false})      // → Promise<boolean>
ML.UI.drawer({title, side='right', content, onOpen, onClose})       // → {{el, open(), close()}}
ML.UI.popover(anchor, content, {placement='bottom-start'})         // → {{el, close()}}；自动翻转、随滚动更新、Esc 关闭
ML.UI.tabs(container, {onChange})           // 增强 .tabbar/.tabs 结构，滑动指示器 + 方向键
ML.UI.tooltip(anchor, text, {placement})    // 键盘可达（focus 也显示），aria-describedby 自动接线
ML.UI.copyButton(btn, text)                 // 点击复制 + 成功态（图标形变），内部走 ML.copy
ML.UI.skeleton(rows=3)                      // → 骨架元素
```

---

## 6. 图标集（`ML.UI.icon(name)` 支持的名称，全部内联 SVG，24×24，stroke 1.5，currentColor）

```
arrow-right  arrow-left  arrow-up-right  chevron-down  chevron-right  chevron-left  chevron-up
plus  minus  close  check  search  menu  more-horizontal  external
moon  sun  zap  zap-off  sparkle  play  pause  refresh  undo  trash  copy  link
info  alert  warning  check-circle  x-circle  loader  sliders  layers  grid  list
layout  mouse-pointer  hand  keyboard  volume  bell  eye  eye-off  lock  unlock  wand  github  file
```

**禁止**：emoji 作为图标；用位图 PNG；混用图标风格或自造路径。
页面需要图标时一律 `ML.UI.icon('check')` 插入，CSS 里用 `.icon` 控制尺寸。

---

## 7. 演示数据

- 全站 demo 数据一律**内联手写在页面脚本里**，禁止 fetch/网络请求（保证 `file://` 双击可运行）。
- 图表用手写 SVG（`viewBox` + `path`/`rect`），不用任何图表库。
- 人名/项目名请使用中性占位（如「项目 Atlas」「受访者 A」），不要真实品牌或真实个人。

---

## 8. 每个 demo 的规格标注必填项

| 字段 | 说明 |
|---|---|
| 触发 | 什么事件触发（pointerdown / 进入视口 / 提交…） |
| 时长 | 使用哪个 `--dur-*` token 或毫秒值 |
| 缓动 | 使用哪个 `--ease-*` token 或弹簧预设（含 stiffness/damping/mass） |
| 属性 | 动画了哪些属性（只允许 transform/opacity/filter/变量） |
| 降级 | reduced-motion / 动效关闭时的行为 |
