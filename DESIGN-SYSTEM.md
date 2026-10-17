# 交付级 UI 交互设计展 — 设计系统与工程契约 v1.0

> 本文件是**唯一真源（single source of truth）**。所有页面、组件、动效必须严格使用此处定义的
> token 名称、类名、文件路径与 API。任何页面不得自定义颜色字面量、自定义时长或自定义缓动。

设计基线来自 `ui-ux-pro-max`（design-system: Motion-Driven + Minimalism & Swiss Style，
Motion-Driven 风格 · prefers-reduced-motion ⚠ 必须降级）。
本项目取两套风格的**交集**：排版与栅格走瑞士国际主义的克制，**唯一"奢侈"给动效**。

---

## 0. 项目定位

| 项 | 值 |
|---|---|
| 站点名 | **MOTION LAB · 交互交付展** |
| 一句话 | 把「高级感」拆解成可交付的规格：丝滑不是感觉，是可复现的参数。 |
| 交付形态 | 静态多页面站点，零构建、零依赖、零框架，双击 `index.html` 即可运行 |
| 内容范围 | 12 个专题展厅 + 1 套设计系统文档，覆盖微交互 / 状态与反馈 / 滚动叙事 / 页面转场 / 导航 / 表单 / 手势 / 运动物理 / 反馈系统 / 无障碍 / 数据可视化 |
| 品质判据 | ① 每个 demo 真实可交互 ② 每个 demo 附「规格标注」（参数、缓动、时长） ③ 全站 reduced-motion 降级 ④ 键盘可达 |

---

## 1. 目录与文件契约（禁止越界写入）

```
UI交互设计/
├─ index.html                 首页（Lead）
├─ atlas.html                 交互地图：全部条目的可筛选索引
├─ micro-interactions.html    A 微交互
├─ states-feedback.html       B 状态与反馈
├─ scroll-motion.html         C 滚动与视差叙事
├─ page-transitions.html      D 页面转场
├─ navigation.html            E 导航模式
├─ forms.html                 F 表单交互
├─ gestures.html              G 手势与拖拽
├─ motion-physics.html        H 运动物理
├─ feedback.html              I 反馈系统
├─ accessibility.html         J 无障碍交互
├─ data-viz.html              K 数据可视化动态
├─ design-system.html         L 设计系统文档页
├─ assets/css/tokens.css      设计 token（仅 Lead 可写）
├─ assets/css/motion.css      动效原语与工具类（仅 Lead 可写）
├─ assets/css/site.css        站点外壳样式（仅 Lead 可写）
├─ assets/js/motion.js        动效内核 ML.*（仅 Lead 可写）
├─ assets/js/ui.js            共享 UI 组件 ML.UI.*（仅 Lead 可写）
├─ assets/js/site.js          外壳注入：header/footer/⌘K/主题/动效开关（仅 Lead 可写）
├─ assets/css/pages/<page>.css   页面专属样式（各页面负责人）
├─ assets/js/pages/<page>.js     页面专属脚本（各页面负责人）
└─ assets/js/pages/<page>.inline.js  页面首屏同步脚本（必须在 body 中同步引用，防 FOUC）
```

**页面 HTML 的统一骨架（必须原样使用）**

```html
<!DOCTYPE html>
<html lang="zh-CN" data-motion="on" data-theme="dark" data-page="micro-interactions">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>微交互 · MOTION LAB</title>
<meta name="description" content="……">
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
<main id="main" class="page"> …页面内容… </main>
<div id="site-footer"></div>
<div id="site-overlays"></div>
<script src="assets/js/site.js"></script>
<script src="assets/js/pages/micro-interactions.js"></script>
</body>
</html>
```

> `#site-header / #site-footer / #site-overlays` 三个空容器由 `site.js` 注入外壳。
> 主题与动效偏好在 `<head>` 内由 `motion.js` 立即同步到 `<html>`（防闪烁）。
> 页面专属 `.inline.js` 负责该页首屏的同步初始化（例如初始 class、骨架数据），保持极小。

---

## 2. 色彩 token（暗色为主，亮色为对照演示）

对比度已实测（WCAG 2.1，值 = 相对背景的对比度）。

### 2.1 暗色（默认 `data-theme="dark"`）

