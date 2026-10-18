/* Modo claro/escuro. Carrega no <head> (síncrono) para não piscar.
   Sem escolha salva, segue o sistema; a escolha do cliente fica neste navegador. */
(function(){
  'use strict';
  var KEY = 'theme_v1';
  var root = document.documentElement;
  function saved(){ try{ var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; }catch(e){ return null; } }
  function systemDark(){ try{ return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }catch(e){ return false; } }
  function current(){ return saved() || (systemDark() ? 'dark' : 'light'); }
  function apply(t){ root.setAttribute('data-theme', t); var m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content', t === 'dark' ? '#1F1B16' : '#1F1B16'); refresh(); }
  var SUN = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>';
  function refresh(){
    var b = document.getElementById('theme-toggle'); if(!b) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    b.innerHTML = dark ? SUN : MOON;
    b.setAttribute('aria-label', dark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro');
    b.title = dark ? 'Modo claro' : 'Modo escuro';
  }
  function toggle(){
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try{ localStorage.setItem(KEY, next); }catch(e){}
    apply(next);
    if(window.appA11y) window.appA11y.announce(next === 'dark' ? 'Modo escuro ativado.' : 'Modo claro ativado.');
  }
  function mount(){
    if(document.getElementById('theme-toggle')) return;
    var cart = document.getElementById('cart-btn');
    var head = document.querySelector('.admin-head');
    if(!cart && !head) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'theme-toggle'; b.className = 'icon theme-toggle';
    b.addEventListener('click', toggle);
    if(cart && cart.parentNode) cart.parentNode.insertBefore(b, cart); else head.appendChild(b);
    refresh();
  }
  apply(current());
  try{
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSys = function(){ if(!saved()) apply(current()); };
    if(mq.addEventListener) mq.addEventListener('change', onSys);
  }catch(e){}
  document.addEventListener('DOMContentLoaded', mount);
  document.addEventListener('header:loaded', mount);
  window.appTheme = { get: current, toggle: toggle };
})();
