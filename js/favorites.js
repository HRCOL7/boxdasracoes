(function(){
  'use strict';
  // Coração de favorito em todos os cards de produto (lista, início, "quem viu também viu").
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 2.7 4.5 6.3 4.5c2 0 3.7 1.1 4.7 2.7h2c1-1.6 2.7-2.7 4.7-2.7 3.6 0 5.4 3.8 3.9 7.3C19.5 16.4 12 21 12 21z" stroke-linejoin="round"/></svg>';

  function cardId(card){
    var b = card.querySelector('.add-circle[data-id], .add-btn[data-id]');
    if(b && b.dataset.id) return b.dataset.id;
    var a = card.querySelector('a[href*="product.html?id="]');
    if(a){ var m = /[?&]id=([^&]+)/.exec(a.getAttribute('href')); if(m) return decodeURIComponent(m[1]); }
    return '';
  }
  function cardName(card){
    var n = card.querySelector('.name, .title, h3, h4'); return n ? n.textContent.trim() : 'produto';
  }
  function isFav(id){ return !!(window.customerAuth && window.customerAuth.isFavorite && window.customerAuth.isFavorite(id)); }
  function paint(btn){
    var on = isFav(btn.dataset.id);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', (on ? 'Remover dos favoritos: ' : 'Adicionar aos favoritos: ') + (btn.dataset.name || 'produto'));
  }
  function decorate(root){
    (root || document).querySelectorAll('.item .image-wrap:not([data-fav])').forEach(function(w){
      var card = w.closest('.item'); if(!card) return;
      var id = cardId(card); if(!id) return;
      w.setAttribute('data-fav', '1');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'fav-heart'; b.dataset.id = id; b.dataset.name = cardName(card);
      b.innerHTML = HEART; paint(b);
      w.appendChild(b);
    });
  }
  function repaintAll(){ document.querySelectorAll('.fav-heart').forEach(paint); }

  document.addEventListener('click', async function(e){
    var b = e.target.closest && e.target.closest('.fav-heart'); if(!b) return;
    e.preventDefault(); e.stopPropagation();
    var ca = window.customerAuth;
    if(!ca || !ca.ensureAuthenticated){ if(window.appA11y) window.appA11y.notify('Login indisponível no momento. Recarregue a página.', 'error'); return; }
    var ok = await ca.ensureAuthenticated();
    if(!ok) return;
    var next = ca.toggleFavorite(b.dataset.id);
    if(next === null){ if(window.appA11y) window.appA11y.notify('Não foi possível salvar o favorito.', 'error'); return; }
    repaintAll();
    if(window.appA11y) window.appA11y.announce(next ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
  }, true);

  document.addEventListener('customer-auth:changed', repaintAll);
  var t = null;
  function schedule(){ clearTimeout(t); t = setTimeout(function(){ decorate(); }, 60); }
  function start(){
    decorate();
    if(window.MutationObserver) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
