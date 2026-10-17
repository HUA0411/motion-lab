/* 展厅 E · 首屏同步初始化（<head> 内执行：DOM 主体尚不存在，只碰 documentElement / window） */
(function () {
  'use strict';
  var el = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
  el.classList.add('np-js');
  el.style.setProperty('--np-exit-factor', '0.68');
  el.setAttribute('data-np-hydrated', 'inline');
  window.__ML_NAV__ = { page: 'navigation', systemReduced: reduce, exitFactor: 0.68 };
})();
