# MOTION LAB · 独立验证报告（audit/REPORT.md）

> 验证员：teammate `verifier`（task-6）· 只读业务文件，仅写 `audit/`。
> 生成时间：2026-10-16 23:42:26
> 静态服务：`http://127.0.0.1:8912/`（`python -m http.server --directory <项目根>`）
> 浏览器：Chromium headless（CDP，agent-browser 自带内核），viewport 1440×900 / 375×812，DPR 1。

## 0. 复现命令（全部可原样执行）

```powershell
# A 节：静态一致性（14 页 HTML/CSS/JS 全量扫描）
python audit/scan_static.py            # → audit/static-scan.json / .txt

# B 节：运行时逐页体检（控制台、横向溢出、结构、截图）
node audit/batch.mjs --w 1440 --h 900 --shots --dump-demos --out audit/runtime-normal-1440.json
node audit/batch.mjs --w 375  --h 812 --shots --dump-demos --out audit/runtime-normal-375.json

# C 节：reduced-motion / 动效关闭 / 亮色主题
node audit/batch.mjs --mode reduced    --w 1440 --shots --out audit/runtime-reduced-1440.json
node audit/batch.mjs --mode reduced    --w 375  --shots --out audit/runtime-reduced-375.json
node audit/batch.mjs --mode motion-off --w 1440 --shots --out audit/runtime-motion-off-1440.json
node audit/batch.mjs --mode light      --w 1440 --shots --out audit/runtime-light-1440.json

# B4 交互抽样（真实鼠标/键盘/拖拽事件）与 C 节对比度
node audit/probe.mjs --mode interact --out audit/interact.json
node audit/probe.mjs --mode contrast --theme dark  --out audit/contrast-dark.json
node audit/probe.mjs --mode contrast --theme light --out audit/contrast-light.json

# 单点复查（复用团队工具，含真实鼠标事件与 CDP 键盘事件）
node tools/cdp.mjs http://127.0.0.1:8912/gestures.html --w 1440 --h 900 --eval "document.documentElement.dataset.motion"
```

辅助脚本：`audit/scan_static.py`（A 节）、`audit/batch.mjs`（B/C 运行时）、`audit/probe.mjs`（交互+对比度）、`audit/interact-cases.json`（交互用例）、`audit/report.py`（本报告生成器）。

## 1. 摘要

| 项 | 结果 |
|---|---|
| 已交付页面 | 13 / 14（缺 page-transitions.html） |
| A 节静态 | A1 FAIL · A2 PASS · A3 FAIL · A4 PASS · A5 PASS · A6 PASS · A7 PASS · A8 PASS · A9 PASS |
| B 节运行时（页面×视口 单元） | 无控制台报错 20 个 · 有报错 4 个 |

## 2. A 节 · 静态一致性

### A1 14 个页面文件齐全 —— ❌ FAIL

- 命令：`python audit/scan_static.py`
- 证据：`audit/static-scan.json` → `pages_found` / `pages_missing`
- 已找到 13 页：index.html, atlas.html, micro-interactions.html, states-feedback.html, scroll-motion.html, navigation.html, forms.html, gestures.html, motion-physics.html, feedback.html, accessibility.html, data-viz.html, design-system.html
- ❌ 缺失：**page-transitions.html**

### A2 结构门槛（DOCTYPE / lang=zh-CN / 唯一 h1 / main#main / a.skip-link / data-page 映射 / 标题层级）—— ✅ PASS

| 页面 | DOCTYPE | lang | h1 数 | main#main | skip-link | data-page | 标题跳级 | 判定 |
|---|---|---|---|---|---|---|---|---|
| index.html | ✔ | zh-CN | 1 | ✔ | ✔ | `index` | 无 | PASS |
| atlas.html | ✔ | zh-CN | 1 | ✔ | ✔ | `atlas` | 无 | PASS |
| micro-interactions.html | ✔ | zh-CN | 1 | ✔ | ✔ | `micro-interactions` | 无 | PASS |
| states-feedback.html | ✔ | zh-CN | 1 | ✔ | ✔ | `states-feedback` | 无 | PASS |
| scroll-motion.html | ✔ | zh-CN | 1 | ✔ | ✔ | `scroll-motion` | 无 | PASS |
| navigation.html | ✔ | zh-CN | 1 | ✔ | ✔ | `navigation` | 无 | PASS |
| forms.html | ✔ | zh-CN | 1 | ✔ | ✔ | `forms` | 无 | PASS |
| gestures.html | ✔ | zh-CN | 1 | ✔ | ✔ | `gestures` | 无 | PASS |
| motion-physics.html | ✔ | zh-CN | 1 | ✔ | ✔ | `motion-physics` | 无 | PASS |
| feedback.html | ✔ | zh-CN | 1 | ✔ | ✔ | `feedback` | 无 | PASS |
| accessibility.html | ✔ | zh-CN | 1 | ✔ | ✔ | `accessibility` | 无 | PASS |
| data-viz.html | ✔ | zh-CN | 1 | ✔ | ✔ | `data-viz` | 无 | PASS |
| design-system.html | ✔ | zh-CN | 1 | ✔ | ✔ | `design-system` | 无 | PASS |

