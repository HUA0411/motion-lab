/* 展厅 K · 数据可视化 — 首屏同步脚本（极小，不触碰 DOM 结构） */
(function () {
  'use strict';
  var root = document.documentElement;
  root.setAttribute('data-viz', 'ready');

  /* 页面渲染引擎与数据层的静态前置数据（内联手写，禁止任何网络请求） */
  window.__ML_VIZ__ = {
    /* 三渠道：名称 + 线型（不只用颜色区分系列） */
    series: [
      { key: 'direct', name: '直接访问', color: 'var(--accent)', dash: 'none', marker: 'circle' },
      { key: 'search', name: '搜索', color: 'var(--info)', dash: '8 5', marker: 'square' },
      { key: 'referral', name: '推荐', color: 'var(--success)', dash: '2 5', marker: 'triangle' }
    ],
    areaSeries: [
      { key: 'search', name: '搜索', color: 'var(--info)', dash: '8 5', marker: 'square' },
      { key: 'referral', name: '推荐', color: 'var(--success)', dash: '2 5', marker: 'triangle' }
    ],
    /* 确定性伪随机种子：同一份数据每次刷新都一样，便于复核 */
    seed: 20241108,
    startDate: '2024-01-01',
    days: 365,
    grain: {
      day: { label: '日', buckets: 365 },
      week: { label: '周', buckets: 53 },
      month: { label: '月', buckets: 12 }
    },
    /* 规模策略阈值（对齐 ui-ux-pro-max 图表库的 data volume threshold） */
    thresholds: { svgMax: 1000, aggregateOver: 10000, bucketTarget: 60 }
  };
})();