| Token | Hex | 用途 | 对比度 |
|---|---|---|---|
| `--ink-900` | `#0A0B0D` | 页面底色 | — |
| `--ink-800` | `#14161A` | 面板 / 卡片 | — |
| `--ink-700` | `#1C1F24` | 抬升面板 / 输入框 | — |
| `--ink-600` | `#262A31` | 分隔线 / 描边 | — |
| `--paper` | `#F5F2EA` | 主文字（暖白，不刺眼） | 17.6:1 |
| `--paper-dim` | `#DED9CD` | 规格表数值、次要正文 | 13.98:1 |
| `--muted` | `#7C7F84` | 次级文字（≥ --ink-800 上 4.51:1；**不可用于 --ink-700 上的正文**） | 4.9:1 |
| `--muted-2` | `#8F9297` | 说明性文字、表格表头 | 6.31:1 |
| `--muted-strong` | `#9A9DA2` | **弱化文字的默认安全档**：页脚小字、时间戳、占位符、标签（在 ink-900/800/700/650 上均 ≥5.35:1） | 5.35–7.3:1 |
| `--faint` | `#4A4D52` | **仅限非文字装饰**（禁用态填充、分隔虚线、图形描边）。**禁止承载任何文字信息** | 2.32:1 |
| `--accent` | `#FF6B2C` | 主动作 / 焦点 / 品牌信号 | 6.93:1 |
| `--accent-soft` | `rgba(255,107,44,0.14)` | 强调底色 | — |
| `--success` | `#4ADE80` | 成功 | 11.3:1 |
| `--warning` | `#FBBF24` | 警告 | 11.79:1 |
| `--danger` | `#F87171` | 错误 / 危险 | 7.12:1 |
| `--info` | `#5AA9F5` | 信息（图表第二色） | 7.9:1 |

**选字规则（避免最常见的不达标）**：正文用 `--paper`；说明用 `--muted-2`；小字/时间戳/表头用 `--muted-strong`；
`--muted` 只用在 `--ink-800` 及更深的底色上；`--faint` 只做装饰，不放文字。

> 强调橙 `#FF6B2C` 在**浅色模式**下对比度仅 2.54:1，因此亮色模式必须切换到 `--accent-strong #C2410C`（4.63:1 ✅）。

### 2.2 亮色（`data-theme="light"`）

| Token | Hex | 用途 |
|---|---|---|
| `--ink-900` | `#F5F2EA` | 页面底色（暖纸） |
| `--ink-800` | `#FFFFFF` | 面板 |
| `--ink-700` | `#EDE9E0` | 抬升面板 |
| `--ink-600` | `#DAD4C7` | 分隔线 |
| `--paper` | `#0A0B0D` | 主文字（17.6:1） |
| `--muted` | `#5A5F66` | 次级文字 |
| `--faint` | `#8B9099` | 三级文字 |
| `--accent` | `#C2410C` | 强调（4.63:1 ✅） |

**实现要求**：token 全部定义在 `:root`，亮色覆盖写在 `[data-theme="light"]`。
组件内**只允许** `var(--token)`，禁止裸 hex / `rgba()` 字面量（透明蒙版除外，但也应使用已定义的 `--scrim`）。

---

## 3. 字体与排版

| 角色 | 字体栈 | 说明 |
|---|---|---|
| 展示 / 标题 | `'Archivo', 'Noto Sans SC', system-ui, -apple-system, 'Segoe UI', sans-serif` | `--font-display` |
| 正文 / UI | `'Space Grotesk', 'Noto Sans SC', system-ui, -apple-system, sans-serif` | `--font-body` |
| 标签 / 数据 | `'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace` | `--font-mono` |

字体通过 `tokens.css` 顶部 `@import` 引入 Google Fonts（`display=swap`）。
**离线兜底**：字体栈已包含系统字体，断网时排版不塌。基准字号 16px，移动端正文 ≥16px。

| Token | size / line-height / letter-spacing | 用途 |
|---|---|---|
| `--fs-display` | `clamp(2.75rem, 7vw, 6rem)` / 0.94 / `-0.035em` | 首屏巨字 |
| `--fs-h1` | `clamp(2.25rem, 4.4vw, 3.5rem)` / 1.04 / `-0.025em` | 页面主标题 |
| `--fs-h2` | `clamp(1.75rem, 2.6vw, 2.25rem)` / 1.14 / `-0.02em` | 区块标题 |
| `--fs-h3` | `1.25rem` / 1.3 / `-0.01em` | 卡片标题 |
| `--fs-body` | `1rem` / 1.65 / 0 | 正文 |
| `--fs-sm` | `0.875rem` / 1.55 / 0 | 辅助文字 |
| `--fs-label` | `0.6875rem` / 1.4 / `0.18em`（大写） | 技术标注 / eyebrow |
| `--fs-mono` | `0.8125rem` / 1.6 / `0` | 参数表 / 代码 |

- 字重：标题 600–700，正文 400，标签 500。
- 正文行长 60–75 字符（`--measure: 68ch`）。
- 数据列必须 `font-variant-numeric: tabular-nums`（`.tnum` 工具类）。
- 大标题字距为负，`--fs-label` 为正且大写。