### A3 站内引用存在性（死链）—— ❌ FAIL

| 页面 | 行号 | 引用类型 | 引用 | 解析结果 |
|---|---|---|---|---|
| index.html | L159 | `a[href]` | `page-transitions.html` | `page-transitions.html` |
| atlas.html | L98 | `a[href]` | `page-transitions.html` | `page-transitions.html` |
| scroll-motion.html | L468 | `a[href]` | `page-transitions.html` | `page-transitions.html` |
| scroll-motion.html | L18 | `script[src]` | `assets/js/pages/scroll-motion.inline.js` | `assets/js/pages/scroll-motion.inline.js` |
| navigation.html | L407 | `a[href]` | `page-transitions.html` | `page-transitions.html` |

### A4 必备引用（tokens/motion/site + 自己 pages CSS/JS + motion.js/ui.js/site.js）—— ✅ PASS

- 每页均引用 `tokens.css` `motion.css` `site.css` `pages/<slug>.css` `motion.js` `ui.js` `site.js` `pages/<slug>.js`（存在的 `.inline.js` 也已引用）。

### A5 img alt / 正文 emoji / console.* —— ✅ PASS

| 页面 | `<img>` 数 | 缺 alt | emoji 正文节点 | 内联 console | 判定 |
|---|---|---|---|---|---|
| index.html | 0 | 0 | 0 | 0 | PASS |
| atlas.html | 0 | 0 | 0 | 0 | PASS |
| micro-interactions.html | 0 | 0 | 0 | 0 | PASS |
| states-feedback.html | 0 | 0 | 0 | 0 | PASS |
| scroll-motion.html | 0 | 0 | 0 | 0 | PASS |
| navigation.html | 0 | 0 | 0 | 0 | PASS |
| forms.html | 0 | 0 | 0 | 0 | PASS |
| gestures.html | 0 | 0 | 0 | 0 | PASS |
| motion-physics.html | 0 | 0 | 0 | 0 | PASS |
| feedback.html | 0 | 0 | 0 | 0 | PASS |
| accessibility.html | 0 | 0 | 0 | 0 | PASS |
| data-viz.html | 0 | 0 | 0 | 0 | PASS |
| design-system.html | 0 | 0 | 0 | 0 | PASS |

- JS 文件（`assets/js/**`）中的 `console.*` 调用：0 处

### A6 `assets/css/pages/*.css` 裸 hex 颜色（注释外）—— ✅ PASS

| 文件 | 裸 hex | rgba()/hsl() 字面量 | 判定 |
|---|---|---|---|
| assets/css/pages/accessibility.css | 0 | 0 | PASS |
| assets/css/pages/atlas.css | 0 | 0 | PASS |
| assets/css/pages/data-viz.css | 0 | 0 | PASS |
| assets/css/pages/design-system.css | 0 | 0 | PASS |
| assets/css/pages/feedback.css | 0 | 0 | PASS |
| assets/css/pages/forms.css | 0 | 0 | PASS |
| assets/css/pages/gestures.css | 0 | 0 | PASS |
| assets/css/pages/index.css | 0 | 0 | PASS |
| assets/css/pages/micro-interactions.css | 0 | 0 | PASS |
| assets/css/pages/motion-physics.css | 0 | 0 | PASS |
| assets/css/pages/navigation.css | 0 | 0 | PASS |
| assets/css/pages/scroll-motion.css | 0 | 0 | PASS |
| assets/css/pages/states-feedback.css | 0 | 0 | PASS |

### A7 外部网络请求（script / stylesheet / @import，Google Fonts 白名单）—— ✅ PASS

- 全站无第三方 `http(s)://` 脚本/样式：字体仅经 `tokens.css` 的 Google Fonts `@import`，离线时回落到系统字体栈。

### A8 标签闭合 —— ✅ PASS

