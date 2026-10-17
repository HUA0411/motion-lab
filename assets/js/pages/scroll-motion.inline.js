/* ============================================================================
   展厅 C · 滚动与视差叙事 —— 首屏同步脚本
   在 <head> 中同步执行（早于 body 解析），职责只有两件：
   ① 标记 JS 可用；
   ② 在首帧之前恢复「吸附 / 自由滚动」偏好，让内部滚动容器不会先吸附再跳一次。
   只碰 documentElement，不做网络请求，不写 console。
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  html.classList.add('has-js');

  try {
    var snap = window.localStorage.getItem('ml-sm-snap');
    if (snap === 'free' || snap === 'locked') {
      html.setAttribute('data-sm-snap', snap);
    } else {
      html.setAttribute('data-sm-snap', 'locked');
    }
  } catch (err) {
    html.setAttribute('data-sm-snap', 'locked');
  }
})();
