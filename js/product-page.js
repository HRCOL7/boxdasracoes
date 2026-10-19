/* Lógica da página de produto (antes estava inline em product.html; movida para permitir CSP sem 'unsafe-inline'). */
  (async function(){
    function qs(name){ const u=new URL(location.href); return u.searchParams.get(name); }
    function slugify(s){ if(!s) return ''; return String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
    const id = Number(qs('id')) || null;
    const nameParam = qs('name');
    const pathSlug = (function(){ const p = location.pathname || '/'; const cleaned = p.replace(/^\//,'').replace(/\/$/,''); // '' if root
      // ignore actual file names like 'product.html'
      if(!cleaned) return '';
      if(cleaned.toLowerCase().endsWith('.html')) return ''; return cleaned;
    })();
    let products;
    try{ products = (window.appUtils && typeof window.appUtils.readJSON === 'function') ? window.appUtils.readJSON('products', []) : JSON.parse(localStorage.getItem('products')||'[]'); }
    catch(e){ console.error('Failed to parse products', e); products = []; }
    // If no products in localStorage, try to fetch produtos.json from server
    if(!Array.isArray(products) || products.length === 0){
      try{
        const res = await fetch('/produtos.json', {cache: 'no-cache'});
        if(res && res.ok){
          const data = await res.json();
          if(Array.isArray(data) && data.length>0){
            products = data;
            try{ localStorage.setItem('products', JSON.stringify(data)); } catch(e){ /* ignore storage errors */ }
          }
        }
      }catch(e){ /* fetch failed */ }
    }

    let p = id ? products.find(x=>x.id===id) : null;
    if(!p && pathSlug){ p = products.find(x=> slugify(x.name || '') === pathSlug); }
    const root = document.getElementById('product-detail');
    if(!p && !nameParam){
      root.innerHTML = '<p>Produto não encontrado.</p>';
    } else if(!p && nameParam){
      document.title = nameParam + ' — Box Das Rações';
      root.innerHTML = `<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap"><div style="max-width:520px"><h1 style="margin:0 0 8px">${String(nameParam).replace(/</g,'&lt;')}</h1><p>Dados do produto não estão disponíveis.</p></div></div>`;
    } else {
      const primaryImg = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || '');
      const img = primaryImg ? `<img src="${primaryImg}" style="width:260px;height:260px;object-fit:contain;padding:6px;background:#fff;border-radius:8px">` : '';
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
      function getPromoVariantsMap(product){
        const raw = product && product.promo_variants;
        if(!raw || typeof raw !== 'object') return null;
        const map = {};
        Object.keys(raw).forEach(weight=>{
          const price = Number(raw[weight]);
          const exactKey = String(weight || '').trim();
          const normalizedKey = normalizeWeightKey(weight);
          if(exactKey && Number.isFinite(price) && price > 0) map[exactKey] = price;
          if(normalizedKey && Number.isFinite(price) && price > 0) map[normalizedKey] = price;
        });
        return Object.keys(map).length ? map : null;
      }
      function getVariantBasePrice(product, variantsList, idx){
        const v = variantsList[idx] || variantsList[0] || null;
        if(v) return Number(v.price || 0);
        return Number(product && product.price || 0);
      }
      function getVariantPromoPrice(product, variantsList, idx){
        if(!toBoolean(product && product.is_promo)) return null;
        const promoProduct = toBoolean(product && product.is_promo) ? Number(product.promo_price) : null;
        if(Number.isFinite(promoProduct) && promoProduct > 0) return promoProduct;
        const map = getPromoVariantsMap(product);
        if(!map || !variantsList.length) return null;
        const v = variantsList[idx] || variantsList[0] || null;
        const weight = String(v && v.weight || '').trim();
        if(!weight) return null;
        const promo = Number(map[weight] !== undefined ? map[weight] : map[normalizeWeightKey(weight)]);
        return Number.isFinite(promo) && promo > 0 ? promo : null;
      }
      const desc = p.description || '';
      // prefer pre-generated HTML table (`garantia`) created by admin; else use centralized parser
      const garantiaHtml = p.garantia ? p.garantia : ( (window.appUtils && typeof window.appUtils.buildGarantiaHtml === 'function') ? window.appUtils.buildGarantiaHtml(p.garantia_raw || '') : (typeof window.buildGarantiaHtml === 'function' ? window.buildGarantiaHtml(p.garantia_raw || '') : '') );

      // prepare variants list for selector
      const variants = (Array.isArray(p.variants) && p.variants.length) ? p.variants : (p.variant ? [{weight: p.variant, price: p.price||0}] : []);
      const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
      const variantChipsHtml = variants.map((v,i)=>{
        const base = getVariantBasePrice(p, variants, i);
        const promo = getVariantPromoPrice(p, variants, i);
        const current = (promo !== null) ? promo : base;
        const oldPrice = (promo !== null) ? `<span class="variant-chip-old">R$ ${base.toFixed(2)}</span>` : '';
        const unavailable = isVariantUnavailable(v);
        return `<button type="button" class="variant-chip${i===0?' active':''}${promo !== null ? ' promo' : ''}${unavailable ? ' disabled' : ''}" data-vi="${i}" aria-pressed="${i===0?'true':'false'}"${unavailable ? ' disabled aria-disabled="true" title="Variante indisponível"' : ''}><span class="variant-chip-weight">${esc(v.weight||'Tamanho')}</span><span class="variant-chip-price-row">${oldPrice}<span class="variant-chip-price">R$ ${current.toFixed(2)}</span></span>${unavailable ? '<span class="variant-chip-old">Indisponível</span>' : ''}</button>`;
      }).join('');

      function weightToKg(w){
        const m = String(w || '').toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/);
        if(!m) return null;
        const n = parseFloat(m[1]);
        const kg = m[2] === 'g' ? n / 1000 : n;
        return kg > 0 ? kg : null;
      }
      function perKgHtml(price, variant){
        const kg = weightToKg(variant && variant.weight);
        if(!kg || !(price > 0) || kg === 1) return '';
        return 'Equivale a R$ ' + (price / kg).toFixed(2).replace('.', ',') + ' por kg';
      }
      function buildPriceHtml(basePrice, promoPrice){
        if(Number.isFinite(promoPrice) && promoPrice > 0){
          return `<div class="price promo-price-wrap"><span class="price-old">R$ ${basePrice.toFixed(2)}</span><span class="price-promo">R$ ${promoPrice.toFixed(2)}</span></div>`;
        }
        return `<div class="price">R$ ${basePrice.toFixed(2)}</div>`;
      }
      const initialBasePrice = getVariantBasePrice(p, variants, 0);
      const initialPromoPrice = getVariantPromoPrice(p, variants, 0);

      const displayName = p.name || nameParam || 'Produto';
      document.title = displayName + ' — Box Das Rações';
      try{
        // SEO: descrição, link canônico, redes sociais e dados estruturados (Product) para o Google
        const origin = location.origin;
        const canonical = origin + '/product.html?id=' + encodeURIComponent(p.id);
        const plain = String(p.description || '').replace(/\s+/g,' ').trim();
        const metaDesc = (plain ? plain.slice(0, 150) : (displayName + ' na Box das Rações. Peça pelo site ou pelo WhatsApp.'));
        const setMeta = (sel, attr, val)=>{ let m = document.head.querySelector(sel); if(!m){ m = document.createElement('meta'); const k = sel.match(/\[(name|property)="([^"]+)"\]/); m.setAttribute(k[1], k[2]); document.head.appendChild(m); } m.setAttribute(attr, val); };
        setMeta('meta[name="description"]', 'content', metaDesc);
        setMeta('meta[property="og:title"]', 'content', document.title);
        setMeta('meta[property="og:description"]', 'content', metaDesc);
        let can = document.head.querySelector('link[rel="canonical"]'); if(!can){ can = document.createElement('link'); can.rel = 'canonical'; document.head.appendChild(can); } can.href = canonical;
        const imgs = (Array.isArray(p.images) && p.images.length) ? p.images : (p.image ? [p.image] : []);
        const absImgs = imgs.filter(u=>/^https?:/i.test(String(u))).slice(0, 4);
        if(absImgs[0]) setMeta('meta[property="og:image"]', 'content', absImgs[0]);
        const price = (typeof initialPromoPrice === 'number' && initialPromoPrice > 0) ? initialPromoPrice : initialBasePrice;
        const ld = { '@context':'https://schema.org', '@type':'Product', name: displayName, description: plain || displayName, sku: String(p.id), url: canonical };
        if(absImgs.length) ld.image = absImgs;
        if(p.brand) ld.brand = { '@type':'Brand', name: String(p.brand) };
        if(Number.isFinite(price) && price > 0) ld.offers = { '@type':'Offer', priceCurrency:'BRL', price: Number(price).toFixed(2), url: canonical, availability: (p.is_unavailable === true || p.is_unavailable === 'true') ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', seller: { '@type':'Organization', name:'Box das Rações' } };
        let tag = document.getElementById('ld-product'); if(!tag){ tag = document.createElement('script'); tag.type = 'application/ld+json'; tag.id = 'ld-product'; document.head.appendChild(tag); }
        tag.textContent = JSON.stringify(ld);
      }catch(e){}
      const safeCategory = esc(p.category||'Ração');
      root.innerHTML = `
        <nav class="breadcrumb" style="font-size:13px;color:#666;margin-bottom:8px">Pet Shop &gt; ${ safeCategory }</nav>
        <div class="product-grid ${p.video ? 'has-video' : ''}">
            <aside class="gallery">
            <div class="thumbs" id="thumbs"></div>
            <div class="main-image"><div id="main-media-wrap"></div><div id="image-dots" class="image-dots"></div></div>
          </aside>
          <section class="details">
            <h1 class="product-title">${esc(displayName)}</h1>
            <div class="meta-row">
              <div class="code">Código: ${esc(p.id || '')}</div>
              ${ p.image_illustrative ? '<div class="illustrative">* imagens meramente ilustrativas</div>' : '' }
            </div>
            <div class="price-row">
              <div id="product-price-wrap">${buildPriceHtml(initialBasePrice, initialPromoPrice)}</div>
              <button id="favorite-btn" class="favorite" title="Favoritar">♡</button>
            </div>
            <p id="price-per-kg" class="price-per-kg"></p>
            <a id="share-wa" class="share-wa" target="_blank" rel="noopener noreferrer" href="#">Compartilhar no WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>
            <div class="variants">${ variants.length>0 ? `<label>Escolha o peso:</label><div class="ptz-selector-wrapper"><div id="variant-chips" class="variant-chips">${variantChipsHtml}</div></div>` : '' }</div>

            <p id="variant-status" class="variant-status" role="status" aria-live="polite"></p>
            <div class="buy-actions">
              <div class="qty">
                <button id="qty-dec" class="qty-btn">−</button>
                <input id="qty-val" class="qty-val" type="number" min="1" value="1" inputmode="numeric" aria-label="Quantidade">
                <button id="qty-inc" class="qty-btn">+</button>
              </div>
              <button id="add-to-cart" class="btn btn-orange">Adicionar ao carrinho</button>
            </div>

            <div class="extra-actions">
              <a href="#" class="consult-stock">Consulte nosso estoque</a>
            </div>
          </section>
        </div>

        <div class="product-below">
          <div class="description">${esc(desc)}</div>
          ${ garantiaHtml ? `<div class="nutri"><strong>Tabela Nutricional</strong>${garantiaHtml}</div>` : '' }
        </div>
      `;

      // wire variant selector to update price
      const variantChipsRoot = document.getElementById('variant-chips');
      const priceWrapEl = document.getElementById('product-price-wrap');
      const addToCartBtn = document.getElementById('add-to-cart');
      let selectedVariantIndex = 0;
      const firstAvailableVariantIndex = variants.findIndex(v=>!isVariantUnavailable(v));
      function updatePriceForVariant(idx){
        const basePrice = getVariantBasePrice(p, variants, idx);
        const promoPrice = getVariantPromoPrice(p, variants, idx);
        if(priceWrapEl) priceWrapEl.innerHTML = buildPriceHtml(basePrice, promoPrice);
        const selectedVariant = variants[idx] || null;
        const unavailable = isVariantUnavailable(selectedVariant);
        const kgEl = document.getElementById('price-per-kg');
        if(kgEl){
          const eff = (Number.isFinite(promoPrice) && promoPrice > 0) ? promoPrice : basePrice;
          kgEl.textContent = perKgHtml(eff, selectedVariant);
        }
        const stEl = document.getElementById('variant-status');
        if(stEl) stEl.textContent = unavailable ? 'Este peso está indisponível no momento. Escolha outro peso ou fale com a gente no WhatsApp.' : (variants.some(isVariantUnavailable) ? 'Os pesos riscados estão indisponíveis no momento.' : '');
        if(addToCartBtn){
          addToCartBtn.disabled = !!unavailable;
          addToCartBtn.classList.toggle('disabled', !!unavailable);
          addToCartBtn.textContent = unavailable ? 'Variante indisponível' : 'Adicionar ao carrinho';
        }
      }

      (function(){
        const a = document.getElementById('share-wa');
        if(!a) return;
        const base = Number(getVariantBasePrice(p, variants, 0)) || 0;
        const promo = getVariantPromoPrice(p, variants, 0);
        const price = (Number.isFinite(promo) && promo > 0) ? promo : base;
        const txt = (p.name || 'Produto') + (price > 0 ? ' - R$ ' + price.toFixed(2).replace('.', ',') : '') + ' | Box das Rações\n' + location.href;
        a.href = 'https://wa.me/?text=' + encodeURIComponent(txt);
      })();

      function setActiveVariant(idx){
        const n = Number(idx);
        const safeIdx = (Number.isFinite(n) && n >= 0 && n < variants.length) ? n : 0;
        selectedVariantIndex = safeIdx;
        updatePriceForVariant(safeIdx);
        if(variantChipsRoot){
          variantChipsRoot.querySelectorAll('.variant-chip').forEach(btn=>{
            const isActive = Number(btn.dataset.vi) === safeIdx;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          });
        }
      }

      if(variantChipsRoot){
        variantChipsRoot.addEventListener('click', (ev)=>{
          const btn = ev.target.closest('.variant-chip');
          if(!btn) return;
          if(btn.classList.contains('disabled') || btn.disabled) return;
          setActiveVariant(Number(btn.dataset.vi));
        });
        setActiveVariant(firstAvailableVariantIndex > -1 ? firstAvailableVariantIndex : 0);
      }

      // quantity controls (allow typing in the number input)
      const qtyVal = document.getElementById('qty-val');
      let qty = 1;
      const dec = document.getElementById('qty-dec');
      const inc = document.getElementById('qty-inc');
      function setQty(n){ qty = Math.max(1, Math.floor(Number(n)) || 1); if(qtyVal) qtyVal.value = qty; }
      dec?.addEventListener('click', ()=> setQty(qty-1));
      inc?.addEventListener('click', ()=> setQty(qty+1));
      // typing directly into the input
      qtyVal?.addEventListener('input', (e)=>{ const v = Number(e.target.value); if(Number.isNaN(v) || v < 1){ /* don't update until valid */ } else { setQty(v); } });
      // ensure changes by typing are normalized on change/blur
      qtyVal?.addEventListener('change', (e)=>{ setQty(e.target.value); });
      qtyVal?.addEventListener('blur', (e)=>{ setQty(e.target.value); });

      // add to cart
      document.getElementById('add-to-cart')?.addEventListener('click',()=>{
        const variantIndex = variants.length ? selectedVariantIndex : 0;
        if(variants.length && isVariantUnavailable(variants[variantIndex])){
          alert('Esta variante esta indisponivel no momento.');
          return;
        }
        document.dispatchEvent(new CustomEvent('add-to-cart',{detail:{id: p.id, variantIndex: variantIndex, qty: qty}}));
        alert('Adicionado à sacola');
      });

      // favorite toggle
      const favBtn = document.getElementById('favorite-btn');
      function syncFavoriteUi(){
        const isFav = !!(window.customerAuth && typeof window.customerAuth.isFavorite === 'function' && window.customerAuth.isFavorite(p.id));
        if(!favBtn) return;
        favBtn.classList.toggle('active', isFav);
        favBtn.textContent = isFav ? '❤' : '♡';
      }
      syncFavoriteUi();
      document.addEventListener('customer-auth:changed', ()=>{ syncFavoriteUi(); });
      favBtn?.addEventListener('click', async ()=>{
        try{
          if(!(window.customerAuth && typeof window.customerAuth.ensureAuthenticated === 'function')){
            alert('Login indisponível no momento. Recarregue a página.');
            return;
          }
          const ok = await window.customerAuth.ensureAuthenticated();
          if(!ok){
            alert('Faça login para favoritar produtos.');
            return;
          }
          if(!(window.customerAuth && typeof window.customerAuth.toggleFavorite === 'function')) return;
          const next = window.customerAuth.toggleFavorite(p.id);
          if(next === null){
            alert('Não foi possível salvar favorito.');
            return;
          }
          syncFavoriteUi();
        }catch(e){
          alert('Erro ao favoritar produto.');
        }
      });

      const consultStock = document.querySelector('.consult-stock');
      consultStock?.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const defaultPhone = '5579999028870';
        const phone = localStorage.getItem('whatsapp_phone') || defaultPhone;
        const productName = String(displayName || p.name || 'Produto').trim();
        const productUrl = location.href;
        let imageUrl = '';
        const firstImage = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || '');
        if(firstImage && typeof firstImage === 'string' && !firstImage.startsWith('data:')){
          try{ imageUrl = new URL(firstImage, location.origin).href; }catch(e){ imageUrl = firstImage; }
        }
        const lines = [
          `Olá! Gostaria de saber se esse produto tem em estoque?`,
          `Produto: ${productName}`,
          `Link do produto: ${productUrl}`
        ];
        if(imageUrl) lines.push(`Imagem do produto: ${imageUrl}`);
        const text = encodeURIComponent(lines.join('\n'));
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const url = isMobile
          ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}`
          : `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
        try{
          if(window.siteAnalytics && typeof window.siteAnalytics.track === 'function'){
            window.siteAnalytics.track('stock_whatsapp_opened', {
              product_id: p.id,
              meta: { product_name: productName }
            });
          }
        }catch(e){}
        window.open(url, '_blank');
      });

      // thumbnails + dots + swipe: unified media list (images + optional video)
      const thumbs = document.getElementById('thumbs');
      const mediaWrap = document.getElementById('main-media-wrap');
      const dotsWrap = document.getElementById('image-dots');
      const images = Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []);
      const mediaList = [];
      (images||[]).forEach(src=> mediaList.push({type:'image', src}));
      if(p.video){ const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]+)/i.exec(p.video||''); const thumb = (yt && yt[1]) ? `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` : (images && images[0]) || ''; mediaList.push({type:'video', src: p.video, thumb}); }
      let currentImageIndex = 0; let showingVideo = false;

      function renderDots(){ if(!dotsWrap) return; dotsWrap.innerHTML = ''; mediaList.forEach((_,i)=>{ const btn = document.createElement('button'); btn.className = 'dot'; btn.dataset.index = String(i); btn.setAttribute('aria-label', 'mídia ' + (i+1)); dotsWrap.appendChild(btn); }); updateDots(); }
      function updateDots(){ if(!dotsWrap) return; Array.from(dotsWrap.children).forEach((b,idx)=> b.classList.toggle('active', idx===currentImageIndex)); }

      function makeVideoPlayerIframe(src){ if(!src) return null; const container = document.createElement('div'); container.className = 'media-frame'; const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]+)/i.exec(src); if(yt && yt[1]){ const id = yt[1]; const iframe = document.createElement('iframe'); iframe.setAttribute('src', 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1'); iframe.setAttribute('frameborder','0'); iframe.setAttribute('allow','accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture'); iframe.setAttribute('allowfullscreen',''); container.appendChild(iframe); return container; } const video = document.createElement('video'); video.id = 'main-video'; video.controls = true; video.autoplay = true; video.src = src; container.appendChild(video); return container; }

      function makeVideoThumbnail(src, fallbackImage){ const container = document.createElement('div'); container.className = 'media-frame'; const inner = document.createElement('div'); inner.className = 'video-thumb'; inner.dataset.src = src || ''; const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]+)/i.exec(src||''); const thumb = (yt && yt[1]) ? ('https://img.youtube.com/vi/' + yt[1] + '/hqdefault.jpg') : (fallbackImage || ''); if(thumb) inner.style.backgroundImage = 'url("' + thumb + '")'; const btn = document.createElement('button'); btn.className = 'play-btn'; btn.setAttribute('aria-label','Reproduzir'); btn.textContent = '▶'; inner.appendChild(btn); container.appendChild(inner); return container; }

      function showMediaImage(i){ if(!mediaWrap) return; showingVideo = false; currentImageIndex = i < 0 ? 0 : (i >= mediaList.length ? 0 : i); const item = mediaList[currentImageIndex]; mediaWrap.innerHTML = ''; if(item && item.type === 'image'){ const wrap = document.createElement('div'); wrap.id = 'main-img-wrap'; wrap.className = 'media-frame'; const imgEl = document.createElement('img'); imgEl.id = 'main-img'; imgEl.src = item.src; imgEl.alt = esc(displayName); wrap.appendChild(imgEl); mediaWrap.appendChild(wrap); const mainImgEl = imgEl; if(mainImgEl){ let touchStartX = 0; mainImgEl.addEventListener('touchstart', (e)=>{ touchStartX = e.changedTouches[0].clientX; }, {passive:true}); mainImgEl.addEventListener('touchend', (e)=>{ const dx = e.changedTouches[0].clientX - touchStartX; if(Math.abs(dx) > 30){ if(dx < 0) showMediaAt(currentImageIndex + 1); else showMediaAt(currentImageIndex - 1); } }, {passive:true}); } } else { const no = document.createElement('div'); no.className = 'no-image'; no.textContent = 'Sem imagem'; mediaWrap.appendChild(no); } if(thumbs){ Array.from(thumbs.children).forEach((el,idx)=> el.classList.toggle('active', idx===currentImageIndex)); } updateDots(); const mainImageContainer = mediaWrap.closest('.main-image'); if(mainImageContainer){ mainImageContainer.classList.remove('has-video'); } }

      function showMediaVideo(i){ if(!mediaWrap) return; showingVideo = true; currentImageIndex = i < 0 ? 0 : (i >= mediaList.length ? 0 : i); const item = mediaList[currentImageIndex]; mediaWrap.innerHTML = ''; if(!item){ const no = document.createElement('div'); no.className = 'no-image'; no.textContent = 'Vídeo indisponível'; mediaWrap.appendChild(no); return; } const thumbElContainer = makeVideoThumbnail(item.src, item.thumb || images[0]); mediaWrap.appendChild(thumbElContainer); updateDots(); const mainImageContainer = mediaWrap.closest('.main-image'); if(mainImageContainer){ mainImageContainer.classList.add('has-video'); } const thumbInner = mediaWrap.querySelector('.video-thumb'); if(thumbInner){ thumbInner.addEventListener('click', (ev)=>{ const src = thumbInner.dataset.src; const player = makeVideoPlayerIframe(src); mediaWrap.innerHTML = ''; mediaWrap.appendChild(player || (function(){ const no = document.createElement('div'); no.className='no-image'; no.textContent='Vídeo indisponível'; return no; })()); }, {once:true}); } if(thumbs){ Array.from(thumbs.children).forEach((el,idx)=> el.classList.toggle('active', idx===currentImageIndex)); } }

      function showMediaAt(idx){ const item = mediaList[idx]; if(!item) return; if(item.type==='video') showMediaVideo(idx); else showMediaImage(idx); }

      if(dotsWrap && mediaList.length>0){ renderDots(); dotsWrap.addEventListener('click', (ev)=>{ const b = ev.target.closest('button[data-index]'); if(b) showMediaAt(Number(b.dataset.index)); }); }

      if(thumbs){ thumbs.innerHTML = ''; mediaList.forEach((m,i)=>{ if(m.type==='image'){ const im = document.createElement('img'); im.src = m.src; im.dataset.index = String(i); im.alt = 'thumb'; thumbs.appendChild(im); } else { const div = document.createElement('div'); div.className = 'thumb-video'; div.dataset.index = String(i); div.style.width = '64px'; div.style.height = '64px'; if(m.thumb) div.style.backgroundImage = 'url("' + m.thumb + '")'; div.style.backgroundSize = 'cover'; div.style.borderRadius = '6px'; div.style.border = '1px solid #f0f0f0'; thumbs.appendChild(div); } }); thumbs.addEventListener('click',(ev)=>{ const t = ev.target.closest('[data-index]'); if(t){ const idx=Number(t.dataset.index); if(!Number.isNaN(idx)) showMediaAt(idx); } }); const first = thumbs.querySelector('[data-index="0"]'); if(first) first.classList.add('active'); }

      if(mediaList.length>0){ showMediaAt(0); }

      // touch support handled when image is rendered (see showMediaImage)
    }

    // render carousel of other products
    const carousel=document.getElementById('products-carousel'); if(carousel){ carousel.innerHTML=''; products.forEach(prod=>{
      const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
      const div=document.createElement('div'); div.className='item';
      const imgAttr = String(prod.image||'https://via.placeholder.com/182').replace(/"/g,'&quot;');
      div.innerHTML = `
        <div class="image-wrap"><img src="${imgAttr}" alt="${esc(prod.name||'')}"></div>
        <div class="product-name">${esc(prod.name||'')}</div>
        <div class="price">R$ ${Number((Array.isArray(prod.variants)&&prod.variants.length)?prod.variants[0].price:prod.price||0).toFixed(2)}</div>
      `;
      div.addEventListener('click',()=>{ window.location.href = 'product.html?id='+encodeURIComponent(prod.id)+'&name='+encodeURIComponent(prod.name||''); });
      carousel.appendChild(div);
    })}
  })();
  
