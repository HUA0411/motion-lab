# MOTION LAB · 交互设计交付展

> 把「高级感」拆成可交付的规格：缓动曲线、弹簧刚度、错开间隔、降级策略。
> 每个条目都能被复核、被复制、被写进验收单。

一个**零构建、零依赖、零框架**的静态多页面站点：14 个页面、137 个真实可交互 demo，
全部手写原生 CSS 与 JavaScript。**双击 `index.html` 即可运行**，不需要 npm、不需要本地服务。

[![License: MIT](https://img.shields.io/badge/License-MIT-e8894a.svg)](LICENSE)
[![No dependencies](https://img.shields.io/badge/dependencies-0-e8894a.svg)](#)
[![Pages](https://img.shields.io/badge/pages-14-e8894a.svg)](#站点地图14-页)
[![Demos](https://img.shields.io/badge/interactive%20demos-137-e8894a.svg)](#站点地图14-页)
[![A11y](https://img.shields.io/badge/contrast-WCAG%20AA-e8894a.svg)](#验证证据audit)

> 如果这个项目对你有帮助，欢迎点一个 ⭐ Star。

---

## 30 秒上手

```bash
# 方式一：直接打开（推荐验证「零依赖」）
双击 index.html

# 方式二：本地静态服务（避免个别浏览器的 file:// 限制）
python -m http.server 8080 --bind 127.0.0.1
# 打开 http://127.0.0.1:8080/index.html
```

**全站快捷键**

| 快捷键 | 作用 |
|---|---|
| `⌘K` / `Ctrl K` | 打开命令面板（搜索 14 个页面，↑↓ 选择，↵ 打开） |
| `/` | 同上 |
| `Esc` | 关闭当前浮层 |
| `Tab` / `Shift Tab` | 键盘遍历（全站可见焦点环） |
| `←` `→` `Home` `End` | 标签页 / 横向滚动区 / 手势 demo 的键盘替代 |

页头右侧三个按钮：**搜索**（命令面板）、**动效强度**（完整 / 精简 / 关闭三档）、**明暗主题**。
所有偏好写入 `localStorage`，与系统 `prefers-reduced-motion` 联动。

---

## 站点地图（14 页）

| # | 页面 | 内容 | demo 数 |
|---|---|---|---|
| — | [index.html](index.html) | 动力学首屏、全站地图、横向参数墙、交付流程 | 视觉叙事 |
| — | [atlas.html](atlas.html) | 交互地图：120 条目可搜索 / 按展厅筛选 | 交互索引 |
| A | [micro-interactions.html](micro-interactions.html) | 按压物理、涟漪、开关、点赞、评分、滑块、载荷按钮、图标形变 | 16 |
| B | [states-feedback.html](states-feedback.html) | 骨架屏、空态、错误、离线、乐观更新、退避重试、冲突、超时 | 12 |
| C | [scroll-motion.html](scroll-motion.html) | 揭示、4 层视差、粘性堆叠、横向滚动、滚动时间轴、章节变色 | 10 |
| D | [page-transitions.html](page-transitions.html) | 跨文档 View Transitions、共享元素、模态展开、FLIP 排序 | 8 |
| E | [navigation.html](navigation.html) | 命令面板、超大菜单、底部导航、标签指示器、scrollspy、状态保持 | 12 |
| F | [forms.html](forms.html) | 浮动标签、内联校验、密码强度、多步进度、自动保存、撤销删除 | 15 |
| G | [gestures.html](gestures.html) | 拖拽排序、滑动删除、橡皮筋、下拉刷新、双指缩放、长按菜单 | 12 |
| H | [motion-physics.html](motion-physics.html) | 弹簧调参器 + 曲线可视化、缓动对比、可打断、帧耗时对比 | 12 |
| I | [feedback.html](feedback.html) | Toast 栈、aria-live 字幕、工具提示、对话框、通知中心、撤销 | 12 |
| J | [accessibility.html](accessibility.html) | 实时对比度检测器、焦点环、键盘陷阱、触控标尺、ARIA 状态 | 13 |
| K | [data-viz.html](data-viz.html) | 手写 SVG 折线/面积/柱/环形/热力/仪表盘 + 数据表替代 | 11 |
| L | [design-system.html](design-system.html) | 全站 token、字体阶梯、栅格、动效 token、组件状态矩阵 | 4 |

合计 **137 个 demo，137 份规格标注**（每个 demo 都注明 触发 / 时长 / 缓动 / 属性 / 降级 行为）。

---

## 目录结构

```
.
├─ index.html … design-system.html      14 个页面（HTML 只写结构与文案）
├─ assets/
│  ├─ css/
│  │  ├─ tokens.css                    设计 token 唯一真源（颜色/字体/间距/动效/双层主题）
│  │  ├─ motion.css                    动效原语与工具类（揭示/骨架/涟漪/弹层/视图过渡）
│  │  ├─ site.css                      站点外壳与通用组件（页头/页脚/Toast/模态/命令面板…）
│  │  └─ pages/<page>.css              14 个页面专属样式
│  ├─ js/
│  │  ├─ motion.js                     动效内核 window.ML（弹簧物理/揭示/视差/滚动/主题）
│  │  ├─ ui.js                         UI 组件工厂 window.ML.UI（图标/Toast/对话框/抽屉…）
│  │  ├─ site.js                       外壳注入（导航/命令面板/主题与动效开关/滚动进度）
│  │  └─ pages/<page>.js               14 个页面逻辑（+ 同名 .inline.js 首屏同步初始化）
│  └─ favicon.svg
├─ DESIGN-SYSTEM.md                    设计系统与工程契约（token 表、实测对比度、弹簧参数）
├─ CONTRACT.md                         外壳 DOM / ML API / 图标集契约
├─ tools/                              CDP 测试器（自带 Chromium，无需 playwright）
└─ audit/                              验证证据与报告（见下）
```

**没有构建步骤、没有 node_modules、没有 CDN 依赖**（仅 Google Fonts，断网时自动回退系统字体）。

---

## 技术要点

### 1. 一套可打断的弹簧物理（`assets/js/motion.js`）

```js
// 半隐式欧拉：F = -k·x - c·v → v += a·dt → x += v·dt（dt ≤ 1/30）
ML.spring({ onUpdate: v => el.style.transform = `translate3d(${v}px,0,0)` }, 0, 240, { preset: 'standard' });
```

| 预设 | stiffness | damping | mass | ζ | 实测过冲 | 用途 |
|---|---|---|---|---|---|---|
| `snap` | 520 | 30 | 0.7 | 0.79 | 0.00% | 开关、分段控件 |
| `standard` | 340 | 28 | 1 | 0.76 | 0.33% | 默认 |
| `soft` | 170 | 24 | 1.2 | 0.84 | 0.05% | 渐进揭示 |
| `playful` | 420 | 24 | 1 | 0.59 | 6.54% | 强调反馈 |

- **可打断**：`.setTarget()` 保留当前速度衔接，不回到起点。
- **单帧队列**：全站所有 JS 动画共用一个 `requestAnimationFrame`，页面隐藏时自动停。
- 离线验证：`node audit/verify-spring.mjs` → **11/11 PASS**（受控帧队列推进 60fps，不依赖浏览器）。

### 2. 动效三档 + 系统偏好

`<html data-motion="on|lite|off">`：`on` 完整；`lite` 仅不透明度/颜色；`off` 瞬时。
系统 `prefers-reduced-motion: reduce` 自动降级为 `lite`；用户手动选择覆盖并持久化。

### 3. 双主题（暗色为主 + 暖纸亮色）

`:root, [data-theme='dark']` 与 `:root[data-theme='light']` 两套 token，**所有前景/背景组合实测 ≥4.5:1**
（14 页 × 两种主题全量扫描，见 `audit/`）。切换主题时临时禁用过渡，避免 var() 驱动颜色停在旧值。

### 4. 无障碍

- 全站可见焦点环、跳转链接、语义结构（唯一 `h1`、不跳级）、44px 触控目标。
- 状态不只用颜色表达（配图标 / 文字 / 纹理）。
- 弹层焦点锁定 + `Esc` + 关闭后焦点还原；Toast 用 `aria-live`；表单错误 `role="alert"`。
- 图标一律内联 SVG（`ML.UI.icon()`，24×24 / stroke 1.5），**全站 0 emoji 图标**。

### 5. 性能

- 只动画 `transform` / `opacity` / `filter` / CSS 变量；**无** `width/height/top/left` 动画。
- 揭示用 IntersectionObserver + 兜底（内容永不卡在 `opacity:0`）。
- 无横向滚动、无布局抖动（CLS 目标 < 0.1）。

---

## 验证证据（`audit/`）

| 文件 | 内容 |
|---|---|
| `REPORT.md` | 独立验证报告（静态扫描 / 运行时 / 降级 / 主题 / 交互抽样） |
| `verify-spring.mjs` + `spring-report.txt` | 弹簧物理与调度器离线验证（11/11 PASS） |
| `lead-contrast.mjs` | 双主题全站文字对比度扫描器（WCAG AA 判定，含半透明层叠与背景图处理） |
| `scan_static.py` / `static-scan.json` | 静态一致性扫描（结构、死链、emoji、裸 hex、外部依赖） |
| `runtime-*.json` | 14 页 × 1440/375 × 正常/reduced/motion-off/light 的运行时快照 |

**终验结论**（全部实测，可复现）：

- 14/14 页交付，**211 条站内引用 0 死链**
- 14 页 × 2 视口 × 3 动效档位：**0 控制台错误、0 运行时错误、0 横向溢出**
- 对比度：暗色 / 亮色 **各 14 页全部 ≥4.5:1**
- 弹簧内核：**11/11 PASS**
- JS：31 个文件 `node --check` **全部通过**
- 结构：每页唯一 `h1`、标题不跳级、`main#main`、跳转链接、外壳完整

自行复验：

```bash
# 静态服务（若未启动）
python -m http.server 8912 --bind 127.0.0.1

# 单页体检（控制台/溢出/结构/截图）
node tools/cdp.mjs "http://127.0.0.1:8912/motion-physics.html" --w 1440 --h 900 --wait 1800 --shot audit/shots/x.png

# reduced-motion 降级
node tools/cdp.mjs "http://127.0.0.1:8912/index.html" --w 1440 --h 900 --reduced

# 离线弹簧验证（不需要浏览器）
node audit/verify-spring.mjs

# 全站对比度
node audit/lead-contrast.mjs --theme dark
node audit/lead-contrast.mjs --theme light
```

---

## 设计与工程契约

- [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — 设计系统唯一真源：token 表（含实测对比度）、排版阶梯、动效参数、无障碍基线、质量门槛。
- [CONTRACT.md](CONTRACT.md) — 外壳 DOM 结构、`window.ML` API、`ML.UI` 组件工厂、图标集、页面骨架契约。

原则：**页面只写结构与文案，颜色/时长/缓动一律引用 token；禁止裸 hex、禁止自定义缓动、禁止 emoji 图标。**

---

## 许可证

[MIT](LICENSE) © 张国华 (HUA0411)

你可以自由地用于个人与商业项目、修改、分发；唯一要求是保留版权声明与许可证文本。
项目中的设计 token、弹簧参数、动效规格与无障碍清单均取自本项目自身的实测数据，
欢迎直接复制到你的设计系统里使用。

## 相关文档

| 文档 | 说明 |
|---|---|
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | 设计系统与工程契约：token 表（含实测对比度）、排版、弹簧参数、质量门槛 |
| [CONTRACT.md](CONTRACT.md) | 外壳 DOM 结构、window.ML API、ML.UI 组件工厂、图标集、页面骨架 |
| [audit/REPORT.md](audit/REPORT.md) | 独立验证报告：静态扫描 / 运行时 / 降级 / 主题 / 交互抽样 |
| [audit/shots/](audit/shots/) | 14 页 × {1440, 375} × {正常, reduced, 亮色} 验收截图 |