---

## 4. 间距、栅格、圆角

- 间距阶梯：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128 → `--space-1..10`（4pt 基准）
- 容器：`--container: 1240px`，移动端边距 `--gutter: 20px`，≥768px 为 32px，≥1200px 为 48px
- 圆角：`--r-xs 6px` / `--r-sm 10px` / `--r-md 14px` / `--r-lg 20px` / `--r-xl 28px` / `--r-pill 999px`
- 描边：`--hairline: 1px solid var(--ink-600)`，卡片统一使用 `--hairline`
- 阴影（暗色下用"光"而非"影"）：
  `--shadow-1: 0 1px 2px rgba(0,0,0,.4)` ·
  `--shadow-2: 0 8px 24px -8px rgba(0,0,0,.6)` ·
  `--shadow-3: 0 24px 60px -20px rgba(0,0,0,.75)` ·
  `--glow-accent: 0 0 0 1px rgba(255,107,44,.35), 0 12px 40px -12px rgba(255,107,44,.45)`
- 栅格：12 列，`--col-gap: 24px`；断点 **375 / 768 / 1024 / 1440**
- 层级 z-index：`--z-base 0` / `--z-sticky 10` / `--z-header 40` / `--z-overlay 50` / `--z-drawer 60` / `--z-modal 70` / `--z-toast 80` / `--z-palette 90` / `--z-noise 100`

---

## 5. 动效系统（全站唯一"奢侈品"）

### 5.1 时长

| Token | 值 | 用途 |
|---|---|---|
| `--dur-instant` | `80ms` | 按压反馈、开关位移的收尾 |
| `--dur-fast` | `150ms` | hover、颜色、图标微动 |
| `--dur-base` | `240ms` | 通用微交互、状态切换 |
| `--dur-slow` | `360ms` | 抽屉、面板、模态进入 |
| `--dur-slower` | `560ms` | 页面级、区块揭示 |
| `--dur-exit` | `0.68 ×` 对应进入时长 | **退出永远快于进入** |

### 5.2 缓动（禁止 linear 用于 UI 过渡；`linear` 只允许用于 marquee 与进度条）

| Token | 曲线 | 用途 |
|---|---|---|
| `--ease-out-quint` | `cubic-bezier(.22,1,.36,1)` | 进入（默认） |
| `--ease-out-expo` | `cubic-bezier(.16,1,.3,1)` | 大位移进入 |
| `--ease-in-quad` | `cubic-bezier(.55,.085,.68,.53)` | 退出 |
| `--ease-in-out-quart` | `cubic-bezier(.76,0,.24,1)` | 对称位移 |
| `--ease-spring-soft` | `cubic-bezier(.34,1.56,.64,1)` | 轻微过冲（≤5%） |
| `--ease-snap` | `cubic-bezier(.2,.9,.25,1)` | 快速吸附 / 分段控件 |

### 5.3 弹簧物理（JS，`ML.spring`）

| 预设 | stiffness | damping | mass | ζ | 实测过冲 | 到位帧数 | 用途 |
|---|---|---|---|---|---|---|---|
| `snap` | 520 | 30 | 0.7 | 0.79 | 0.00% | 31 | 开关、分段控件、滑块 |
| `standard` | 340 | 28 | 1 | 0.76 | 0.33% | 41 | 卡片、面板、默认 |
| `soft` | 170 | 24 | 1.2 | 0.84 | 0.05% | 66 | 渐进揭示、大面板 |
| `playful` | 420 | 24 | 1 | 0.59 | 6.54% | 48 | 强调反馈、点赞、抽取 |

ζ = c / (2√(km))；过冲与帧数为 `audit/verify-spring.mjs` 的离线实测值（半隐式欧拉、dt = 1/60）。
积分模型全站统一：`F = -k·x - c·v` → `a = F/m` → `v += a·dt` → `x += v·dt`（dt 上限 1/30）。
弹簧由统一的 `rAF` 帧队列驱动，**任意时刻可被新目标打断**（`setTarget` 保留当前速度，不回到起点）。
帧任务约定：回调返回 `false` = 完成（移出队列），返回 `true`/`undefined` = 继续。

### 5.4 滚动与视差

- 揭示：IntersectionObserver，阈值 0.15，进入 `translateY(24px) → 0` + `opacity 0 → 1`，
  批量错开 `--stagger: 45ms`（30–50ms 区间）。
