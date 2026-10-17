/* 展厅 I · 反馈系统 — 首屏同步脚本（极小，不触碰 DOM 结构） */
(function () {
  'use strict';
  document.documentElement.setAttribute('data-feedback', 'ready');

  window.__ML_FB__ = {
    /* Toast 栈演示的真实参数（时长落在 3–5s 的可用区间内） */
    toastPlan: [
      { variant: 'info', title: '草稿已保存', desc: '10:24 自动保存，可继续编辑。', duration: 3600 },
      { variant: 'success', title: '构建 #412 通过', desc: '38 项检查全部通过。', duration: 4000 },
      { variant: 'warning', title: '3 张图片缺少替代文本', desc: '发布前需要处理。', duration: 4600 },
      { variant: 'danger', title: '构建 #410 失败', desc: '第 2 步类型检查未通过。', duration: 5000 }
    ],
    /* 通知中心初始数据（未读徽标据此计算） */
    notifications: [
      { id: 'n1', title: '构建 #412 已通过', desc: 'main 分支 · 4 分 12 秒', time: '10:24', read: false, variant: 'success' },
      { id: 'n2', title: '构建 #410 失败', desc: '第 2 步类型检查 · 可重试', time: '09:51', read: false, variant: 'danger' },
      { id: 'n3', title: '对比度审计完成', desc: '发现 2 处低于 4.5:1', time: '09:12', read: false, variant: 'warning' },
      { id: 'n4', title: '受访者 A 提交了反馈', desc: '「侧栏折叠后找不到设置项」', time: '昨天', read: true, variant: 'info' },
      { id: 'n5', title: '本周动效参数已冻结', desc: '--dur-* / --ease-* 不再变更', time: '周一', read: true, variant: 'info' }
    ],
    /* 警告横幅文案（内联，无网络请求） */
    banners: [
      { variant: 'info', title: '信息', text: '这套组件库处于 v1.0 冻结期，只接受缺陷修复。' },
      { variant: 'success', title: '成功', text: '全部 38 项检查通过，可以发布到预览环境。' },
      { variant: 'warning', title: '警告', text: '3 张图片缺少替代文本，发布会被 CI 拦下。' },
      { variant: 'danger', title: '危险', text: '构建 #410 失败：第 2 步类型检查未通过。' }
    ]
  };
})();
