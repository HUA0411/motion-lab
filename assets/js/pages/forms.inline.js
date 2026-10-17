/* 展厅 F · 首屏同步初始化（<head> 内执行：DOM 主体尚不存在，只碰 documentElement / window） */
(function () {
  'use strict';
  var el = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
  el.classList.add('fp-js');
  el.style.setProperty('--fp-exit-factor', '0.68');
  el.setAttribute('data-fp-hydrated', 'inline');
  window.__ML_FORMS__ = { page: 'forms', systemReduced: reduce, draftKey: 'ml-form-draft' };
})();
