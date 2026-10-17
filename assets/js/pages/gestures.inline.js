/* 展厅 G · 首屏同步初始化（<head> 内执行：DOM 主体尚不存在，只碰 documentElement / window） */
(function () {
  'use strict';
  var el = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
  el.classList.add('gp-js');
  el.style.setProperty('--gp-threshold-dead', '8px');
  el.style.setProperty('--gp-threshold-confirm', '40px');
  el.setAttribute('data-gp-hydrated', 'inline');
  window.__ML_GESTURES__ = { page: 'gestures', systemReduced: reduce, dead: 8, confirm: 40 };
})();
