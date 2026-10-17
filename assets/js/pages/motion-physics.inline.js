/* 展厅 H · 首屏同步初始化（<head> 内执行：DOM 主体尚不存在，只碰 documentElement / window） */
(function () {
  'use strict';
  var el = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
  el.classList.add('mp-js');
  el.style.setProperty('--mp-exit-factor', '0.68');
  el.style.setProperty('--mp-phase-dur', reduce ? '240ms' : '360ms');
  el.setAttribute('data-mp-hydrated', 'inline');
  window.__ML_PHYSICS__ = { page: 'motion-physics', systemReduced: reduce, ratio: 0.68 };
})();