- 13 页均无未闭合/多余闭合标签（HTMLParser 栈式校验，允许 HTML5 可选闭合元素）。

### A9 favicon 引用（避免 /favicon.ico 404 控制台噪声）—— ✅ PASS

- 每页均声明 `<link rel="icon" href="assets/favicon.svg">`；运行时未再出现 favicon 404。

## 3. B 节 · 运行时（每页 × 1440×900 与 375×812）

### B-1440×900 控制台 / 溢出 / 结构

命令：`node audit/batch.mjs --w 1440 --h 900 --shots --dump-demos --out audit/runtime-normal-1440.json`

| 页面 | consoleErrors | pageErrors | overflowX | 未裁剪越界元素 | header | footer | palette | demos/specs | emoji | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| index | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 0/0 | 0 | PASS |
| atlas | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 0/0 | 0 | PASS |
| micro-interactions | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 16/16 | 0 | PASS |
| states-feedback | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| scroll-motion | — | — | — | — | — | — | — | — | — | 未交付/无法加载 |
| page-transitions | — | — | — | — | — | — | — | — | — | 未交付/无法加载 |
| navigation | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| forms | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 15/15 | 0 | PASS |
| gestures | 3 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | FAIL |
| motion-physics | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| feedback | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| accessibility | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 13/13 | 0 | PASS |
| data-viz | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 11/11 | 0 | PASS |
| design-system | 1 | 0 | False | 0 | ✔ | ✔ | ✔ | 4/4 | 0 | FAIL |

控制台报错明细：

- ❌ `gestures`：Failed to load resource: the server responded with a status of 404 (File not found) http://127.0.0.1:8912/assets/css/pages/gestures.css
- ❌ `gestures`：Failed to load resource: the server responded with a status of 404 (File not found) http://127.0.0.1:8912/assets/js/pages/gestures.js
- ❌ `gestures`：Failed to load resource: the server responded with a status of 404 (File not found) http://127.0.0.1:8912/assets/js/pages/gestures.inline.js
- ❌ `design-system`：Failed to load resource: the server responded with a status of 404 (File not found) http://127.0.0.1:8912/assets/js/pages/design-system.js

越界元素明细（`overflowItems`）：

- `doc.scrollWidth > window.innerWidth + 1` 的页面：无
- 存在被裁剪装饰性越界的页面：index(64 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)；states-feedback(1 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)

### B-375×812 控制台 / 溢出 / 结构

命令：`node audit/batch.mjs --w 375 --h 812 --shots --dump-demos --out audit/runtime-normal-375.json`

| 页面 | consoleErrors | pageErrors | overflowX | 未裁剪越界元素 | header | footer | palette | demos/specs | emoji | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| index | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 0/0 | 0 | PASS |
| atlas | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 0/0 | 0 | PASS |
| micro-interactions | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 16/16 | 0 | PASS |
| states-feedback | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| scroll-motion | — | — | — | — | — | — | — | — | — | 未交付/无法加载 |
| page-transitions | — | — | — | — | — | — | — | — | — | 未交付/无法加载 |
| navigation | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| forms | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 15/15 | 0 | PASS |
| gestures | 2 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | FAIL |
| motion-physics | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| feedback | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 12/12 | 0 | PASS |
| accessibility | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 13/13 | 0 | PASS |
| data-viz | 0 | 0 | False | 0 | ✔ | ✔ | ✔ | 11/11 | 0 | PASS |
| design-system | 1 | 0 | False | 0 | ✔ | ✔ | ✔ | 4/4 | 0 | FAIL |

控制台报错明细：

- ❌ `gestures`：Failed to load resource: the server responded with a status of 404 (File not found) http://127.0.0.1:8912/assets/js/pages/gestures.inline.js
- ❌ `gestures`：Failed to load resource: the server responded with a status of 404 (File not found) http://127.0.0.1:8912/assets/js/pages/gestures.js
- ❌ `design-system`：Failed to load resource: the server responded with a status of 404 (File not found) http://127.0.0.1:8912/assets/js/pages/design-system.js

越界元素明细（`overflowItems`）：

- `doc.scrollWidth > window.innerWidth + 1` 的页面：无
- 存在被裁剪装饰性越界的页面：index(123 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)；states-feedback(1 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)；navigation(11 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)；feedback(35 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)；accessibility(45 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)；data-viz(42 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)；design-system(57 个，全部被 `overflow:hidden/clip` 祖先裁剪，不产生页面级横向滚动)

