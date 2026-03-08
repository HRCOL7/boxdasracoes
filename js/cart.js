(function(){
  const KEY='cart';
  const LOG_PREFIX = '[cart]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);
  const logError = (message, ...args) => console.error(`${LOG_PREFIX} ${message}`, ...args);
  let cartCacheRaw = null;
  let cartCacheParsed = [];
  function read(){
    try{
      const raw = localStorage.getItem(KEY)||'[]';
      if(raw === cartCacheRaw) return cartCacheParsed;
      cartCacheRaw = raw;
      cartCacheParsed = JSON.parse(raw);
      return cartCacheParsed;
    } catch(e){ logError('Failed to parse cart from localStorage', e); return []; }
  }
  function save(v){
    try{
      const raw = JSON.stringify(v);
      localStorage.setItem(KEY,raw);
      cartCacheRaw = raw;
      cartCacheParsed = Array.isArray(v) ? v : [];
    } catch(e){ logError('Failed to save cart to localStorage', e); throw e; }
  }
  function getPromoVariantsMap(product){
    if(!product || !product.promo_variants || typeof product.promo_variants !== 'object') return null;
    const map = {};
    Object.keys(product.promo_variants).forEach(weight=>{
      const price = Number(product.promo_variants[weight]);
      if(String(weight || '').trim() && Number.isFinite(price) && price > 0){
        map[String(weight).trim()] = price;
      }
    });
    return Object.keys(map).length ? map : null;
  }

  function getEffectiveUnitPrice(product, variantIndex){
    const base = Array.isArray(product && product.variants) && product.variants[variantIndex]
      ? Number(product.variants[variantIndex].price || 0)
      : Number(product && product.price || 0);
    const promoProduct = (product && product.is_promo) ? Number(product.promo_price) : null;
    if(Number.isFinite(promoProduct) && promoProduct > 0) return promoProduct;

    const map = getPromoVariantsMap(product);
    if(map && Array.isArray(product && product.variants) && product.variants[variantIndex]){
      const weight = String(product.variants[variantIndex].weight || '').trim();
      const promoVariant = Number(map[weight]);
      if(Number.isFinite(promoVariant) && promoVariant > 0) return promoVariant;
    }
    return base;
  }

  function updateCount(){const c=document.getElementById('cart-count'); if(!c) return; const count=read().reduce((s,i)=>s+i.qty,0); c.textContent=count}

  function renderCart(){
    const panel=document.getElementById('cart-panel'); const itemsRoot=document.getElementById('cart-items'); if(!itemsRoot) return; itemsRoot.innerHTML=''; const items=read();
    const products = (window.appUtils && typeof window.appUtils.readJSON === 'function') ? window.appUtils.readJSON('products', []) : JSON.parse(localStorage.getItem('products')||'[]');
    const productsById = new Map((Array.isArray(products) ? products : []).map(p => [p.id, p]));
    const frag = document.createDocumentFragment();
    let total=0;
    items.forEach(it=>{
      const r=document.createElement('div');r.className='cart-row';
      // prefer cart item image, fallback to product image (avoid duplicating large data-URLs in cart)
      let imgSrc = it.image && it.image.length? it.image : '';
      if(!imgSrc){ const prod = productsById.get(it.productId); if(prod && prod.image) imgSrc = prod.image; }
      if(!imgSrc) imgSrc = 'https://via.placeholder.com/80';
      const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
      const imgAttr = String(imgSrc).replace(/"/g,'&quot;');
      r.innerHTML = `
        <div class="cart-left">
          <img src="${imgAttr}" alt="${esc(it.name||'')}">
        </div>
        <div class="cart-main">
          <div class="cart-info">
            <div class="cart-name">${esc(it.name||'')}</div>
            <div class="cart-price">R$ ${(it.price*it.qty).toFixed(2)}</div>
          </div>
          <div class="cart-qty">
            <button type="button" class="qty-decrease" data-key="${it.key}">−</button>
            <div class="qty-value">${it.qty}</div>
            <button type="button" class="qty-increase" data-key="${it.key}">+</button>
          </div>
        </div>
      `;
      frag.appendChild(r);
      total += (it.price * it.qty);
    });
    itemsRoot.appendChild(frag);
    const totalEl=document.getElementById('cart-total'); if(totalEl) totalEl.textContent = 'R$ ' + total.toFixed(2);
    // update checkout state after rendering cart
    try{ updateCheckoutState(); }catch(e){}
  }

  function addByDetail(detail){
    const products=JSON.parse(localStorage.getItem('products')||'[]');
    const p=products.find(x=>x.id===detail.id); if(!p) return;
    if(p.is_unavailable){
      alert('Produto indisponivel no momento.');
      return;
    }
    // coerce variantIndex to number if provided (accept strings from DOM dataset)
    let vi = null;
    if(detail && detail.variantIndex !== undefined && detail.variantIndex !== null){
      const n = Number(detail.variantIndex);
      vi = isNaN(n) ? null : n;
    } else {
      vi = (Array.isArray(p.variants) && p.variants.length) ? 0 : null;
    }
    let price = Number(p.price||0);
    let variantLabel = p.variant || '';
    if(Array.isArray(p.variants) && vi!==null){
      const v = p.variants[vi];
      if(v){ price = getEffectiveUnitPrice(p, vi); variantLabel = v.weight; }
    } else {
      price = getEffectiveUnitPrice(p, 0);
    }
    const key = `${p.id}::${vi===null?'null':vi}`;
    const cart = read();
    // find existing entry by constructed key (ensures same product+variant match)
    const found = cart.find(c=> c.key === key);
    if(found){ found.qty += 1; }
    else {
      // avoid storing very large images (data: URLs) in localStorage which can quickly exceed quota
      let imgToStore = p.image || '';
      try{
        if(typeof imgToStore === 'string' && imgToStore.indexOf('data:') === 0 && imgToStore.length > 2000){ imgToStore = ''; }
      }catch(e){ imgToStore = ''; }
        cart.push({key, productId: p.id, variantIndex: vi, name: p.name + (variantLabel? (' • ' + variantLabel) : ''), price: price, qty:1, image: imgToStore, internal: p.internal || ''});
    }
    // save with quota handling: if quota exceeded, try removing images from cart and save again
    try{ save(cart); }
    catch(e){
      try{
        // clear images to reduce storage footprint
        cart.forEach(ci=>{ ci.image = ''; });
        save(cart);
        alert('Espaço de armazenamento local estourado; imagens removidas do carrinho para salvar os itens.');
      }catch(e2){
        logError('Failed to save cart after clearing images', e2);
        alert('Não foi possível salvar o carrinho (localStorage cheio). Reinicie o navegador ou limpe o armazenamento.');
      }
    }
    updateCount(); renderCart();
    // request that cart panel be opened. If header/cart is present open now,
    // otherwise set a flag so setupBindings can open when the header is injected.
    try{ localStorage.setItem('cart_open_request','1'); }catch(e){}
    try{ const panel = document.getElementById('cart-panel'); if(panel) { panel.classList.remove('hidden'); try{ localStorage.removeItem('cart_open_request'); }catch(e){} } }catch(e){}
  }

  function increaseOne(key){ const cart=read(); const idx=cart.findIndex(x=>x.key===key); if(idx>-1){ cart[idx].qty += 1; save(cart); updateCount(); renderCart(); } }

  function removeOne(key){ const cart=read(); const idx=cart.findIndex(x=>x.key===key); if(idx<0) return; cart[idx].qty-=1; if(cart[idx].qty<=0) cart.splice(idx,1); save(cart); updateCount(); renderCart(); }

  function setupBindings(){
    updateCount(); renderCart();
    // if a previous add requested the cart to open, open it now
    try{ if(localStorage.getItem('cart_open_request')){ const panel=document.getElementById('cart-panel'); if(panel) panel.classList.remove('hidden'); localStorage.removeItem('cart_open_request'); } }catch(e){}
    // ensure add-to-cart handler (may be dispatched from other scripts)
    document.removeEventListener('add-to-cart', addByDetailListener);
    document.addEventListener('add-to-cart', addByDetailListener);

    // quantity buttons and delegated click handlers
    document.removeEventListener('click', delegatedClickHandler);
    document.addEventListener('click', delegatedClickHandler);

    const cartBtn = document.getElementById('cart-btn');
    if(cartBtn){ cartBtn.removeEventListener('click', cartToggle); cartBtn.addEventListener('click', cartToggle); }
    const cartClose = document.getElementById('cart-close');
    if(cartClose){ cartClose.removeEventListener('click', cartCloseHandler); cartClose.addEventListener('click', cartCloseHandler); }
    const clearBtn = document.getElementById('clear-cart');
    if(clearBtn){ clearBtn.removeEventListener('click', clearCartHandler); clearBtn.addEventListener('click', clearCartHandler); }

    const payment=document.getElementById('payment'); const cashChange=document.getElementById('cash-change');
    if(payment){ payment.removeEventListener('change', paymentChangeHandler); payment.addEventListener('change', paymentChangeHandler); }
    const needChange = document.getElementById('need-change');
    if(needChange){ needChange.removeEventListener('change', needChangeHandler); needChange.addEventListener('change', needChangeHandler); }
    const cashAmountEl = document.getElementById('cash-amount'); if(cashAmountEl){ cashAmountEl.removeEventListener('input', cashAmountInputHandler); cashAmountEl.addEventListener('input', cashAmountInputHandler); }
    const checkoutBtn = document.getElementById('checkout');
    if(checkoutBtn){ checkoutBtn.removeEventListener('click', checkoutHandler); checkoutBtn.addEventListener('click', checkoutHandler); }
    // ensure checkout button enabled only when payment selected
    try{
      // ensure checkout button reflects both payment selection and cart contents
      updateCheckoutState();
      // run change handler once to set cash-change visibility
      paymentChangeHandler();
    }catch(e){}
  }

  function updateCheckoutState(){
    const checkoutBtn = document.getElementById('checkout');
    const payment = document.getElementById('payment');
    if(!checkoutBtn) return;
    const cartItems = read();
    const hasItems = Array.isArray(cartItems) && cartItems.length>0;
    const payVal = payment ? payment.value : '';
    const enabled = hasItems && !!payVal;
    checkoutBtn.disabled = !enabled;
    if(enabled) checkoutBtn.classList.add('active'); else checkoutBtn.classList.remove('active');
  }

  // handlers defined as named functions so they can be removed/rebound
  function addByDetailListener(e){ addByDetail(e.detail); }
  function delegatedClickHandler(e){
    const el = e.target.closest && e.target.closest('.qty-increase'); if(el){ increaseOne(el.dataset.key); return; }
    const dec = e.target.closest && e.target.closest('.qty-decrease'); if(dec){ removeOne(dec.dataset.key); return; }
    const rem = e.target.closest && e.target.closest('.remove'); if(rem){ removeOne(rem.dataset.key); return; }
  }
  function cartToggle(){ const panel = document.getElementById('cart-panel'); if(panel) panel.classList.toggle('hidden'); }
  function cartCloseHandler(){ const panel = document.getElementById('cart-panel'); if(panel) panel.classList.add('hidden'); }
  function clearCartHandler(){ localStorage.removeItem(KEY); cartCacheRaw = null; cartCacheParsed = []; renderCart(); updateCount(); const totalEl=document.getElementById('cart-total'); if(totalEl) totalEl.textContent='R$ 0,00'; }
  function paymentChangeHandler(){
    const payment=document.getElementById('payment');
    const cashChange=document.getElementById('cash-change');
    if(payment && cashChange){
      if(payment.value==='DINHEIRO'){ cashChange.classList.remove('hidden') } else { cashChange.classList.add('hidden') }
    }
    // update checkout button state based on current cart and payment selection
    try{ updateCheckoutState(); }catch(e){}
  }
  function needChangeHandler(){ const need=document.getElementById('need-change'); const row=document.getElementById('cash-amount-row'); if(!need || !row) return; if(need.value==='yes'){ row.classList.remove('hidden'); } else { row.classList.add('hidden'); } }
  function cashAmountInputHandler(){ const el=document.getElementById('cash-amount'); if(!el) return; // optional: format or validate live
    // keep only digits, comma or dot
    el.value = el.value.replace(/[^0-9\,\.]/g,''); }
  async function checkoutHandler(){
    const payment=document.getElementById('payment'); const pay=payment?.value;
    if(!pay){ alert('Escolha a forma de pagamento'); return }
    if(window.customerAuth && typeof window.customerAuth.ensureAuthenticated === 'function'){
      const ok = await window.customerAuth.ensureAuthenticated();
      if(!ok){ alert('Faça login para finalizar a compra.'); return; }
    }
    const needChange=document.getElementById('need-change')?.value||'no';
    const cashAmountEl = document.getElementById('cash-amount');
    const cashAmountRaw = cashAmountEl ? cashAmountEl.value.trim() : '';
    const cart=read();
    if(cart.length===0){ alert('Carrinho vazio'); return }

    // if payment is DINHEIRO and user requested change, require cash amount
    if(pay === 'DINHEIRO' && needChange === 'yes'){
      if(!cashAmountRaw){ alert('Informe o valor que será pago para calcular o troco'); return }
      // normalize number (allow comma)
      const normalized = cashAmountRaw.replace(/\./g,'').replace(',','.');
      const paid = Number(normalized);
      if(isNaN(paid) || paid <= 0){ alert('Valor de pagamento inválido'); return }
      var cashPaid = paid;
    }

    const total = cart.reduce((s,i)=>s + i.qty * i.price, 0);
    const order = { items: cart, payment: pay, needChange: needChange, cashPaid: (typeof cashPaid !== 'undefined' ? cashPaid : null), total };

    // update displayed total
    const totalEl=document.getElementById('cart-total'); if(totalEl) totalEl.textContent = 'R$ ' + total.toFixed(2);

    // prepare human readable payment label (use centralized map if available)
    // use centralized payment labels directly
    const payLabel = (window.appUtils && window.appUtils.paymentLabels && window.appUtils.paymentLabels[pay]) || pay;

    // Message construction removed from cart; `whatsapp.js` will build and open the WhatsApp link.

    // dispatch event for other handlers
    document.dispatchEvent(new CustomEvent('checkout-ready',{detail:order}));

    // Do NOT open WhatsApp here; `whatsapp.js` listens to `checkout-ready` and handles opening.
    // This prevents duplicate windows when both handlers are present.
  }

  // run setup on DOMContentLoaded and when header include finishes loading
  document.addEventListener('DOMContentLoaded', setupBindings);
  document.addEventListener('header:loaded', setupBindings);
  if(document.readyState !== 'loading'){ setupBindings(); }
  // watch for header/cart being injected later — ensure bindings attach
  try{
    const mo = new MutationObserver((mutations, obs) => {
      if(document.getElementById('cart-btn') || document.getElementById('cart-panel')){
        setupBindings();
        obs.disconnect();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }catch(e){}
  // expose internal functions only via events - no globals
})();
