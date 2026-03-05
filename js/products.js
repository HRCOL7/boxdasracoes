(function(){
  const KEY='products';
  const qs=(s)=>document.querySelector(s);
  const LOG_PREFIX = '[products]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);
  const logError = (message, ...args) => console.error(`${LOG_PREFIX} ${message}`, ...args);
  let productsCacheRaw = null;
  let productsCacheParsed = [];
  function slugify(s){ if(!s) return ''; return String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function read(){
    try{
      if(window.appUtils && typeof window.appUtils.readJSON === 'function') return window.appUtils.readJSON(KEY, []);
      const raw = localStorage.getItem(KEY)||'[]';
      if(raw === productsCacheRaw) return productsCacheParsed;
      productsCacheRaw = raw;
      productsCacheParsed = JSON.parse(raw);
      return productsCacheParsed;
    }catch(e){ logError('Failed to parse products from localStorage', e); return []; }
  }
  function save(list){ try{ const raw = JSON.stringify(list); localStorage.setItem(KEY,raw); productsCacheRaw = raw; productsCacheParsed = Array.isArray(list) ? list : []; }catch(e){ logError('Failed to save products to localStorage', e); throw e; } }
  function sleep(ms){ return new Promise(resolve=>setTimeout(resolve, ms)); }
  function hasSupabaseConfig(){
    return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  }
  function isLikelySampleData(list){
    if(!Array.isArray(list) || list.length === 0 || list.length > 3) return false;
    return list.every(p=> [1,2,3].includes(Number(p && p.id)));
  }
  async function fetchProductsDirect(offset = 0, limit = 200){
    if(!hasSupabaseConfig()) return null;
    const cfg = window.SUPABASE_CONFIG;
    const baseUrl = String(cfg.url || '').replace(/\/$/, '');
    const url = `${baseUrl}/rest/v1/products?select=*&order=id.asc&offset=${offset}&limit=${limit}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    });
    if(!resp.ok) throw new Error(`Supabase REST returned ${resp.status}`);
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  }
  async function waitForSupaReady(maxWaitMs = 4500){
    const started = Date.now();
    while((Date.now() - started) < maxWaitMs){
      try{
        const hasCfg = !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
        const hasHelper = !!(window.supa && typeof window.supa.getProducts === 'function');
        const hasSdk = !!(window.supabase && typeof window.supabase.createClient === 'function');
        if(hasCfg && hasHelper && hasSdk) return true;
      }catch(e){ /* ignore and retry */ }
      await sleep(150);
    }
    return false;
  }
  async function hydrateFromSupabase(){
    try{
      if(!hasSupabaseConfig()) return false;
      const limit = 200;
      const maxPages = 30;
      let offset = 0;
      const merged = [];
      for(let page = 0; page < maxPages; page++){
        let rows = [];
        try{ rows = await fetchProductsDirect(offset, limit); }catch(e){ logWarn('Supabase initial fetch failed', e); break; }
        if(!rows.length) break;
        merged.push(...rows);
        if(rows.length < limit) break;
        offset += rows.length;
      }
      if(!merged.length) return false;
      save(merged);
      if(window.idbProducts && typeof window.idbProducts.clear === 'function' && typeof window.idbProducts.bulkPut === 'function'){
        try{ await window.idbProducts.clear(); await window.idbProducts.bulkPut(merged); }catch(e){ logWarn('Failed syncing Supabase data to IndexedDB', e); }
      }
      return true;
    }catch(err){ logWarn('hydrateFromSupabase failed', err); return false; }
  }

  async function hydrateFromHelperFallback(){
    try{
      const supaHelper = window.supa;
      if(!supaHelper || typeof supaHelper.getProducts !== 'function') return false;
      const limit = 200;
      const maxPages = 30;
      let offset = 0;
      const merged = [];
      for(let page = 0; page < maxPages; page++){
        const res = await supaHelper.getProducts({ offset, limit, search: '' });
        const rows = (res && Array.isArray(res.results)) ? res.results : [];
        if(!rows.length) break;
        merged.push(...rows);
        if(rows.length < limit) break;
        offset += rows.length;
      }
      if(!merged.length) return false;
      save(merged);
      if(window.idbProducts && typeof window.idbProducts.clear === 'function' && typeof window.idbProducts.bulkPut === 'function'){
        try{ await window.idbProducts.clear(); await window.idbProducts.bulkPut(merged); }catch(e){ logWarn('Fallback helper sync to IDB failed', e); }
      }
      return true;
    }catch(err){
      logWarn('hydrateFromHelperFallback failed', err);
      return false;
    }
  }

  async function syncAndRenderProducts(){
    let hydrated = false;
    try{
      await waitForSupaReady(7000);
      hydrated = await hydrateFromSupabase();
      if(!hydrated){
        await sleep(700);
        hydrated = await hydrateFromSupabase();
      }
      if(!hydrated){
        hydrated = await hydrateFromHelperFallback();
      }
    }catch(e){ logWarn('Initial product hydration failed (non-fatal)', e); }

    try{
      if(hasSupabaseConfig()){
        const existing = read();
        if(isLikelySampleData(existing)){
          try{ save([]); }catch(e){ logWarn('Failed to clear sample data from local cache', e); }
        }
      } else {
        let shouldSeed = false;
        if(hydrated){ shouldSeed = false; }
        else if(window.idbProducts && typeof window.idbProducts.count === 'function'){
          shouldSeed = false;
        } else {
          shouldSeed = (read().length === 0);
        }
        if(shouldSeed){
          const sample=[
            {id:1,name:'Ração Monello Dog Tradicional',group:'Rações',subgroup:'Cães',brand:'Monello',variants:[{weight:'1 kg',price:25.99},{weight:'7 kg',price:109.99},{weight:'10,1 kg',price:120.59},{weight:'15 kg',price:157.49},{weight:'25 kg',price:289.99}],image:''},
            {id:2,name:'Ração Gato Sabor Salmão',group:'Rações',subgroup:'Gatos',brand:'MarcaB',variants:[{weight:'1 kg',price:22.5},{weight:'3 kg',price:60.0}],image:''},
            {id:3,name:'Petisco Crocante',group:'Petiscos',subgroup:'Cães',brand:'MarcaA',variant:'100g',price:9.9,image:''}
          ];
          try{ save(sample); }catch(e){ logWarn('Failed to seed local sample products', e); }
        }
      }
    }catch(err){ logWarn('Seeding check failed', err); }

    renderCarousel();
    renderList();
    bindWeightChipsScroll();
  }

  function bindWeightChipsScroll(){
    document.querySelectorAll('.weight-chips').forEach(chips=>{
      if(chips.dataset.wheelBound === '1') return;
      chips.dataset.wheelBound = '1';
      chips.addEventListener('wheel', (e)=>{
        const canScrollX = chips.scrollWidth > chips.clientWidth;
        if(!canScrollX) return;
        if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
          chips.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }, { passive: false });
    });
  }

  function renderCarousel(){
    const root=qs('#products-carousel'); if(!root) return; root.innerHTML='';
    const products=read();
    products.forEach(p=>{
        const it=document.createElement('div'); it.className='item';
        const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'));
        const img = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || 'https://via.placeholder.com/200');
      let chips = '';
      if(Array.isArray(p.variants) && p.variants.length){
        chips = '<div class="weight-chips">' + p.variants.map((v,vi)=>`<button type="button" class="weight-chip" data-id="${p.id}" data-vi="${vi}" aria-pressed="false">${esc(v.weight||'')}</button>`).join('') + '</div>';
      } else if(p.variant){
        chips = `<div class="weight-chips"><button type="button" class="weight-chip" data-id="${p.id}" data-vi="0">${esc(p.variant||'')}</button></div>`;
      }
      const displayPrice = (Array.isArray(p.variants)&&p.variants.length)? p.variants[0].price : Number(p.price||0);
      // show subgroup as link to products filtered by group+sub (use URL-safe slugs)
      const subgroupLink = p.subgroup ? `<div class="subgroup"><a class="subgroup-link" href="products.html?group=${encodeURIComponent(slugify(p.group||''))}&sub=${encodeURIComponent(slugify(p.subgroup))}">${esc(p.subgroup||'')}</a></div>` : '';
      const linkUrl = `product.html?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name||'')}`;
      it.innerHTML=`<div class="image-wrap"><img src="${String(img).replace(/\"/g,'&quot;')}" alt="${esc(p.name||'')}"><button class="add-circle" aria-label="Adicionar" data-id="${p.id}">+</button></div>${chips}<div class="product-name"><a href="${linkUrl}">${esc(p.name||'')}</a>${subgroupLink}</div><div class="price">R$ ${Number(displayPrice).toFixed(2)}</div>`;
      root.appendChild(it);
    });
    bindWeightChipsScroll();
  }

  function renderList(){
    const root=document.getElementById('product-list'); if(!root) return; root.innerHTML='';
    const products = read();
    const params = new URLSearchParams(location.search);
    const wantGroup = params.get('group'); // these are slugs now
    const wantSub = params.get('sub');
    const wantBrandParam = params.get('brand');
    const wantBrands = wantBrandParam ? wantBrandParam.split(',').map(s=>s.trim()).filter(Boolean) : [];

    // build filter UI (brands) in sidebar
    const filtersRoot = document.getElementById('product-filters');
    if(filtersRoot){
      filtersRoot.innerHTML = '';
      const header = document.createElement('h3'); header.textContent = 'Filtros'; filtersRoot.appendChild(header);
      // collect brands from products matching group/sub
      const matching = products.filter(p=>{
          if(wantGroup && slugify(p.group) !== wantGroup) return false;
          if(wantSub && slugify(p.subgroup) !== wantSub) return false;
          return true;
        });
      const brands = Array.from(new Set(matching.map(p=>p.brand).filter(Boolean))).sort();
      if(brands.length){
        const bwrap = document.createElement('div'); bwrap.className='filter-section';
        const btitle = document.createElement('div'); btitle.className='filter-title'; btitle.textContent='Fabricante'; bwrap.appendChild(btitle);
        brands.forEach(b=>{
          const id = 'brand_' + b.replace(/\W+/g,'_');
            const row = document.createElement('div'); row.className='filter-row';
            const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
            const bEsc = esc(b);
            row.innerHTML = `<label><input type="checkbox" data-brand="${bEsc}" id="${id}" ${wantBrands.includes(b)?'checked':''}> ${bEsc}</label>`;
          row.querySelector('input').addEventListener('change', ()=>{
            // rebuild brand list from checked boxes and update URL
            const checked = Array.from(bwrap.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.dataset.brand);
            const np = new URLSearchParams(location.search);
            if(checked.length) np.set('brand', checked.join(',')); else np.delete('brand');
            // keep group/sub in URL
            location.search = np.toString();
          });
          bwrap.appendChild(row);
        });
        filtersRoot.appendChild(bwrap);
      } else {
        const none = document.createElement('div'); none.textContent='Nenhum fabricante encontrado.'; filtersRoot.appendChild(none);
      }
    }

    // render product cards applying filters (compare by slug for group/sub)
    products.filter(p=>{
      if(wantGroup && slugify(p.group) !== wantGroup) return false;
      if(wantSub && slugify(p.subgroup) !== wantSub) return false;
      if(wantBrands.length && (!p.brand || !wantBrands.includes(p.brand))) return false;
      return true;
    }).forEach(p=>{
      const el=document.createElement('div');el.className='item';el.id = 'p' + p.id;
        const img = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || 'https://via.placeholder.com/200');
      let chips = '';
      if(Array.isArray(p.variants) && p.variants.length){
        chips = '<div class="weight-chips">' + p.variants.map((v,vi)=>`<button type="button" class="weight-chip" data-id="${p.id}" data-vi="${vi}" aria-pressed="false">${v.weight}</button>`).join('') + '</div>';
      } else if(p.variant){
        chips = `<div class="weight-chips"><button type="button" class="weight-chip" data-id="${p.id}" data-vi="0">${p.variant}</button></div>`;
      }
      const displayPrice = (Array.isArray(p.variants)&&p.variants.length)? p.variants[0].price : Number(p.price||0);
      const subgroupLink = p.subgroup ? `<div class="subgroup"><a class="subgroup-link" href="products.html?group=${encodeURIComponent(p.group||'')}&sub=${encodeURIComponent(p.subgroup)}">${p.subgroup}</a></div>` : '';
      const linkUrl2 = `product.html?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name||'')}`;
      const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'));
      const imgAttr = String(img).replace(/\"/g,'&quot;');
      const brandHtml = p.brand ? ('Fabricante: ' + esc(p.brand)) : '';
      el.innerHTML=`<div class="image-wrap"><img src="${imgAttr}" alt="${esc(p.name||'')}"><button class="add-circle" aria-label="Adicionar" data-id="${p.id}">+</button></div>${chips}<div class="product-name"><a href="${linkUrl2}">${esc(p.name||'')}</a>${subgroupLink}<div class="brand">${brandHtml}</div></div><div class="price">R$ ${Number(displayPrice).toFixed(2)}</div>`;
      root.appendChild(el)
    });
    bindWeightChipsScroll();
  }

  function showVariantSelector(product){
    const modal = document.createElement('div'); modal.className='modal visible';
    const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'));
    const imgAttr = String(product.image || 'https://via.placeholder.com/64').replace(/\"/g,'&quot;');
    modal.innerHTML = `
      <div class="modal-body" style="max-width:480px;width:92%;padding:18px;background:#fff;border-radius:10px;">
        <button class="modal-close" style="float:right;border:none;background:transparent;font-size:20px">×</button>
        <h3 style="margin:6px 0 12px">Qual você gostaria?</h3>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
          <img src="${imgAttr}" style="width:64px;height:64px;object-fit:contain;border-radius:6px;border:1px solid #eee;margin-right:8px">
          <div style="flex:1"><div style="font-weight:700">${esc(product.name||'')}</div></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${product.variants.map((v,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-radius:8px;border:1px solid #eee;background:#fff"><div>${esc(v.weight||'')}</div><div style="display:flex;gap:10px;align-items:center"><div style="font-weight:700;color:var(--orange,#f08b2a)">R$ ${Number(v.price).toFixed(2)}</div><button class="variant-add" data-id="${product.id}" data-vi="${i}" style="background:var(--orange,#f08b2a);color:#fff;border:none;padding:6px 10px;border-radius:6px">Adicionar à sacola</button></div></div>`).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close')?.addEventListener('click',()=>modal.remove());
    modal.addEventListener('click',e=>{ if(e.target===modal) modal.remove(); });
    modal.querySelectorAll('.variant-add').forEach(b=>{
      b.addEventListener('click',()=>{
        const id = Number(b.dataset.id); const vi = Number(b.dataset.vi);
        document.dispatchEvent(new CustomEvent('add-to-cart',{detail:{id,variantIndex:vi}}));
        modal.remove();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await syncAndRenderProducts();

    let syncTimer = null;
    function scheduleSync(delayMs){
      clearTimeout(syncTimer);
      syncTimer = setTimeout(()=>{ syncAndRenderProducts(); }, delayMs);
    }

    // iOS Safari can restore page from back-forward cache (bfcache); force a fresh sync then.
    window.addEventListener('pageshow', ()=>{ scheduleSync(120); });
    window.addEventListener('load', ()=>{ scheduleSync(180); });
    document.addEventListener('visibilitychange', async ()=>{
      if(document.visibilityState === 'visible') scheduleSync(220);
    });

    // setup realtime sync with Supabase using the standardized helper
    (function setupRealtime(){
      try{
        const supaHelper = window.supa;
        if(!supaHelper || typeof supaHelper.subscribeProducts !== 'function') return;

        let realtimeRenderTimer = null;
        function scheduleRealtimeRender(){
          clearTimeout(realtimeRenderTimer);
          realtimeRenderTimer = setTimeout(()=>{
            try{ renderCarousel(); renderList(); }catch(e){}
          }, 120);
        }

        const handleUpsert = async (item) => {
          try{
            if(item && item.id !== undefined){
              if(window.idbProducts && typeof window.idbProducts.put === 'function'){
                try{ await window.idbProducts.put(item); }catch(e){ logWarn('idb put failed', e); }
              }
              try{
                const raw = localStorage.getItem('products') || '[]';
                const arr = JSON.parse(raw);
                const idx = arr.findIndex(x=>String(x.id) === String(item.id));
                if(idx > -1) arr[idx] = item; else arr.push(item);
                localStorage.setItem('products', JSON.stringify(arr));
              }catch(e){ /* non-fatal */ }
              scheduleRealtimeRender();
            }
          }catch(e){ logWarn('handleUpsert error', e); }
        };

        const handleDelete = async (id) => {
          try{
            if(id===undefined || id===null) return;
            if(window.idbProducts && typeof window.idbProducts.delete === 'function'){
              try{ await window.idbProducts.delete(id); }catch(e){ logWarn('idb delete failed', e); }
            }
            try{
              const raw = localStorage.getItem('products') || '[]';
              const arr = JSON.parse(raw).filter(x=>String(x.id)!==String(id));
              localStorage.setItem('products', JSON.stringify(arr));
            }catch(e){}
            scheduleRealtimeRender();
          }catch(e){ logWarn('handleDelete error', e); }
        };

        // subscribe via helper
        try{
          const maybePromise = supaHelper.subscribeProducts(({ event, record, oldRecord }) => {
            try{
              if(String(event).toUpperCase() === 'DELETE'){
                const delId = (record && record.id !== undefined) ? record.id : (oldRecord && oldRecord.id !== undefined ? oldRecord.id : undefined);
                handleDelete(delId);
              } else {
                if(!record) return;
                handleUpsert(record);
              }
            }catch(e){ logWarn('realtime handler failed', e); }
          });
          // support async or sync return
          Promise.resolve(maybePromise).then(sub => {
            window.__productsRealtimeSub = sub;
          }).catch(e=>{ logWarn('subscribeProducts returned error', e); });

          // ensure we unsubscribe when leaving the page
          window.addEventListener('beforeunload', ()=>{ try{ supaHelper.unsubscribeProducts(); }catch(e){} });
        }catch(e){ logWarn('subscribeProducts failed', e); }

        console.info('Supabase realtime subscription (products) initialized (via helper)');
      }catch(err){ logWarn('realtime setup failed', err); }
    })();

    // listen for add clicks
    document.addEventListener('click',e=>{
      const btn=(e.target.closest && (e.target.closest('.add-btn') || e.target.closest('.add-circle')));
      if(!btn) return;
      const id=Number(btn.dataset.id);
      const products = read();
      const p = products.find(x=>x.id===id);
      if(!p) return;
      if(Array.isArray(p.variants) && p.variants.length>1){
        // always ask which variant to add when multiple options exist
        showVariantSelector(p);
      } else if(Array.isArray(p.variants) && p.variants.length===1){
        document.dispatchEvent(new CustomEvent('add-to-cart',{detail:{id,variantIndex:0}}));
      } else if(p.variant){
        document.dispatchEvent(new CustomEvent('add-to-cart',{detail:{id,variantIndex:0}}));
      } else {
        document.dispatchEvent(new CustomEvent('add-to-cart',{detail:{id}}));
      }
    });

    // clicking a weight chip should SELECT the variant (update price) but NOT add to cart
    document.addEventListener('click', e => {
      const chip = e.target.closest && e.target.closest('.weight-chip');
      if(!chip) return;
      const id = Number(chip.dataset.id);
      const vi = Number(chip.dataset.vi);
      const wasActive = chip.classList.contains('active');
      // set aria-pressed / active styles within same product
      document.querySelectorAll(`.weight-chip[data-id="${id}"]`).forEach(c=>{ c.classList.remove('active'); c.setAttribute('aria-pressed','false') });
      // update visible price inside the same product card (no auto-add)
      const item = chip.closest('.item');
      const products = read();
      const p = products.find(x=>x.id===id);

      if(!wasActive){
        chip.classList.add('active');
        chip.setAttribute('aria-pressed','true');
      }

      if(item){
        const priceEl = item.querySelector('.price');
        if(!p || !priceEl) return;
        if(!wasActive && Array.isArray(p.variants) && p.variants[vi]){
          priceEl.textContent = 'R$ ' + Number(p.variants[vi].price).toFixed(2);
          return;
        }

        const fallbackPrice = (Array.isArray(p.variants) && p.variants.length)
          ? Number(p.variants[0].price || 0)
          : Number(p.price || 0);
        priceEl.textContent = 'R$ ' + fallbackPrice.toFixed(2);
      }
    });

    // support keyboard activation (Enter/Space) on weight chips
    document.addEventListener('keydown', e => {
      if(e.key !== 'Enter' && e.key !== ' ') return;
      const active = document.activeElement;
      if(active && active.classList && active.classList.contains('weight-chip')){
        e.preventDefault(); active.click();
      }
    });

    // respond to filter requests
    document.addEventListener('filter',e=>{
      const group=e.detail.group; const root=document.getElementById('products-carousel'); if(!root) return; root.innerHTML='';
      read().filter(p=>!group||p.group===group).forEach(p=>{
        const it=document.createElement('div');it.className='item';
        const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'));
        const img = p.image || 'https://via.placeholder.com/200';
        let chips='';
        if(Array.isArray(p.variants)&&p.variants.length){ chips = '<div class="weight-chips">' + p.variants.map((v,vi)=>`<button type="button" class="weight-chip" data-id="${p.id}" data-vi="${vi}" aria-pressed="false">${esc(v.weight||'')}</button>`).join('') + '</div>' }
        else if(p.variant){ chips = `<div class="weight-chips"><button type="button" class="weight-chip" data-id="${p.id}" data-vi="0">${esc(p.variant||'')}</button></div>`; }
        const displayPrice = (Array.isArray(p.variants)&&p.variants.length)? p.variants[0].price : Number(p.price||0);
        const link3 = `product.html?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name||'')}`;
        it.innerHTML = `<div class="image-wrap"><img src="${String(img).replace(/\"/g,'&quot;')}" alt="${esc(p.name||'')}"><button class="add-circle" aria-label="Adicionar" data-id="${p.id}">+</button></div>${chips}<div class="product-name"><a href="${link3}">${esc(p.name||'')}</a></div><div class="price">R$ ${Number(displayPrice).toFixed(2)}</div>`;
        root.appendChild(it);
      });
      bindWeightChipsScroll();
    });
  });

  // expose minimal API via dataset on document (no globals)
  document.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.dataset.productsApi='ready';
  });
})();
