/* ============================================================================
   展厅 B · 状态与反馈 —— 首屏同步脚本
   在 <head> 中同步执行（早于 body 解析），职责只有两件：
   ① 标记 JS 可用，让「需要脚本」的样式分支不会误显；
   ② 在首帧之前恢复用户上次所处的状态演示，避免状态块与面板内容闪跳。
   不访问 DOM 结构，不做网络请求，不写 console。
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  html.classList.add('has-js');

  try {
    var stored = window.localStorage.getItem('ml-sf-state');
    if (stored) {
      var parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.offline === 'boolean') {
          html.setAttribute('data-sf-offline', parsed.offline ? 'on' : 'off');
        }
        if (typeof parsed.perm === 'string' && /^(locked|pending|granted)$/.test(parsed.perm)) {
          html.setAttribute('data-sf-perm', parsed.perm);
        }
      }
    }
  } catch (err) {
    /* 隐私模式 / 存储被禁用：静默回落到默认值，不影响页面可用性 */
  }
})();
