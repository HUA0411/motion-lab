/* MOTION LAB · index.html 首屏同步脚本
   唯一职责：在样式与应用脚本之间打一个同步标记，让首屏「逐词进入」动画只在
   有意义时启用（无 JS 时标题保持完全可见，不会白屏）。必须极小、无副作用。 */
(function () {
  'use strict';
  document.documentElement.classList.add('ix-boot');
})();
