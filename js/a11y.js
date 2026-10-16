/* Acessibilidade compartilhada — carregar cedo (sem defer) no <head>.
 *
 *   appA11y.announce(msg, 'polite'|'assertive')   fala algo para leitores de tela
 *   appA11y.notify(msg, 'info'|'error')           aviso visível + falado (no lugar de alert())
 *   appA11y.openDialog(el, {opener, labelledby, initialFocus, onClose}) -> {close()}
 *   appA11y.closeDialog(el)
 *   appA11y.trapFocus(el, {onEscape}) -> release()
 *   appA11y.prefs.get()/set({...})/reset()        preferências do usuário (tamanho, contraste...)
 */
(function(){
  'use strict';

  var STORAGE_KEY = 'a11y_prefs_v1';
  var DEFAULTS = { font: 'normal', contrast: 'normal', spacing: 'normal', family: 'normal', links: 'normal', motion: 'normal' };
  var ALLOWED = {
    font: ['normal', 'lg', 'xl', 'xxl'],
    contrast: ['normal', 'high'],
    spacing: ['normal', 'wide'],
    family: ['normal', 'legible'],
    links: ['normal', 'underline'],
    motion: ['normal', 'reduce']
  };

  // ---------- Preferências (persistem no navegador) ----------------------
  function readPrefs(){
    var stored = {};
    try{ stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }catch(e){ stored = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function(k){
      out[k] = ALLOWED[k].indexOf(stored[k]) > -1 ? stored[k] : DEFAULTS[k];
    });
    return out;
  }
  var current = readPrefs();

  function applyPrefs(p){
    var h = document.documentElement;
    h.setAttribute('data-a11y-font', p.font);
    h.setAttribute('data-a11y-contrast', p.contrast);
    h.setAttribute('data-a11y-spacing', p.spacing);
    h.setAttribute('data-a11y-family', p.family);
    h.setAttribute('data-a11y-links', p.links);
    h.setAttribute('data-a11y-motion', p.motion);
  }
  applyPrefs(current);   // já no <head>, antes de pintar: evita "piscar"

  var prefs = {
    get: function(){ return Object.assign({}, current); },
    set: function(patch){
      Object.keys(patch || {}).forEach(function(k){
        if(ALLOWED[k] && ALLOWED[k].indexOf(patch[k]) > -1) current[k] = patch[k];
      });
      applyPrefs(current);
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); }catch(e){}
      try{ document.dispatchEvent(new CustomEvent('a11y:prefs', { detail: prefs.get() })); }catch(e){}
      return prefs.get();
    },
    reset: function(){ return prefs.set(DEFAULTS); },
    prefersReducedMotion: function(){
      var sys = false;
      try{ sys = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
      return sys || current.motion === 'reduce';
    }
  };

  // ---------- Avisos falados / visíveis ----------------------------------
  var live = {};
  function ensureLive(){
    if(live.polite || !document.body) return;
    ['polite', 'assertive'].forEach(function(mode){
      var d = document.createElement('div');
      d.className = 'sr-only a11y-live';
      d.setAttribute('aria-live', mode);
      d.setAttribute('aria-atomic', 'true');
      if(mode === 'assertive') d.setAttribute('role', 'alert');
      document.body.appendChild(d);
      live[mode] = d;
    });
  }
  function announce(msg, mode){
    ensureLive();
    var el = live[mode === 'assertive' ? 'assertive' : 'polite'];
    if(!el) return;
    el.textContent = '';
    setTimeout(function(){ el.textContent = String(msg == null ? '' : msg); }, 40);
  }

  var toastWrap = null;
  function notify(msg, type){
    announce(msg, type === 'error' ? 'assertive' : 'polite');
    if(!document.body) return;
    if(!toastWrap){
      toastWrap = document.createElement('div');
      toastWrap.className = 'a11y-toast-wrap';
      document.body.appendChild(toastWrap);
    }
    var t = document.createElement('div');
    t.className = 'a11y-toast' + (type === 'error' ? ' error' : '');
    var span = document.createElement('span');
    span.textContent = String(msg);
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Fechar';
    var timer = null;
    function remove(){ clearTimeout(timer); if(t.parentNode) t.parentNode.removeChild(t); }
    close.addEventListener('click', remove);
    t.appendChild(span); t.appendChild(close);
    toastWrap.appendChild(t);
    function arm(){ clearTimeout(timer); timer = setTimeout(remove, type === 'error' ? 10000 : 6000); }
    t.addEventListener('mouseenter', function(){ clearTimeout(timer); });
    t.addEventListener('mouseleave', arm);
    t.addEventListener('focusin', function(){ clearTimeout(timer); });
    t.addEventListener('focusout', arm);
    arm();
  }

  // ---------- Foco preso dentro de diálogos ------------------------------
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function focusables(root){
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function(el){
      return !el.inert && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    });
  }
  function trapFocus(container, opts){
    opts = opts || {};
    function onKey(e){
      if(e.key === 'Escape' && opts.onEscape){ e.stopPropagation(); opts.onEscape(e); return; }
      if(e.key !== 'Tab') return;
      var items = focusables(container);
      if(!items.length){ e.preventDefault(); container.focus(); return; }
      var first = items[0], last = items[items.length - 1], active = document.activeElement;
      if(e.shiftKey && (active === first || !container.contains(active))){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && (active === last || !container.contains(active))){ e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    return function release(){ document.removeEventListener('keydown', onKey, true); };
  }

  // ---------- Diálogos acessíveis ----------------------------------------
  var dialogs = new WeakMap();
  function openDialog(el, opts){
    if(!el) return null;
    opts = opts || {};
    if(dialogs.has(el)) return dialogs.get(el);
    var opener = opts.opener || document.activeElement;
    if(!el.getAttribute('role')) el.setAttribute('role', 'dialog');
    var modal = opts.modal !== false;
    el.setAttribute('aria-modal', modal ? 'true' : 'false');
    if(opts.labelledby) el.setAttribute('aria-labelledby', opts.labelledby);
    if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');

    // O resto da página fica "inerte": sem foco, sem leitura por trás do diálogo.
    var inerted = [];
    if(modal) Array.prototype.forEach.call(document.body.children, function(n){
      if(n === el || n.contains(el) || n.tagName === 'SCRIPT' || n.classList.contains('a11y-live') || n.classList.contains('a11y-toast-wrap')) return;
      if(!n.inert){ n.inert = true; inerted.push(n); }
    });

    var release;
    if(modal){
      release = trapFocus(el, { onEscape: function(){ if(opts.onClose) opts.onClose('escape'); } });
    } else {
      // Não-modal: só o Esc, e só quando o foco está dentro do painel.
      var onKey = function(e){ if(e.key === 'Escape' && opts.onClose){ e.stopPropagation(); opts.onClose('escape'); } };
      el.addEventListener('keydown', onKey);
      release = function(){ el.removeEventListener('keydown', onKey); };
    }
    var target = null;
    if(opts.initialFocus) target = typeof opts.initialFocus === 'string' ? el.querySelector(opts.initialFocus) : opts.initialFocus;
    (target || focusables(el)[0] || el).focus();

    var state = {
      close: function(){
        release();
        inerted.forEach(function(n){ n.inert = false; });
        dialogs.delete(el);
        if(opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
      }
    };
    dialogs.set(el, state);
    return state;
  }
  function closeDialog(el){ var s = dialogs.get(el); if(s) s.close(); }

  // ---------- Janelas (.modal) existentes viram diálogos acessíveis sozinhas --------
  // Qualquer elemento .modal que ganhe a classe "visible" (login, minha conta, escolha de
  // variante...) passa a ter role=dialog, foco preso, Esc para fechar e devolução do foco.
  var uid = 0;
  function syncModal(el){
    if(!el || el.nodeType !== 1 || !el.classList.contains('modal')) return;
    var visible = el.classList.contains('visible');
    var isOpen = dialogs.has(el);
    if(visible && !isOpen){
      var title = el.querySelector('h1,h2,h3');
      if(title && !title.id) title.id = 'dlg-title-' + (++uid);
      openDialog(el, {
        labelledby: title ? title.id : null,
        onClose: function(){
          el.classList.remove('visible');
          if(el.hasAttribute('data-remove-on-close')) el.remove();
        }
      });
    } else if(!visible && isOpen){
      closeDialog(el);
    }
  }
  function watchModals(){
    if(!document.body || !window.MutationObserver) return;
    document.querySelectorAll('.modal.visible').forEach(syncModal);
    new MutationObserver(function(list){
      list.forEach(function(m){
        if(m.type === 'attributes'){ syncModal(m.target); return; }
        m.addedNodes.forEach(function(n){
          if(n.nodeType !== 1) return;
          syncModal(n);
          if(n.querySelectorAll) n.querySelectorAll('.modal.visible').forEach(syncModal);
        });
        m.removedNodes.forEach(function(n){ if(n.nodeType === 1 && dialogs.has(n)) closeDialog(n); });
      });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchModals);
  else watchModals();

  // URL de imagem segura para atributos src="...": aceita http(s), caminho relativo e data:image/*;
  // recusa javascript:, vbscript: etc. e codifica aspas. Fica aqui (carrega primeiro, no <head>)
  // para estar disponível em qualquer script, independente da ordem de carregamento.
  function safeImageUrl(u, fallback){
    var fb = fallback === undefined ? '' : fallback;
    var str = String(u === null || u === undefined ? '' : u).trim();
    if(!str) return fb;
    var ok = false;
    if(/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i.test(str)) ok = true;
    else if(/^(https?:)?\/\//i.test(str)) ok = true;
    else if(!/^[a-z][a-z0-9+.-]*:/i.test(str)) ok = true;
    return ok ? str.replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E') : fb;
  }
  window.appUtils = window.appUtils || {};
  window.appUtils.safeImageUrl = safeImageUrl;

  window.appA11y = {
    announce: announce,
    notify: notify,
    trapFocus: trapFocus,
    focusables: focusables,
    openDialog: openDialog,
    closeDialog: closeDialog,
    prefs: prefs
  };
})();
