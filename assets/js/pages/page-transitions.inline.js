/* ============================================================================
   展厅 D · 页面转场 —— 首屏同步脚本
   在 <head> 中同步执行（早于 body 解析），职责只有两件：
   ① 标记 JS 可用；
   ② 在首帧之前恢复路由参数试验台的时长偏好，让 --route-dur 一开始就是对的。
   只碰 documentElement，不做网络请求，不写 console。
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  html.classList.add('has-js');

  try {
    var dur = window.localStorage.getItem('ml-pt-dur');
    if (dur !== '240' && dur !== '360' && dur !== '560') dur = '360';
    html.setAttribute('data-pt-dur', dur);
    var dir = window.localStorage.getItem('ml-pt-route-dir');
    html.setAttribute('data-pt-route-dir', dir === 'back' ? 'back' : 'forward');
  } catch (err) {
    html.setAttribute('data-pt-dur', '360');
    html.setAttribute('data-pt-route-dir', 'forward');
  }
})();
