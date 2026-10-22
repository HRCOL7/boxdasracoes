(function(){
  const KEY='cart';
  const LOG_PREFIX = '[cart]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);
  const logError = (message, ...args) => console.error(`${LOG_PREFIX} ${message}`, ...args);
  let cartCacheRaw = null;
  let cartCacheParsed = [];
  function toBoolean(value){
    if(typeof value === 'boolean') return value;
    const normalized = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'sim';
  }
  function isVariantUnavailable(variant){
    return toBoolean(variant && variant.is_unavailable);
  }
  function normalizeWeightKey(weight){
    return String(weight || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu,'')
      .toLowerCase()
      .replace(/\s+/g,'')
      .replace(/,/g,'.')
      .trim();
  }
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
      const exactKey = String(weight || '').trim();
      const normalizedKey = normalizeWeightKey(weight);
      if(exactKey && Number.isFinite(price) && price > 0){
        map[exactKey] = price;
      }
      if(normalizedKey && Number.isFinite(price) && price > 0){
        map[normalizedKey] = price;
      }
    });
    return Object.keys(map).length ? map : null;
  }

  function getEffectiveUnitPrice(product, variantIndex){
    const base = Array.isArray(product && product.variants) && product.variants[variantIndex]
      ? Number(product.variants[variantIndex].price || 0)
      : Number(product && product.price || 0);
    if(!(product && toBoolean(product.is_promo))) return base;
    const promoProduct = (product && toBoolean(product.is_promo)) ? Number(product.promo_price) : null;
    if(Number.isFinite(promoProduct) && promoProduct > 0) return promoProduct;

    const map = getPromoVariantsMap(product);
    if(map && Array.isArray(product && product.variants) && product.variants[variantIndex]){
      const weight = String(product.variants[variantIndex].weight || '').trim();
      const promoVariant = Number(map[weight] !== undefined ? map[weight] : map[normalizeWeightKey(weight)]);
      if(Number.isFinite(promoVariant) && promoVariant > 0) return promoVariant;
    }
    return base;
  }

  let lastCount = null;
  function updateCount(){
    const c=document.getElementById('cart-count'); if(!c) return;
    const count=read().reduce((s,i)=>s+i.qty,0); c.textContent=count;
    const btn=document.getElementById('cart-btn');
    if(btn) btn.setAttribute('aria-label', count>0 ? `Abrir carrinho, ${count} ${count===1?'item':'itens'}` : 'Abrir carrinho');
    if(lastCount!==null && count!==lastCount && window.appA11y){
      window.appA11y.announce(count>lastCount ? `Item adicionado. Carrinho com ${count} ${count===1?'item':'itens'}.` : (count===0 ? 'Carrinho vazio.' : `Carrinho com ${count} ${count===1?'item':'itens'}.`));
    }
    lastCount = count;
  }

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
      const imgAttr = window.appUtils.safeImageUrl(imgSrc);
      r.innerHTML = `
        <div class="cart-left">
          <img src="${imgAttr}" alt="">
        </div>
        <div class="cart-main">
          <div class="cart-info">
            <div class="cart-name">${esc(it.name||'')}</div>
            <div class="cart-price">R$ ${(it.price*it.qty).toFixed(2)}</div>
          </div>
          <div class="cart-qty">
            <button type="button" class="qty-decrease" data-key="${esc(it.key)}" aria-label="Diminuir quantidade de ${esc(it.name||'')}"><span aria-hidden="true">−</span></button>
            <div class="qty-value">${it.qty}</div>
            <button type="button" class="qty-increase" data-key="${esc(it.key)}" aria-label="Aumentar quantidade de ${esc(it.name||'')}"><span aria-hidden="true">+</span></button>
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
    if(toBoolean(p.is_unavailable)){
      uiNotify('Produto indisponivel no momento.');
      return;
    }
    // coerce variantIndex to number if provided (accept strings from DOM dataset)
    let vi = null;
    if(detail && detail.variantIndex !== undefined && detail.variantIndex !== null){
      const n = Number(detail.variantIndex);
      vi = isNaN(n) ? null : n;
    } else {
      if(Array.isArray(p.variants) && p.variants.length){
        const firstAvailable = p.variants.findIndex(v=>!isVariantUnavailable(v));
        vi = firstAvailable > -1 ? firstAvailable : 0;
      } else {
        vi = null;
      }
    }
    let price = Number(p.price||0);
    let variantLabel = p.variant || '';
    if(Array.isArray(p.variants) && vi!==null){
      const v = p.variants[vi];
      if(v && isVariantUnavailable(v)){
        uiNotify('Esta variante esta indisponivel no momento.');
        return;
      }
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
        const variantCode = (Array.isArray(p.variants) && vi !== null && p.variants[vi] && p.variants[vi].code) ? p.variants[vi].code : (p.internal || '');
        cart.push({key, productId: p.id, variantIndex: vi, name: p.name + (variantLabel? (' • ' + variantLabel) : ''), price: price, qty:1, image: imgToStore, internal: variantCode});
    }
    // save with quota handling: if quota exceeded, try removing images from cart and save again
    try{ save(cart); }
    catch(e){
      try{
        // clear images to reduce storage footprint
        cart.forEach(ci=>{ ci.image = ''; });
        save(cart);
        uiNotify('Espaço de armazenamento local estourado; imagens removidas do carrinho para salvar os itens.');
      }catch(e2){
        logError('Failed to save cart after clearing images', e2);
        uiNotify('Não foi possível salvar o carrinho (localStorage cheio). Reinicie o navegador ou limpe o armazenamento.');
      }
    }
    updateCount(); renderCart();
    // request that cart panel be opened. If header/cart is present open now,
    // otherwise set a flag so setupBindings can open when the header is injected.
    try{ localStorage.setItem('cart_open_request','1'); }catch(e){}
    try{ if(document.getElementById('cart-panel')) { openCart(document.activeElement); try{ localStorage.removeItem('cart_open_request'); }catch(e){} } }catch(e){}
  }

  function increaseOne(key){ const cart=read(); const idx=cart.findIndex(x=>x.key===key); if(idx>-1){ cart[idx].qty += 1; save(cart); updateCount(); renderCart(); } }

  function removeOne(key){ const cart=read(); const idx=cart.findIndex(x=>x.key===key); if(idx<0) return; cart[idx].qty-=1; if(cart[idx].qty<=0) cart.splice(idx,1); save(cart); updateCount(); renderCart(); }

  function setupBindings(){
    updateCount(); renderCart();
    try{ ensureDeliveryDateMin(); prefillCheckoutFromProfile(); }catch(e){}
    try{ applySiteCheckoutVisibility(); }catch(e){}
    // if a previous add requested the cart to open, open it now
    try{ if(localStorage.getItem('cart_open_request')){ if(document.getElementById('cart-panel')) openCart(); localStorage.removeItem('cart_open_request'); } }catch(e){}
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
    const checkoutSiteBtn = document.getElementById('checkout-site');
    if(checkoutSiteBtn){ checkoutSiteBtn.removeEventListener('click', checkoutSiteHandler); checkoutSiteBtn.addEventListener('click', checkoutSiteHandler); }
    bindCheckoutDataInputs();
    // ensure checkout button enabled only when payment selected
    try{
      // ensure checkout button reflects both payment selection and cart contents
      updateCheckoutState();
      // run change handler once to set cash-change visibility
      paymentChangeHandler();
    }catch(e){}
  }

  function uiNotify(msg){ if(window.appA11y) window.appA11y.notify(msg, 'error'); else window.alert(msg); }

  function updateCheckoutState(){
    const checkoutBtn = document.getElementById('checkout');
    const checkoutSiteBtn = document.getElementById('checkout-site');
    const payment = document.getElementById('payment');
    const cartItems = read();
    const hasItems = Array.isArray(cartItems) && cartItems.length>0;
    const payVal = payment ? payment.value : '';
    const enabledWhatsapp = hasItems && !!payVal;
    if(checkoutBtn){
      checkoutBtn.disabled = !enabledWhatsapp;
      if(enabledWhatsapp) checkoutBtn.classList.add('active'); else checkoutBtn.classList.remove('active');
    }

    const siteEnabled = isSiteCheckoutEnabled();
    const requiresForSite = collectDeliveryData(false);
    const allowedOnline = isOnlinePaymentMethod(payVal);
    const enabledSite = siteEnabled && hasItems && !!payVal && allowedOnline && !!(requiresForSite && requiresForSite.isComplete);
    if(checkoutSiteBtn){
      checkoutSiteBtn.disabled = !enabledSite;
      if(enabledSite) checkoutSiteBtn.classList.add('active'); else checkoutSiteBtn.classList.remove('active');
    }
  }

  function isSiteCheckoutEnabled(){
    const host = String(window.location && window.location.hostname || '').toLowerCase();
    if(host === 'localhost' || host === '127.0.0.1') return true;
    try{
      if(window.appUtils && typeof window.appUtils.getSiteSettings === 'function'){
        const settings = window.appUtils.getSiteSettings() || {};
        return settings.siteCheckoutEnabled === true;
      }
    }catch(e){}
    return false;
  }

  function applySiteCheckoutVisibility(){
    const siteEnabled = isSiteCheckoutEnabled();
    const btn = document.getElementById('checkout-site');
    const controls = btn ? btn.closest('.cart-controls-site') : null;
    const delivery = document.querySelector('.checkout-delivery');
    const schedule = document.querySelector('.checkout-schedule');
    const hint = document.getElementById('checkout-site-hint');

    if(controls) controls.classList.toggle('hidden', !siteEnabled);
    if(delivery) delivery.classList.toggle('hidden', !siteEnabled);
    if(schedule) schedule.classList.toggle('hidden', !siteEnabled);
    if(hint){
      hint.classList.remove('hidden');
      hint.textContent = siteEnabled
        ? 'Checkout no site pronto para integração com gateway PIX/cartão.'
        : 'Checkout no site está desativado no momento.';
    }
  }

  function ensureDeliveryDateMin(){
    const deliveryDate = document.getElementById('delivery-date');
    if(!deliveryDate) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,'0');
    const d = String(now.getDate()).padStart(2,'0');
    const today = `${y}-${m}-${d}`;
    deliveryDate.min = today;
    if(!deliveryDate.value) deliveryDate.value = today;
  }

  function bindCheckoutDataInputs(){
    const ids = [
      'checkout-street','checkout-number','checkout-neighborhood','checkout-zip','checkout-reference',
      'delivery-date','delivery-window'
    ];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.removeEventListener('input', checkoutDataInputHandler);
      el.removeEventListener('change', checkoutDataInputHandler);
      el.addEventListener('input', checkoutDataInputHandler);
      el.addEventListener('change', checkoutDataInputHandler);
    });
  }

  function checkoutDataInputHandler(){ updateCheckoutState(); }

  function prefillCheckoutFromProfile(){
    const authUser = (window.customerAuth && typeof window.customerAuth.getCurrentUser === 'function')
      ? window.customerAuth.getCurrentUser()
      : null;
    const md = authUser && authUser.user_metadata ? authUser.user_metadata : {};

    const street = document.getElementById('checkout-street');
    const number = document.getElementById('checkout-number');
    const neighborhood = document.getElementById('checkout-neighborhood');
    const zip = document.getElementById('checkout-zip');

    if(street && !String(street.value || '').trim() && md.street) street.value = String(md.street);
    if(number && !String(number.value || '').trim() && md.number) number.value = String(md.number);
    if(neighborhood && !String(neighborhood.value || '').trim() && md.neighborhood) neighborhood.value = String(md.neighborhood);
    if(zip && !String(zip.value || '').trim() && md.zip) zip.value = String(md.zip);

    updateCheckoutState();
    try{
      enhanceDeliveryBlock();
      const bx = document.querySelector('.checkout-delivery');
      if(bx && !bx.dataset.touched && addressIsFilled(collectDeliveryData(false))) setDeliveryEditing(false);
      refreshDeliverySummary();
    }catch(e){}
  }

  function collectDeliveryData(strict){
    const street = String(document.getElementById('checkout-street')?.value || '').trim();
    const number = String(document.getElementById('checkout-number')?.value || '').trim();
    const neighborhood = String(document.getElementById('checkout-neighborhood')?.value || '').trim();
    const zip = String(document.getElementById('checkout-zip')?.value || '').trim();
    const reference = String(document.getElementById('checkout-reference')?.value || '').trim();
    const date = String(document.getElementById('delivery-date')?.value || '').trim();
    const windowSlot = String(document.getElementById('delivery-window')?.value || '').trim();

    const isComplete = !!(street && number && neighborhood && date && windowSlot);
    if(strict && !isComplete) return null;

    return {
      street,
      number,
      neighborhood,
      zip,
      reference,
      date,
      window: windowSlot,
      isComplete
    };
  }


  // ---------- Endereço de entrega: resumo, alterar e confirmar a cada pedido ----------
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function addressLine(d){
    if(!d || !d.street) return '';
    var parts = [d.street + (d.number ? ', ' + d.number : ''), d.neighborhood, d.zip ? 'CEP ' + d.zip : ''].filter(Boolean);
    return parts.join(' — ');
  }
  function addressIsFilled(d){ return !!(d && d.street && d.number && d.neighborhood); }
  function setDeliveryEditing(on){
    const box = document.querySelector('.checkout-delivery'); if(!box) return;
    box.classList.toggle('collapsed', !on);
    const btn = document.getElementById('delivery-edit-btn');
    if(btn){ btn.textContent = on ? 'Pronto' : 'Alterar endereço'; btn.setAttribute('aria-expanded', on ? 'true' : 'false'); }
    const save = document.getElementById('delivery-save-row'); const logged = !!(window.customerAuth && window.customerAuth.getCurrentUser && window.customerAuth.getCurrentUser());
    if(save) save.classList.toggle('hidden', !(on && logged));
    if(on) renderAddressPicker();
    if(on){ const f = document.getElementById('checkout-street'); if(f) f.focus(); }
    refreshDeliverySummary();
  }
  function renderAddressPicker(){
    const pk = document.getElementById('delivery-picker'); if(!pk) return;
    const list = (window.customerAuth && window.customerAuth.getAddresses) ? window.customerAuth.getAddresses() : [];
    const logged = !!(window.customerAuth && window.customerAuth.getCurrentUser && window.customerAuth.getCurrentUser());
    if(!logged || !list.length){ pk.classList.add('hidden'); pk.innerHTML = ''; return; }
    const cur = collectDeliveryData(false) || {};
    let matched = false;
    const rows = list.map(function(a){
      const on = !matched && a.street === cur.street && a.number === cur.number;
      if(on) matched = true;
      return '<label class="dp-opt"><input type="radio" name="delivery-addr" value="' + esc(a.id) + '"' + (on ? ' checked' : '') + '><span><strong>' + esc(a.label) + '</strong> ' + esc(addressLine(a)) + '</span></label>';
    });
    rows.push('<label class="dp-opt"><input type="radio" name="delivery-addr" value="__new"' + (matched ? '' : ' checked') + '><span><strong>Outro endereço</strong> digitar abaixo</span></label>');
    pk.innerHTML = '<p class="dp-title">Entregar em qual endereço?</p>' + rows.join('');
    pk.classList.remove('hidden');
  }
  function refreshDeliverySummary(){
    const sum = document.getElementById('delivery-summary'); if(!sum) return;
    const d = collectDeliveryData(false);
    const line = addressLine(d);
    sum.textContent = line || 'Nenhum endereço informado ainda.';
    sum.classList.toggle('is-empty', !line);
  }
  function enhanceDeliveryBlock(){
    const box = document.querySelector('.checkout-delivery');
    if(!box || box.dataset.enhanced) return;
    box.dataset.enhanced = '1';
    const title = document.getElementById('delivery-title');
    const head = document.createElement('div');
    head.className = 'delivery-head';
    head.innerHTML = '<p id="delivery-summary" class="delivery-summary" aria-live="polite"></p>' +
      '<button type="button" id="delivery-edit-btn" class="delivery-edit-btn" aria-expanded="false">Alterar endereço</button>';
    if(title) title.after(head); else box.prepend(head);
    const picker = document.createElement('div');
    picker.id = 'delivery-picker'; picker.className = 'delivery-picker hidden';
    picker.setAttribute('role', 'radiogroup'); picker.setAttribute('aria-label', 'Endereços salvos');
    head.after(picker);
    picker.addEventListener('change', function(e){
      const r = e.target; if(!r || r.name !== 'delivery-addr') return;
      if(r.value === '__new'){
        ['checkout-street','checkout-number','checkout-neighborhood','checkout-zip','checkout-reference'].forEach(function(id){ const el = document.getElementById(id); if(el) el.value = ''; });
        box.dataset.touched = '1'; refreshDeliverySummary(); updateCheckoutState();
        const f = document.getElementById('checkout-street'); if(f) f.focus();
        return;
      }
      const a = (window.customerAuth && window.customerAuth.getAddresses ? window.customerAuth.getAddresses() : []).find(function(x){ return x.id === r.value; });
      if(!a) return;
      const set = function(id, v){ const el = document.getElementById(id); if(el) el.value = v || ''; };
      set('checkout-street', a.street); set('checkout-number', a.number); set('checkout-neighborhood', a.neighborhood); set('checkout-zip', a.zip); set('checkout-reference', a.reference);
      box.dataset.touched = '1'; refreshDeliverySummary(); updateCheckoutState();
    });
    const saveRow = document.createElement('div');
    saveRow.id = 'delivery-save-row'; saveRow.className = 'delivery-save-row hidden';
    saveRow.innerHTML = '<label class="dsr-check"><input type="checkbox" id="delivery-save-default"> Salvar este endereço na minha conta</label>' +
      '<label class="dsr-name hidden" id="delivery-save-name-wrap">Nome do endereço <input type="text" id="delivery-save-name" maxlength="30" placeholder="Ex.: Casa, Trabalho"></label>';
    box.appendChild(saveRow);
    saveRow.querySelector('#delivery-save-default').addEventListener('change', function(e){
      saveRow.querySelector('#delivery-save-name-wrap').classList.toggle('hidden', !e.target.checked);
    });
    document.getElementById('delivery-edit-btn').addEventListener('click', function(){
      setDeliveryEditing(box.classList.contains('collapsed'));
    });
    box.addEventListener('input', function(){ box.dataset.touched = '1'; refreshDeliverySummary(); });
    const d = collectDeliveryData(false);
    setDeliveryEditing(!addressIsFilled(d));
    refreshDeliverySummary();
  }

  async function saveDefaultAddressIfAsked(d){
    const chk = document.getElementById('delivery-save-default');
    if(!chk || !chk.checked) return;
    try{
      if(window.customerAuth && typeof window.customerAuth.addOrUpdateAddress === 'function'){
        const nm = document.getElementById('delivery-save-name');
        await window.customerAuth.addOrUpdateAddress({ label: (nm && nm.value.trim()) || (window.customerAuth.getAddresses().length ? 'Endereço ' + (window.customerAuth.getAddresses().length + 1) : 'Casa'), street: d.street, number: d.number, neighborhood: d.neighborhood, zip: d.zip, reference: d.reference }, false);
        if(nm) nm.value = '';
      }
    }catch(e){ logError('Falha ao salvar endereço padrão', e); }
    chk.checked = false;
  }

  // Pergunta SEMPRE, antes de finalizar: "o endereço está certo?"  -> true = confirmado
  function confirmDelivery(){
    return new Promise(function(resolve){
      const d = collectDeliveryData(false) || {};
      const filled = addressIsFilled(d);
      const modal = document.createElement('div');
      modal.className = 'modal address-confirm-modal';
      modal.setAttribute('data-remove-on-close', '1');
      let termsOk = false; try{ termsOk = localStorage.getItem('terms_accepted_v1') === '1'; }catch(e){}
      const termsRow = termsOk ? '' :
        '<label class="ac-terms"><input type="checkbox" id="ac-terms-chk"> <span>Li e aceito os <a href="/termos.html" target="_blank" rel="noopener noreferrer">Termos de Uso</a>, a <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a> e a <a href="/trocas-e-reembolso.html" target="_blank" rel="noopener noreferrer">Política de Trocas e Reembolso</a> (abrem em nova aba).</span></label>' +
        '<p class="ac-terms-err" id="ac-terms-err" role="alert" hidden>Marque a caixa acima para continuar.</p>';
      const when = (d.date || d.window) ? '<p class="ac-when">Entrega: ' + esc([d.date ? d.date.split('-').reverse().join('/') : '', d.window].filter(Boolean).join(' · ')) + '</p>' : '';
      modal.innerHTML =
        '<div class="modal-body address-confirm-card">' +
          '<h2 id="ac-title" class="ac-title">' + (filled ? 'Confirme o endereço de entrega' : 'Falta o endereço de entrega') + '</h2>' +
          (filled
            ? '<p class="ac-address">' + esc(addressLine(d)) + '</p>' + (d.reference ? '<p class="ac-ref">Referência: ' + esc(d.reference) + '</p>' : '') + when +
              '<p class="ac-help">Estamos entregando neste endereço. Está certo?</p>' + termsRow
            : '<p class="ac-help">Informe rua, número e bairro para continuar.</p>') +
          '<div class="ac-actions">' +
            (filled ? '<button type="button" class="btn btn-orange" data-ac="ok">Confirmar e finalizar</button>' : '') +
            '<button type="button" class="btn" data-ac="edit">' + (filled ? 'Alterar endereço' : 'Informar endereço') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.setAttribute('aria-labelledby', 'ac-title');
      let done = false;
      function finish(ok){
        if(done) return; done = true;
        modal.classList.remove('visible');
        setTimeout(function(){ if(modal.parentNode) modal.remove(); }, 50);
        resolve(ok);
      }
      modal.addEventListener('click', function(e){
        const b = e.target.closest && e.target.closest('[data-ac]');
        if(!b) return;
        if(b.dataset.ac === 'ok'){
          const chk = modal.querySelector('#ac-terms-chk');
          if(chk && !chk.checked){ const er = modal.querySelector('#ac-terms-err'); if(er) er.hidden = false; chk.focus(); return; }
          if(chk){ try{ localStorage.setItem('terms_accepted_v1', '1'); }catch(e){} }
          saveDefaultAddressIfAsked(d).then(function(){ finish(true); });
        }
        else { finish(false); setTimeout(function(){ setDeliveryEditing(true); }, 150); }
      });
      // Esc fecha sem confirmar (a11y.js cuida do foco)
      modal.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ finish(false); } });
      requestAnimationFrame(function(){ modal.classList.add('visible'); const f = modal.querySelector('[data-ac]'); if(f) f.focus(); });
    });
  }

  function isOnlinePaymentMethod(code){
    return [
      'CAIXA_PIX','GETNET_CREDITO','GETNET_DEBITO',
      'PIX','CREDITO','DEBITO',
      'BANESE_CREDITO','BANESE_DEBITO','LINK'
    ].includes(String(code || '').trim());
  }

  // handlers defined as named functions so they can be removed/rebound
  function addByDetailListener(e){ addByDetail(e.detail); }
  function delegatedClickHandler(e){
    const el = e.target.closest && e.target.closest('.qty-increase'); if(el){ increaseOne(el.dataset.key); return; }
    const dec = e.target.closest && e.target.closest('.qty-decrease'); if(dec){ removeOne(dec.dataset.key); return; }
    const rem = e.target.closest && e.target.closest('.remove'); if(rem){ removeOne(rem.dataset.key); return; }
  }
  // Carrinho como painel lateral acessível: foco entra ao abrir, Esc fecha e devolve o foco
  // ao botão que abriu; a página atrás continua usável (diálogo não-modal).
  let cartDialog = null;
  function isCartOpen(){ const panel = document.getElementById('cart-panel'); return !!panel && !panel.classList.contains('hidden'); }
  function openCart(opener){
    const panel = document.getElementById('cart-panel'); if(!panel) return;
    panel.classList.remove('hidden');
    const btn = document.getElementById('cart-btn');
    if(btn) btn.setAttribute('aria-expanded', 'true');
    if(window.appA11y && !cartDialog){
      // Celular: o painel cobre quase a tela inteira, então é modal (foco preso, resto inerte).
      // Computador: painel lateral de 360px, a página continua utilizável (não-modal).
      const isNarrow = !!(window.matchMedia && window.matchMedia('(max-width: 899px)').matches);
      cartDialog = window.appA11y.openDialog(panel, { modal: isNarrow, opener: opener || btn, labelledby: 'cart-title', initialFocus: '#cart-close', onClose: closeCart });
    }
  }
  function closeCart(){
    const panel = document.getElementById('cart-panel');
    if(panel) panel.classList.add('hidden');
    const btn = document.getElementById('cart-btn');
    if(btn) btn.setAttribute('aria-expanded', 'false');
    if(cartDialog){ const d = cartDialog; cartDialog = null; d.close(); }
  }
  function cartToggle(){ if(isCartOpen()) closeCart(); else openCart(); }
  function cartCloseHandler(){ closeCart(); }
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
    if(!pay){ uiNotify('Escolha a forma de pagamento'); return }
    if(window.customerAuth && typeof window.customerAuth.ensureAuthenticated === 'function'){
      const ok = await window.customerAuth.ensureAuthenticated();
      if(!ok){ uiNotify('Faça login para finalizar a compra.'); return; }
    }
    const needChange=document.getElementById('need-change')?.value||'no';
    const cashAmountEl = document.getElementById('cash-amount');
    const cashAmountRaw = cashAmountEl ? cashAmountEl.value.trim() : '';
    const cart=read();
    if(cart.length===0){ uiNotify('Carrinho vazio'); return }

    // if payment is DINHEIRO and user requested change, require cash amount
    if(pay === 'DINHEIRO' && needChange === 'yes'){
      if(!cashAmountRaw){ uiNotify('Informe o valor que será pago para calcular o troco'); return }
      // normalize number (allow comma)
      const normalized = cashAmountRaw.replace(/\./g,'').replace(',','.');
      const paid = Number(normalized);
      if(isNaN(paid) || paid <= 0){ uiNotify('Valor de pagamento inválido'); return }
      var cashPaid = paid;
    }

    if(!(await confirmDelivery())) return;
    const total = cart.reduce((s,i)=>s + i.qty * i.price, 0);
    const delivery = collectDeliveryData(false);
    const order = {
      items: cart,
      payment: pay,
      needChange: needChange,
      cashPaid: (typeof cashPaid !== 'undefined' ? cashPaid : null),
      total,
      checkoutChannel: 'whatsapp',
      delivery
    };

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

  async function checkoutSiteHandler(){
    if(!isSiteCheckoutEnabled()){
      uiNotify('Checkout no site está desativado no momento.');
      return;
    }
    const payment=document.getElementById('payment'); const pay=payment?.value;
    if(!pay){ uiNotify('Escolha a forma de pagamento'); return; }
    if(!isOnlinePaymentMethod(pay)){
      uiNotify('Para finalizar no site, selecione Caixa PIX, Banese débito/crédito ou Getnet débito/crédito.');
      return;
    }
    if(window.customerAuth && typeof window.customerAuth.ensureAuthenticated === 'function'){
      const ok = await window.customerAuth.ensureAuthenticated();
      if(!ok){ uiNotify('Faça login para finalizar a compra.'); return; }
    }

    const cart=read();
    if(cart.length===0){ uiNotify('Carrinho vazio'); return; }

    const delivery = collectDeliveryData(true);
    if(!delivery){
      uiNotify('Confirme rua, número, bairro, data e horário da entrega para finalizar no site.');
      return;
    }

    if(!(await confirmDelivery())) return;
    const total = cart.reduce((s,i)=>s + i.qty * i.price, 0);
    const order = {
      items: cart,
      payment: pay,
      total,
      checkoutChannel: 'site',
      paymentStatus: 'pending',
      delivery: collectDeliveryData(true) || delivery
    };

    document.dispatchEvent(new CustomEvent('checkout-site-ready',{detail:order}));
  }

  // run setup on DOMContentLoaded and when header include finishes loading
  document.addEventListener('DOMContentLoaded', setupBindings);
  document.addEventListener('header:loaded', setupBindings);
  document.addEventListener('customer-auth:changed', ()=>{ try{ prefillCheckoutFromProfile(); const bx = document.querySelector('.checkout-delivery'); if(bx && !bx.classList.contains('collapsed')) renderAddressPicker(); }catch(e){} });
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
