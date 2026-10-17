/* ============================================================================
   展厅 A · 微交互 —— 首屏同步脚本
   在 <head> 中同步执行（早于 body 解析），职责只有两件：
   ① 标记 JS 可用，让「需要脚本」的样式分支不会误显；
   ② 在首帧之前恢复用户上次的选择，避免开关 / 分段控件的状态闪跳。
   不访问 DOM 结构，不做网络请求。
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  html.classList.add('has-js');

  try {
    var stored = window.localStorage.getItem('ml-mi-state');
    if (stored) {
      var parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.switch === 'boolean') {
          html.setAttribute('data-mi-switch', parsed.switch ? 'on' : 'off');
        }
        if (typeof parsed.seg === 'number' && parsed.seg >= 0 && parsed.seg <= 2) {
          html.setAttribute('data-mi-seg', String(parsed.seg));
        }
      }
    }
  } catch (err) {
    /* 隐私模式 / 存储被禁用：静默回落到默认值，不影响页面可用性 */
  }
})();
