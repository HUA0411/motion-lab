/* MOTION LAB · atlas.html 首屏同步脚本
   唯一职责：同步标记 html，让结果列表在脚本渲染前先占住版面高度，
   避免首屏（或脚本异常时）出现无谓的布局跳动。 */
(function () {
  'use strict';
  document.documentElement.classList.add('atl-boot');
})();