### B4 关键 demo 真实交互抽样（`--click` 真实鼠标事件 / CDP 键盘 / 拖拽）

（缺少 audit/interact.json）

## 4. C 节 · 降级与主题

### C1 prefers-reduced-motion: reduce（1440×900，`Emulation.setEmulatedMedia`）

（缺少 audit/runtime-reduced-1440.json）

### C1 prefers-reduced-motion: reduce（375×812，`Emulation.setEmulatedMedia`）

（缺少 audit/runtime-reduced-375.json）

### C2 站内动效三档：`ML.motion.set('off')`

（缺少 audit/runtime-motion-off-1440.json）
### C3 亮色主题（`#btn-theme` 点击后）

（缺少 audit/runtime-light-1440.json）
### C4 颜色对比度抽查（WCAG 2.1，运行时真实计算）

#### 暗色（默认） 主题

（缺少 audit/contrast-dark.json）

#### 亮色（点击 #btn-theme 后） 主题

（缺少 audit/contrast-light.json）

## 5. 证据索引

### 截图 `audit/shots/`

| 文件 | 说明 |
|---|---|
| `audit/shots/accessibility-1440.png` | accessibility-1440 |
| `audit/shots/accessibility-375.png` | accessibility-375 |
| `audit/shots/atlas-1440.png` | atlas-1440 |
| `audit/shots/atlas-375.png` | atlas-375 |
| `audit/shots/data-viz-1440.png` | data-viz-1440 |
| `audit/shots/data-viz-375.png` | data-viz-375 |
| `audit/shots/design-system-1440.png` | design-system-1440 |
| `audit/shots/design-system-375.png` | design-system-375 |
| `audit/shots/feedback-1440.png` | feedback-1440 |
| `audit/shots/feedback-375.png` | feedback-375 |
| `audit/shots/forms-1440.png` | forms-1440 |
| `audit/shots/forms-375.png` | forms-375 |
| `audit/shots/gestures-1440.png` | gestures-1440 |
| `audit/shots/gestures-375.png` | gestures-375 |
| `audit/shots/ijkl-accessibility-1440-full.png` | ijkl-accessibility-1440-full |
| `audit/shots/ijkl-accessibility-375.png` | ijkl-accessibility-375 |
| `audit/shots/ijkl-data-viz-1440-full.png` | ijkl-data-viz-1440-full |
| `audit/shots/ijkl-data-viz-375.png` | ijkl-data-viz-375 |
| `audit/shots/ijkl-data-viz-reduced-1440.png` | ijkl-data-viz-reduced-1440 |
| `audit/shots/ijkl-design-system-1440-full.png` | ijkl-design-system-1440-full |
| `audit/shots/ijkl-design-system-1440.png` | ijkl-design-system-1440 |
| `audit/shots/ijkl-design-system-375.png` | ijkl-design-system-375 |
| `audit/shots/ijkl-feedback-1440-full.png` | ijkl-feedback-1440-full |
| `audit/shots/ijkl-feedback-1440.png` | ijkl-feedback-1440 |
| `audit/shots/ijkl-feedback-375.png` | ijkl-feedback-375 |
| `audit/shots/index-1440.png` | index-1440 |
| `audit/shots/index-375.png` | index-375 |
| `audit/shots/kernel-1440.png` | kernel-1440 |
| `audit/shots/kernel-375.png` | kernel-375 |
| `audit/shots/kernel-375b.png` | kernel-375b |
| `audit/shots/kernel-dialog.png` | kernel-dialog |
| `audit/shots/kernel-light.png` | kernel-light |
| `audit/shots/kernel-palette.png` | kernel-palette |
| `audit/shots/kernel-palette2.png` | kernel-palette2 |
| `audit/shots/kernel-reduced.png` | kernel-reduced |
| `audit/shots/lead-index-full.png` | lead-index-full |
| `audit/shots/lead-index-full2.png` | lead-index-full2 |
| `audit/shots/lead-index-full3.png` | lead-index-full3 |
| `audit/shots/lead-micro-full.png` | lead-micro-full |
| `audit/shots/micro-interactions-1440.png` | micro-interactions-1440 |
| `audit/shots/micro-interactions-375.png` | micro-interactions-375 |
| `audit/shots/motion-physics-1440.png` | motion-physics-1440 |
| `audit/shots/motion-physics-375.png` | motion-physics-375 |
| `audit/shots/navigation-1440.png` | navigation-1440 |
| `audit/shots/navigation-375.png` | navigation-375 |
| `audit/shots/states-feedback-1440.png` | states-feedback-1440 |
| `audit/shots/states-feedback-375.png` | states-feedback-375 |