- 视差：`data-parallax="0.12"`（4 层：0.04 / 0.08 / 0.12 / 0.18），仅 `translate3d`，仅 `rAF` 内写 DOM。
- 滚动进度条：`--scroll-progress` 写入根元素。
- `scroll-behavior: smooth` 用于锚点；**不使用 scroll-jacking**。

### 5.5 动效三档（用户可控，且必须跟随系统）

`<html data-motion>`：`on`（默认） / `lite`（仅保留不透明度与颜色过渡） / `off`（全部瞬时）。
系统 `prefers-reduced-motion: reduce` → 自动 `lite`；用户手动选择写入 `localStorage.ml-motion`。
**禁止**：无限循环装饰动画（仅允许 loader）、动画 `width/height/top/left`、动画中阻塞输入、
残留 `opacity < 0.2` 的可见元素、无 reduced-motion 兜底的视差/自动轮播。

---

## 6. 组件与工具类（`motion.css` / `site.css` 提供，页面直接使用）

| 类名 | 说明 |
|---|---|
| `.skip-link` | 跳过导航（聚焦时出现在左上） |
| `.shell` | 容器：`max-width: var(--container)` + `padding-inline: var(--gutter)` |
| `.section` / `.section-head` | 区块与区块头（eyebrow + 标题 + 描述） |
| `.eyebrow` | 大写小字标签（`--fs-label`，accent 色） |
| `.display` / `.h1` / `.h2` / `.h3` | 排版类 |
| `.lede` | 导语（1.125rem，`--muted`） |
| `.panel` / `.panel-lift` | 面板与可抬升面板（hover 用 transform，不改尺寸） |
| `.demo` | demo 舞台：面板 + 顶部标签 + 底部规格区 |
| `.demo__label` / `.demo__stage` / `.demo__spec` | demo 的三段结构 |
| `.spec-table` | 参数表（mono、tabular-nums） |
| `.spec-row` / `.spec-key` / `.spec-val` | 参数行 |
| `.btn` / `.btn--primary` / `.btn--ghost` / `.btn--danger` / `.btn--icon` | 按钮族（含 `disabled`、按压 0.97 缩放、无布局位移） |
| `.field` / `.label` / `.hint` / `.error` / `.field--invalid` | 表单族 |
| `.toggle` / `.segmented` / `.tabbar` / `.stepper` | 控件族 |
| `.chip` / `.badge` / `.tag` | 标记族 |
| `.skeleton` / `.spinner` / `.shimmer` | 加载族 |
| `.grid` / `.grid--2` / `.grid--3` / `.grid--12` | 栅格 |
| `.reveal` / `.reveal--in` | 揭示（JS 加 `--in`） |
| `.tnum` / `.mono` | 数字对齐 / 等宽 |
| `.visually-hidden` | 屏幕阅读器可见 |
| `.toast-region` | aria-live 容器 |

---

## 7. 无障碍基线（交付门槛，不可协商）

1. 正文对比度 ≥ 4.5:1（本表所有前景/背景对已实测）。
2. 所有交互元素可见焦点环：`outline: 2px solid var(--accent); outline-offset: 3px;`（`:focus-visible`）。
3. 触控目标 ≥ 44×44px；相邻目标间距 ≥ 8px。
4. 语义结构：`<main id="main">`、标题层级不跳级、每页唯一 `<h1>`。
5. 图标一律内联 SVG（24×24 viewBox，`stroke-width: 1.5`，`currentColor`）—
   **禁止使用 emoji 作为功能图标**。
6. 状态不可仅用颜色表达（配文字/图标/纹理）。
7. 表单：始终可见 `<label>`（非 placeholder-only）、错误紧邻字段、`aria-live` 播报、
   提交时按钮 disabled + loading。
8. 模态/抽屉：焦点锁定、`Esc` 关闭、关闭后焦点回到触发元素。
9. 颜色对比、键盘操作、reduced-motion 三项在每个页面自检。
10. 无横向滚动；`overflow-x: hidden` 不能用来掩盖布局错误。

---

## 8. 质量门槛（每页交付前自检）

- [ ] 移动端 375px、768px、1024px、1440px 无横向滚动与重叠
- [ ] 键盘可完整走通页面全部交互（Tab / Shift+Tab / Enter / Space / Esc / 方向键）
- [ ] `prefers-reduced-motion: reduce` 与站内动效开关三档均不破版
- [ ] 亮色/暗色两种主题下对比度达标、分隔线均可见
- [ ] 每个 demo 有规格标注（参数 / 缓动 / 时长 / reduced-motion 行为）
- [ ] 无 emoji 图标、无 `console` 报错、无 `<img>` 缺失（全站不使用位图，图形用 CSS/SVG）
- [ ] 页面内所有站内链接指向真实存在的文件
