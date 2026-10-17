/* 展厅 L · 设计系统 — 首屏同步脚本（极小，只放静态数据表） */
(function () {
  'use strict';
  document.documentElement.setAttribute('data-ds', 'ready');

  window.__ML_DS__ = {
    /* 色彩 token：值与对比度均由页面脚本实时读取 / 计算，这里只定义"有哪些"与用途 */
    colors: [
      { token: '--ink-900', use: '页面底色', paper: false },
      { token: '--ink-850', use: '次级底色', paper: false },
      { token: '--ink-800', use: '面板 / 卡片', paper: false },
      { token: '--ink-700', use: '抬升面板 / 输入框', paper: false },
      { token: '--ink-600', use: '分隔线 / 描边（--line）', paper: false },
      { token: '--paper', use: '主文字（暖白，不刺眼）', paper: true },
      { token: '--paper-dim', use: '次级主文字', paper: true },
      { token: '--muted', use: '次级文字', paper: true },
      { token: '--faint', use: '三级文字 / 禁用（仅 ≥18px 或非正文）', paper: true },
      { token: '--accent', use: '主动作 / 焦点 / 品牌信号', paper: true },
      { token: '--accent-strong', use: '强调悬停态', paper: true },
      { token: '--success', use: '成功', paper: true },
      { token: '--warning', use: '警告', paper: true },
      { token: '--danger', use: '错误 / 危险', paper: true },
      { token: '--info', use: '信息 / 图表第二色', paper: true }
    ],
    /* 字体阶梯：真实渲染 + 实时量取 px */
    type: [
      { token: '--fs-display', name: 'Display', role: '首屏巨字', sample: '丝滑不是感觉 Motion 0123', lh: '--lh-display', ls: '--ls-display' },
      { token: '--fs-h1', name: 'H1', role: '页面主标题', sample: '无障碍交互 Motion 0123', lh: '1.04', ls: '--ls-h1' },
      { token: '--fs-h2', name: 'H2', role: '区块标题', sample: '反馈系统与状态 Lab 0123', lh: '--lh-heading', ls: '--ls-h2' },
      { token: '--fs-h3', name: 'H3', role: '卡片标题', sample: '确认对话框 Dialog 0123', lh: '1.3', ls: '--ls-h3' },
      { token: '--fs-lede', name: 'Lede', role: '导语', sample: '把高级感拆解成可交付的规格。', lh: '1.6', ls: '0' },
      { token: '--fs-body', name: 'Body', role: '正文', sample: '正文基准 16px，移动端不低于 16px，行长 60–75 字符。', lh: '--lh-body', ls: '0' },
      { token: '--fs-sm', name: 'Small', role: '辅助文字', sample: '辅助说明：规格表中的降级行为写在这一级。', lh: '1.55', ls: '0' },
      { token: '--fs-xs', name: 'XSmall', role: '标记 / chip', sample: 'chip 与 badge 使用的字号。', lh: '1.5', ls: '0' },
      { token: '--fs-label', name: 'Label', role: '技术标注（大写）', sample: 'MOTION LAB SPEC', lh: '--lh-label', ls: '--ls-label' },
      { token: '--fs-mono', name: 'Mono', role: '参数表 / 代码', sample: '--dur-base: 240ms; cubic-bezier(.22,1,.36,1)', lh: '1.6', ls: '0' }
    ],
    spaces: ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--space-8', '--space-9', '--space-10'],
    layoutTokens: ['--container', '--container-wide', '--gutter', '--col-gap', '--control-h', '--header-h', '--section-gap'],
    radii: ['--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-pill'],
    shadows: ['--shadow-1', '--shadow-2', '--shadow-3', '--glow-accent', '--glow-soft'],
    durations: [
      { token: '--dur-instant', use: '按压反馈、开关收尾' },
      { token: '--dur-fast', use: 'hover、颜色、图标微动' },
      { token: '--dur-base', use: '通用微交互、状态切换' },
      { token: '--dur-slow', use: '抽屉、面板、模态进入' },
      { token: '--dur-slower', use: '页面级、区块揭示' }
    ],
    easings: [
      { token: '--ease-out-quint', use: '进入（默认）' },
      { token: '--ease-out-expo', use: '大位移进入' },
      { token: '--ease-in-quad', use: '退出' },
      { token: '--ease-in-out-quart', use: '对称位移' },
      { token: '--ease-spring-soft', use: '轻微过冲（≤5%）' },
      { token: '--ease-snap', use: '快速吸附 / 分段控件' }
    ],
    springs: [
      { preset: 'snap', stiffness: 520, damping: 30, mass: 0.7, use: '开关、分段控件、滑块' },
      { preset: 'standard', stiffness: 340, damping: 28, mass: 1, use: '卡片、面板、默认' },
      { preset: 'soft', stiffness: 170, damping: 24, mass: 1.2, use: '渐进揭示、大面板' },
      { preset: 'playful', stiffness: 420, damping: 17, mass: 1, use: '强调反馈、点赞（故意欠阻尼 ~6% 过冲）' }
    ],
    zlayers: [
      { token: '--z-base', use: '普通文档流' },
      { token: '--z-sticky', use: '粘性标题、吸顶子导航' },
      { token: '--z-header', use: '站点页头' },
      { token: '--z-overlay', use: '弹出层、工具提示、下拉' },
      { token: '--z-drawer', use: '侧边抽屉' },
      { token: '--z-modal', use: '对话框、遮罩' },
      { token: '--z-toast', use: 'Toast 通知' },
      { token: '--z-palette', use: '命令面板、跳转链接' },
      { token: '--z-noise', use: '颗粒纹理（纯装饰，永不遮挡交互）' }
    ],
    states: [
      { key: 'default', name: 'Default', visual: '实心强调色 + 白字', aria: '无附加语义', click: '是', focus: '是', announce: '否' },
      { key: 'hover', name: 'Hover', visual: '提亮 6% + 光晕', aria: '无（纯指针反馈）', click: '是', focus: '是', announce: '否' },
      { key: 'active', name: 'Active', visual: 'scale(0.97) 按压', aria: ':active 伪类', click: '是', focus: '是', announce: '否' },
      { key: 'focus', name: 'Focus', visual: '2px accent 描边 + 3px 偏移', aria: ':focus-visible', click: '是', focus: '是', announce: '否' },
      { key: 'disabled', name: 'Disabled', visual: '降低不透明度、无光晕', aria: 'disabled 属性', click: '否', focus: '否', announce: '读屏会跳过' },
      { key: 'loading', name: 'Loading', visual: '转圈图标替换文字', aria: 'aria-busy="true"', click: '否', focus: '否', announce: '是（忙碌状态）' },
      { key: 'error', name: 'Error', visual: '危险色描边 + 图标', aria: 'aria-invalid="true"', click: '是', focus: '是', announce: '是（错误描述）' },
      { key: 'readonly', name: 'Readonly', visual: '降低对比度但保留文字', aria: 'readonly 属性', click: '否', focus: '是', announce: '是（只读）' }
    ],
    checklist: [
      { id: 'c1', text: '正文对比度 ≥ 4.5:1（大字与界面图形 ≥ 3:1）', auto: 'contrast' },
      { id: 'c2', text: '所有交互元素有可见的 :focus-visible 焦点环', auto: 'focus' },
      { id: 'c3', text: '触控目标 ≥ 44×44px，相邻间距 ≥ 8px', auto: 'targets' },
      { id: 'c4', text: '每页唯一 h1，标题层级不跳级', auto: null },
      { id: 'c5', text: '<main id="main"> 与 a.skip-link 存在且可用', auto: null },
      { id: 'c6', text: '状态不只靠颜色，同时有图标 / 文字 / 纹理', auto: null },
      { id: 'c7', text: '模态与抽屉：焦点锁定、Esc 关闭、关闭后还原焦点', auto: null },
      { id: 'c8', text: 'prefers-reduced-motion 与站内三档开关均不破版', auto: 'motion' },
      { id: 'c9', text: '无横向滚动，无位图图标，无 emoji 图标', auto: null },
      { id: 'c10', text: '每个 demo 都有规格标注（触发 / 时长 / 缓动 / 属性 / 降级）', auto: null }
    ],
    flags: [
      { title: '无 scroll-jacking', reason: '接管滚轮会破坏用户对"我滚了多少"的肌肉记忆，也让触控板与键盘用户彻底失控。', alt: '用普通的滚动 + IntersectionObserver 揭示，把节奏交给用户。' },
      { title: '无 emoji 图标', reason: 'emoji 在不同平台字形不同，无法随 currentColor 变色，读屏软件还会把它念成"派对拉炮"之类的怪词。', alt: '一律内联 SVG：24×24 viewBox、stroke-width 1.5、currentColor。' },
      { title: '无无限装饰动画', reason: '视线会被持续运动的东西吸住，注意力无法回到内容上；也让前庭敏感用户难受。', alt: '唯一例外是 loader / 骨架屏这类"确实在等"的状态指示，且必须在 reduced-motion 下静止。' },
      { title: '无布局抖动', reason: '动画 width / height / top / left 会触发布局重排，一帧内可能让整个页面重算。', alt: '只动 transform / opacity / filter 与 CSS 变量，全部落在合成层。' },
      { title: '无横向滚动', reason: '横向滚动意味着布局已经错了，只是被藏起来了。', alt: '真正的溢出发生在表格与代码块内部，用带 tabindex 与 aria-label 的滚动区域承载。' },
      { title: '无仅靠颜色的语义', reason: '约 8% 的男性有某种程度的色觉障碍，灰阶之下纯色编码会完全失效。', alt: '颜色 + 图标形状 + 文字标签三重编码，去掉任意一层仍可读。' },
      { title: '无位图资源', reason: '位图无法随主题变色、在高 DPI 下模糊、体积还不小。', alt: '全部图形用 CSS 与内联 SVG 绘制，缩放不失真。' },
      { title: '无外部请求与依赖', reason: '一个 fetch 就让 file:// 双击打不开，也让离线评审变成不可能。', alt: '所有演示数据内联手写，字体走系统兜底，零构建、零框架。' },
      { title: 'linear 不用于 UI 过渡', reason: '线性运动在视觉上会显得机械且"没有开始也没有结束"。', alt: 'linear 只保留给进度条与 marquee；UI 过渡一律 ease-out 进入、ease-in 退出。' },
      { title: '退出永远快于进入', reason: '用户关闭一个东西时已经决定了，慢吞吞的退场只会让人等。', alt: '--exit-factor: 0.68 —— 进入 360ms 则退出 245ms。' }
    ]
  };
})();
