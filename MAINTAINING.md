# 开源仓库说明（维护者用）

本文件面向仓库维护者，说明如何发布与复验。站点使用者请看 [README.md](README.md)。

## 一键在线预览（GitHub Pages）

静态站不需要任何构建步骤。仓库已内置工作流 [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)：

1. 打开仓库 **Settings → Pages**
2. **Source** 选择 **GitHub Actions**（不要选 "Deploy from a branch"）
3. 回到 **Actions** 页，等待 `Deploy static site to Pages` 跑完
4. 访问 `https://HUA0411.github.io/motion-lab/`

之后每次 `git push origin main` 都会自动重新部署（约 40 秒）。

> 也可以用任意静态托管：Netlify / Vercel / Cloudflare Pages 只需把仓库根目录作为发布目录，
> 不需要 build command、不需要环境变量。

## 本地复验（可选，需要 Node.js 与 Python）

```bash
# 1) 起静态服务（file:// 双击也能跑，但起服务更接近真实环境）
python -m http.server 8912 --bind 127.0.0.1

# 2) 无头浏览器体检：控制台报错 / 横向溢出 / 结构 / 截图
node tools/cdp.mjs "http://127.0.0.1:8912/index.html" --w 1440 --h 900 --wait 1800 --shot audit/shots/index-1440.png

# 3) 降级验证（模拟 prefers-reduced-motion: reduce）
node tools/cdp.mjs "http://127.0.0.1:8912/index.html" --reduced

# 4) 弹簧物理内核离线验证（11 个用例，不需要浏览器）
node audit/verify-spring.mjs

# 5) 双主题全站对比度扫描
node audit/lead-contrast.mjs --theme dark
node audit/lead-contrast.mjs --theme light
```

`tools/cdp.mjs` 依赖 `ws`（仅测试工具需要，站点本身零依赖）：

```bash
cd tools
npm install            # 或 npm i ws
```

## 目录约定

- **页面只写结构与文案**，颜色 / 时长 / 缓动一律引用 `assets/css/tokens.css` 中的 token。
- 禁止裸 hex、禁止自定义缓动、禁止 emoji 图标（图标走 `ML.UI.icon()`）。
- 新增页面时复制一份 `assets/css/pages/<slug>.css` 与 `assets/js/pages/<slug>.js`，
  并在 `assets/js/site.js` 的 `SITES` 数组中登记（导航 / 命令面板 / 页脚会自动出现）。
- 每个 demo 必须带 `.demo__spec` 规格标注（触发 / 时长 / 缓动 / 属性 / 降级）。

## 提交规范

- `feat:` 功能、`fix:` 修复、`docs:` 文档、`style:` 样式、`refactor:` 重构、`chore:` 杂项
- 一次提交只做一件事；改动 demo 行为时同步更新对应的规格标注。
