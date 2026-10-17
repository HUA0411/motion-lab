/* 展厅 J · 无障碍交互 — 首屏同步脚本（防 FOUC，必须极小、不得触碰 DOM 结构） */
(function () {
  'use strict';
  var root = document.documentElement;
  root.setAttribute('data-a11y', 'ready');
  root.classList.add('a11y-js');

  window.__ML_A11Y__ = {
    /* 对比度检测器预置色对（全部为可复核的真实组合，非装饰文案） */
    presets: [
      { name: 'accent on ink-900', fg: '#FF6B2C', bg: '#0A0B0D' },
      { name: 'paper on ink-900', fg: '#F5F2EA', bg: '#0A0B0D' },
      { name: 'muted on ink-900', fg: '#7C7F84', bg: '#0A0B0D' },
      { name: 'accent-strong on paper（亮色）', fg: '#C2410C', bg: '#F5F2EA' },
      { name: 'faint on ink-900（本系统三级文字）', fg: '#4A4D52', bg: '#0A0B0D' },
      { name: '反例：浅灰 on 白', fg: '#999999', bg: '#FFFFFF' },
      { name: '反例：纯蓝 on 纯黑', fg: '#0000CC', bg: '#000000' },
      { name: '反例：品牌绿 on 白', fg: '#22C55E', bg: '#FFFFFF' }
    ],
    /* 触控目标标尺：仅数据，DOM 由页面静态写出 */
    targetRule: { min: 44, note: 'WCAG 2.5.8 只要求 24×24 CSS px，本设计系统自设更严的 44×44。' },
    /* 快捷键表中「本站真实存在」的键位 */
    shortcuts: [
      { keys: ['⌘', 'K'], alt: ['Ctrl', 'K'], action: '打开命令面板', scope: '全站（内核提供）' },
      { keys: ['Esc'], alt: [], action: '关闭面板 / 对话框 / 取消轮播悬停', scope: '全站（内核提供）' },
      { keys: ['Tab'], alt: ['Shift', 'Tab'], action: '正向 / 反向遍历可聚焦元素', scope: '浏览器原生' },
      { keys: ['↑', '↓'], alt: [], action: '命令面板列表与 tabs 内移动选项', scope: '内核 + 本页 tabs' },
      { keys: ['↵'], alt: ['Space'], action: '激活当前项（tabs 自动选中）', scope: '本页 12 号 demo' }
    ]
  };
})();