命名规则：`<page>-<viewport>[-reduced|-motion-off|-light].png`。

### JSON 产物

- `audit/static-scan.json`
- `audit/runtime-normal-1440.json`
- `audit/runtime-normal-375.json`
- `audit/runtime-reduced-1440.json`（缺失）
- `audit/runtime-reduced-375.json`（缺失）
- `audit/runtime-motion-off-1440.json`（缺失）
- `audit/runtime-light-1440.json`（缺失）
- `audit/interact.json`（缺失）
- `audit/contrast-dark.json`（缺失）
- `audit/contrast-light.json`（缺失）

### 自检脚本

- `audit/scan_static.py`
- `audit/batch.mjs`
- `audit/probe.mjs`
- `audit/interact-cases.json`
- `audit/report.py`

## 6. FAIL 汇总（按责任人）

### infra-pages

1. A3 死链：`index.html` L159 a[href] `page-transitions.html`
2. A3 死链：`atlas.html` L98 a[href] `page-transitions.html`

### pages-abcd

1. A1 页面文件缺失：`page-transitions.html`
2. A3 死链：`scroll-motion.html` L468 a[href] `page-transitions.html`
3. A3 死链：`scroll-motion.html` L18 script[src] `assets/js/pages/scroll-motion.inline.js`
4. B 1440：页面未交付
5. B 1440：页面未交付
6. B 375：页面未交付
7. B 375：页面未交付

### pages-efgh

1. A3 死链：`navigation.html` L407 a[href] `page-transitions.html`
2. B 1440：consoleErrors ['Failed to load resource: the server responded with a status of 404 (File not fou', 'Failed to load resource: the server responded with a status of 404 (File not fou', 'Failed to load resource: the server responded with a status of 404 (File not fou']
3. B 375：consoleErrors ['Failed to load resource: the server responded with a status of 404 (File not fou', 'Failed to load resource: the server responded with a status of 404 (File not fou']

### pages-ijkl

1. B 1440：关键内容隐藏 [('div.a11y-carousel__slide', '02 · 落地 token\n'), ('div.a11y-carousel__slide', '03 · 键盘与读屏验收\n '), ('div.a11y-carousel__slide', '04 · 交付规格标注\n  ')]
2. B 1440：consoleErrors ['Failed to load resource: the server responded with a status of 404 (File not fou']
3. B 375：关键内容隐藏 [('div.a11y-carousel__slide', '02 · 落地 token\n'), ('div.a11y-carousel__slide', '03 · 键盘与读屏验收\n '), ('div.a11y-carousel__slide', '04 · 交付规格标注\n  ')]
4. B 375：consoleErrors ['Failed to load resource: the server responded with a status of 404 (File not fou']

## 7. 方法与限制

- 运行时使用真实 Chromium + CDP：`--click` 为 `Input.dispatchMouseEvent` 真实鼠标事件（含 `scrollIntoView` 后按元素中心点计算坐标），键盘为 `Input.dispatchKeyEvent`（rawKeyDown/char/keyUp），拖拽为 `mousePressed → 8×mouseMoved → mouseReleased`。
- 每个交互用例执行前都会重新导航该页面，避免用例间状态污染。
- 横向溢出判定分两层：① 页面级 `documentElement.scrollWidth > innerWidth + 1`；② 逐元素 `getBoundingClientRect()` 越界且**没有任何 `overflow != visible` 的祖先裁剪它**。装饰层（如首屏网格/光晕、横向滚动列表）若被祖先裁剪，只作为观察项记录，不判 FAIL。
- 控制台错误以 CDP `Log.entryAdded(level=error)` + `Runtime.consoleAPICalled(type=error)` + `Runtime.exceptionThrown` 三路采集；favicon 404 亦计入（页面若声明 `<link rel="icon">` 即不触发）。
- `--reduced` 通过 `Emulation.setEmulatedMedia({prefers-reduced-motion:'reduce'})` 模拟系统偏好，内核应据此切到 `data-motion=lite`。
- 对比度按 WCAG 2.1：取元素 `color` 与最近不透明祖先 `background-color`，alpha<1 的前景先做合成；大字阈值 3.0:1（≥24px，或 ≥18.66px 且字重 ≥700），其余 4.5:1。渐变/图片背景不参与计算（会标注来源元素）。
- 本报告只反映生成时刻的工作区状态；页面文件在验证期间仍在被其他成员写入，最终验收需在冻结后复跑上述命令。
