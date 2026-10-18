/* "Comprar de novo": guarda neste aparelho os itens do último pedido enviado
   e oferece repô-los no carrinho quando ele estiver vazio. Nada vai para o servidor. */
(function(){
  'use strict';
  var KEY = 'last_order_items_v1';
  function readLast(){
    try{
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.filter(function(i){ return i && i.productId != null && i.qty > 0; }) : [];
    }catch(e){ return []; }
  }
  function saveLast(items){
    try{
      var slim = (items || []).map(function(i){
        return { productId: i.productId, variantIndex: i.variantIndex == null ? null : i.variantIndex, qty: Math.min(99, Number(i.qty) || 1) };
      }).filter(function(i){ return i.productId != null; });
      if(slim.length) localStorage.setItem(KEY, JSON.stringify(slim));
    }catch(e){}
  }
  function cartIsEmpty(){
    try{ var c = JSON.parse(localStorage.getItem('cart') || '[]'); return !Array.isArray(c) || c.length === 0; }
    catch(e){ return true; }
  }
  function render(){
    var holder = document.getElementById('cart-items');
    if(!holder) return;
    var box = document.getElementById('reorder-box');
    var last = readLast();
    if(!cartIsEmpty() || !last.length){ if(box) box.remove(); return; }
    if(box) return;
    box = document.createElement('div');
    box.id = 'reorder-box';
    box.className = 'reorder-box';
    var n = last.reduce(function(s, i){ return s + i.qty; }, 0);
    box.innerHTML = '<p>Seu último pedido tinha ' + n + (n === 1 ? ' item.' : ' itens.') + '</p>' +
      '<button type="button" id="reorder-btn" class="btn reorder-btn">Comprar de novo</button>';
    holder.parentNode.insertBefore(box, holder);
    box.querySelector('button').addEventListener('click', function(){
      last.forEach(function(i){
        for(var k = 0; k < i.qty; k++){
          document.dispatchEvent(new CustomEvent('add-to-cart', { detail: { id: i.productId, variantIndex: i.variantIndex } }));
        }
      });
      if(window.appA11y) window.appA11y.announce('Itens do último pedido adicionados ao carrinho.');
      render();
    });
  }
  // bloco na página inicial (mesmos dados guardados neste aparelho)
  function renderHome(){
    var sec = document.getElementById('home-reorder');
    if(!sec) return;
    var last = readLast();
    if(!last.length){ sec.hidden = true; sec.innerHTML = ''; return; }
    var n = last.reduce(function(s, i){ return s + i.qty; }, 0);
    sec.hidden = false;
    sec.innerHTML = '<span class="hr-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg></span>' +
      '<div class="hr-text"><p class="hr-title">Quer repetir o seu último pedido?</p><p class="hr-sub">' + n + (n === 1 ? ' item' : ' itens') + ' do pedido anterior. Você confere tudo no carrinho antes de finalizar.</p></div>' +
      '<button type="button" id="home-reorder-btn" class="hero-btn hr-btn">Comprar de novo</button>';
    sec.querySelector('button').addEventListener('click', function(){
      last.forEach(function(i){
        for(var k = 0; k < i.qty; k++){
          document.dispatchEvent(new CustomEvent('add-to-cart', { detail: { id: i.productId, variantIndex: i.variantIndex } }));
        }
      });
      if(window.appA11y) window.appA11y.announce('Itens do último pedido adicionados ao carrinho.');
    });
  }
  // grava o pedido quando o cliente finaliza (WhatsApp ou site)
  ['checkout-ready', 'checkout-site-ready'].forEach(function(ev){
    document.addEventListener(ev, function(e){ saveLast(e && e.detail && e.detail.items); });
  });
  function start(){
    render();
    renderHome();
    var holder = document.getElementById('cart-items');
    if(holder && window.MutationObserver) new MutationObserver(render).observe(holder, { childList: true });
    document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('#cart-btn')) setTimeout(render, 50); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
