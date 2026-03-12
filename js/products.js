(function(){
  const KEY='products';
  const qs=(s)=>document.querySelector(s);
  const LOG_PREFIX = '[products]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);
  const logError = (message, ...args) => console.error(`${LOG_PREFIX} ${message}`, ...args);
  let productsCacheRaw = null;
  let productsCacheParsed = [];
  function slugify(s){ if(!s) return ''; return String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function toBoolean(value){
    if(typeof value === 'boolean') return value;
    const normalized = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'sim';
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

  function bindProductListCarouselScroll(target){
    const root = target || document.getElementById('product-list');
    if(!root) return;
    if(!root.classList.contains('product-list-carousel')) return;
    if(root.dataset.wheelBound === '1') return;
    root.dataset.wheelBound = '1';
    root.addEventListener('wheel', (e)=>{
      const canScrollX = root.scrollWidth > root.clientWidth;
      if(!canScrollX) return;
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        root.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  function getProductLevelPromoPrice(product){
    const candidate = Number(product && product.promo_price);
    if(product && toBoolean(product.is_promo) && Number.isFinite(candidate) && candidate > 0) return candidate;
    return null;
  }

  function getPromoVariantsMap(product){
    const raw = product && product.promo_variants;
    if(!raw || typeof raw !== 'object') return null;
    const map = {};
    Object.keys(raw).forEach(weight=>{
      const price = Number(raw[weight]);
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

  function hasAnyPromo(product){
    if(!toBoolean(product && product.is_promo)) return false;
    if(getProductLevelPromoPrice(product) !== null) return true;
    return !!getPromoVariantsMap(product);
  }

  function getVariantBasePrice(product, variantIndex){
    if(Array.isArray(product && product.variants) && product.variants.length){
      const idx = Number.isInteger(variantIndex) ? variantIndex : 0;
      const selected = product.variants[idx] || product.variants[0];
      return Number(selected && selected.price || 0);
    }
    return Number(product && product.price || 0);
  }

  function getVariantPromoPrice(product, variantIndex){
    if(!toBoolean(product && product.is_promo)) return null;
    const productPromo = getProductLevelPromoPrice(product);
    if(productPromo !== null) return productPromo;
    const promoMap = getPromoVariantsMap(product);
    if(!promoMap || !Array.isArray(product && product.variants)) return null;
    const idx = Number.isInteger(variantIndex) ? variantIndex : 0;
    const selected = product.variants[idx] || product.variants[0];
    const weight = String(selected && selected.weight || '').trim();
    if(!weight) return null;
    const candidate = Number(promoMap[weight] !== undefined ? promoMap[weight] : promoMap[normalizeWeightKey(weight)]);
    return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  }

  function getPromoVariantIndexes(product){
    if(!Array.isArray(product && product.variants) || !product.variants.length) return [];
    // Product-level promo applies to all KGs.
    if(getProductLevelPromoPrice(product) !== null){
      return product.variants.map((_, idx) => idx);
    }
    return product.variants
      .map((_, idx) => idx)
      .filter(idx => getVariantPromoPrice(product, idx) !== null);
  }

  function buildChipsHtml(product, esc, options){
    const opts = options || {};
    const variantIndexes = Array.isArray(opts.variantIndexes)
      ? opts.variantIndexes
      : (Array.isArray(product && product.variants) ? product.variants.map((_, idx) => idx) : []);
    const activeIndex = Number.isInteger(opts.activeIndex) ? opts.activeIndex : null;
    const highlightedIndexes = new Set(Array.isArray(opts.highlightedIndexes) ? opts.highlightedIndexes : []);
    if(Array.isArray(product && product.variants) && product.variants.length && variantIndexes.length){
      return '<div class="weight-chips">' + variantIndexes.map((vi)=>{
        const v = product.variants[vi] || {};
        const isActive = activeIndex === vi;
        const isPromoChip = highlightedIndexes.has(vi);
        return `<button type="button" class="weight-chip${isActive ? ' active' : ''}${isPromoChip ? ' promo-chip' : ''}" data-id="${product.id}" data-vi="${vi}" aria-pressed="${isActive ? 'true' : 'false'}"${isPromoChip ? ' data-promo-chip="1" title="KG em promoção"' : ''}>${esc(v.weight||'')}</button>`;
      }).join('') + '</div>';
    }
    if(product && product.variant){
      const isActiveSingle = activeIndex === 0;
      return `<div class="weight-chips"><button type="button" class="weight-chip${isActiveSingle ? ' active' : ''}" data-id="${product.id}" data-vi="0" aria-pressed="${isActiveSingle ? 'true' : 'false'}">${esc(product.variant||'')}</button></div>`;
    }
    return '';
  }

  function buildPriceHtml(basePrice, promoPrice){
    if(Number.isFinite(promoPrice) && promoPrice > 0 && Number.isFinite(basePrice) && basePrice > 0){
      return `<div class="price promo-price-wrap"><span class="price-old">R$ ${Number(basePrice).toFixed(2)}</span><span class="price-promo">R$ ${Number(promoPrice).toFixed(2)}</span></div>`;
    }
    return `<div class="price">R$ ${Number(basePrice || 0).toFixed(2)}</div>`;
  }

  function renderItemPrice(itemEl, product, variantIndex){
    if(!itemEl || !product) return;
    const currentPriceEl = itemEl.querySelector('.price');
    if(!currentPriceEl) return;
    const basePrice = getVariantBasePrice(product, variantIndex);
    const promoPrice = getVariantPromoPrice(product, variantIndex);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildPriceHtml(basePrice, promoPrice);
    const nextPriceEl = wrapper.firstElementChild;
    if(nextPriceEl){
      currentPriceEl.replaceWith(nextPriceEl);
    }
  }

  function renderCarousel(){
    const root=qs('#products-carousel'); if(!root) return; root.innerHTML='';
    const promoRoot = qs('#promotions-carousel'); if(promoRoot) promoRoot.innerHTML = '';
    const promoSection = qs('#promotions-section');
    const products=read();
    let promoCount = 0;
    products.forEach(p=>{
        const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'));
        const img = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || 'https://via.placeholder.com/200');
      // show subgroup as link to products filtered by group+sub (use URL-safe slugs)
      const subgroupLink = p.subgroup ? `<div class="subgroup"><a class="subgroup-link" href="products.html?group=${encodeURIComponent(slugify(p.group||''))}&sub=${encodeURIComponent(slugify(p.subgroup))}">${esc(p.subgroup||'')}</a></div>` : '';
      const linkUrl = `product.html?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name||'')}`;
      const unavailableBadge = toBoolean(p.is_unavailable) ? '<div class="badge-unavailable">Indisponivel</div>' : '';
      const btnClass = toBoolean(p.is_unavailable) ? 'add-circle disabled' : 'add-circle';
      const isPromoProduct = hasAnyPromo(p) && promoRoot;
      const promoVariantIndexes = isPromoProduct ? getPromoVariantIndexes(p) : [];
      const defaultVariantIndex = (isPromoProduct && promoVariantIndexes.length)
        ? promoVariantIndexes[0]
        : 0;
      const chips = isPromoProduct
        ? buildChipsHtml(p, esc, { variantIndexes: promoVariantIndexes, highlightedIndexes: promoVariantIndexes, activeIndex: defaultVariantIndex })
        : buildChipsHtml(p, esc, { activeIndex: null });
      const basePrice = getVariantBasePrice(p, defaultVariantIndex);
      const promoPrice = getVariantPromoPrice(p, defaultVariantIndex);
      const promoPriceHtml = buildPriceHtml(basePrice, promoPrice);
      const it=document.createElement('div');
      it.className='item';
      it.dataset.defaultVi = String(defaultVariantIndex);
      it.innerHTML=`${unavailableBadge}<div class="image-wrap"><img src="${String(img).replace(/\"/g,'&quot;')}" alt="${esc(p.name||'')}"><button class="${btnClass}" aria-label="Adicionar" data-id="${p.id}">+</button></div>${chips}<div class="product-name"><a href="${linkUrl}">${esc(p.name||'')}</a>${subgroupLink}</div>${promoPriceHtml}`;
      if(isPromoProduct){ promoRoot.appendChild(it); promoCount += 1; }
      else root.appendChild(it);
    });
    if(promoSection) promoSection.style.display = promoCount > 0 ? 'block' : 'none';
    bindWeightChipsScroll();
  }

  function renderList(){
    const root=document.getElementById('product-list'); if(!root) return; root.innerHTML='';
    const products = read();
    const params = new URLSearchParams(location.search);
    const parseList = (key)=>{
      const raw = params.get(key);
      if(!raw) return [];
      return raw.split(',').map(s=>decodeURIComponent(String(s||'').trim())).filter(Boolean);
    };
    const setListParam = (nextParams, key, values)=>{
      const clean = (values || []).map(v=>String(v||'').trim()).filter(Boolean);
      if(!clean.length){ nextParams.delete(key); return; }
      nextParams.set(key, clean.map(v=>encodeURIComponent(v)).join(','));
    };
    const applyFilterParams = (patch)=>{
      const next = new URLSearchParams(location.search);
      if(Object.prototype.hasOwnProperty.call(patch, 'sort')){
        const value = String(patch.sort || '').trim();
        if(value) next.set('sort', value); else next.delete('sort');
      }
      if(Object.prototype.hasOwnProperty.call(patch, 'animals')) setListParam(next, 'animal', patch.animals);
      if(Object.prototype.hasOwnProperty.call(patch, 'groups')){ setListParam(next, 'groups', patch.groups); next.delete('group'); }
      if(Object.prototype.hasOwnProperty.call(patch, 'subs')){ setListParam(next, 'subs', patch.subs); next.delete('sub'); }
      if(Object.prototype.hasOwnProperty.call(patch, 'brands')) setListParam(next, 'brand', patch.brands);
      if(Object.prototype.hasOwnProperty.call(patch, 'manufacturers')) setListParam(next, 'manufacturer', patch.manufacturers);
      const query = next.toString();
      history.replaceState(null, '', query ? `products.html?${query}` : 'products.html');
      renderList();
    };

    const wantGroups = new Set([...parseList('groups'), ...(params.get('group') ? [params.get('group')] : [])]);
    const wantSubs = new Set([...parseList('subs'), ...(params.get('sub') ? [params.get('sub')] : [])]);
    const wantBrands = new Set(parseList('brand'));
    const wantManufacturers = new Set(parseList('manufacturer'));
    const wantAnimals = new Set(parseList('animal'));
    const sortMode = String(params.get('sort') || '').trim();

    const classifyAnimal = (p)=>{
      const text = String(`${p && p.group || ''} ${p && p.subgroup || ''}`)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu,'')
        .toLowerCase();
      if(text.includes('medic')) return 'medicamentos';
      if(text.includes('gato')) return 'gatos';
      if(text.includes('cao') || text.includes('caes') || text.includes('cachorr')) return 'caes';
      return '';
    };
    const getSortPrice = (p)=>{
      const base = getVariantBasePrice(p, 0);
      const promo = getVariantPromoPrice(p, 0);
      return Number.isFinite(promo) && promo > 0 ? promo : base;
    };
    const matchesBase = (p)=>{
      const gSlug = slugify(p.group);
      const sSlug = slugify(p.subgroup);
      if(wantGroups.size && !wantGroups.has(gSlug)) return false;
      if(wantSubs.size && !wantSubs.has(sSlug)) return false;
      if(wantBrands.size && !wantBrands.has(String(p.brand || '').trim())) return false;
      if(wantManufacturers.size && !wantManufacturers.has(String(p.manufacturer || '').trim())) return false;
      const animal = classifyAnimal(p);
      if(wantAnimals.size && !wantAnimals.has(animal)) return false;
      return true;
    };

    const filtered = products.filter(matchesBase);
    if(sortMode === 'price_asc') filtered.sort((a,b)=>getSortPrice(a)-getSortPrice(b));
    else if(sortMode === 'price_desc') filtered.sort((a,b)=>getSortPrice(b)-getSortPrice(a));

    const selectedBrandFilter = wantBrands.size > 0;
    const selectedManufacturerFilter = wantManufacturers.size > 0;
    const hasBrandOrManufacturerFilter = selectedBrandFilter || selectedManufacturerFilter;
    const uniqueBrands = new Set(filtered.map(p=>String(p && p.brand || '').trim()).filter(Boolean));
    const uniqueManufacturers = new Set(filtered.map(p=>String(p && p.manufacturer || '').trim()).filter(Boolean));
    const sameBrand = uniqueBrands.size <= 1;
    const sameManufacturer = uniqueManufacturers.size <= 1;
    const useCarouselMode = filtered.length > 1 && hasBrandOrManufacturerFilter && (sameBrand || sameManufacturer);

    const getGroupLabel = (product)=>{
      if(wantBrands.size){
        const label = String(product && product.brand || '').trim();
        return label || 'Sem marca';
      }
      if(wantManufacturers.size){
        const label = String(product && product.manufacturer || '').trim();
        return label || 'Sem fabricante';
      }
      return '';
    };
    const uniqueGroupLabels = new Set(filtered.map(getGroupLabel).filter(Boolean));
    const splitIntoMultipleCarousels = hasBrandOrManufacturerFilter && uniqueGroupLabels.size > 1;

    root.className = splitIntoMultipleCarousels
      ? 'product-list-grouped'
      : (useCarouselMode ? 'carousel products product-list-carousel' : 'product-list');
    delete root.dataset.wheelBound;

    const groupMap = new Map();
    const subMap = new Map();
    const brandSet = new Set();
    const manufacturerSet = new Set();
    products.forEach(p=>{
      const gSlug = slugify(p.group);
      const sSlug = slugify(p.subgroup);
      if(gSlug && !groupMap.has(gSlug)) groupMap.set(gSlug, String(p.group||'').trim());
      if(sSlug && !subMap.has(sSlug)) subMap.set(sSlug, String(p.subgroup||'').trim());
      const b = String(p.brand || '').trim(); if(b) brandSet.add(b);
      const m = String(p.manufacturer || '').trim(); if(m) manufacturerSet.add(m);
    });

    const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));

    // build filter UI
    const filtersRoot = document.getElementById('product-filters');
    if(filtersRoot){
      filtersRoot.innerHTML = '';
      const header = document.createElement('h3'); header.textContent = 'Filtros'; filtersRoot.appendChild(header);

      const sortWrap = document.createElement('div'); sortWrap.className = 'filter-section';
      sortWrap.innerHTML = `<div class="filter-title">Ordenar por preço</div>`;
      const sortSel = document.createElement('select');
      sortSel.innerHTML = '<option value="">Padrão</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option>';
      sortSel.value = sortMode;
      sortSel.addEventListener('change', ()=>applyFilterParams({ sort: sortSel.value }));
      sortWrap.appendChild(sortSel);
      filtersRoot.appendChild(sortWrap);

      const animalOptions = [
        { value: 'caes', label: 'Cães' },
        { value: 'gatos', label: 'Gatos' },
        { value: 'medicamentos', label: 'Medicamentos' }
      ];
      const animalWrap = document.createElement('div'); animalWrap.className = 'filter-section';
      animalWrap.innerHTML = `<div class="filter-title">Tipo</div>`;
      animalOptions.forEach(opt=>{
        const row = document.createElement('div'); row.className = 'filter-row';
        const checked = wantAnimals.has(opt.value) ? 'checked' : '';
        row.innerHTML = `<label><input type="checkbox" data-animal="${opt.value}" ${checked}> ${opt.label}</label>`;
        row.querySelector('input').addEventListener('change', ()=>{
          const values = Array.from(animalWrap.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.dataset.animal);
          applyFilterParams({ animals: values });
        });
        animalWrap.appendChild(row);
      });
      filtersRoot.appendChild(animalWrap);

      const groupWrap = document.createElement('div'); groupWrap.className = 'filter-section';
      groupWrap.innerHTML = `<div class="filter-title">Grupos</div>`;
      Array.from(groupMap.entries()).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).forEach(([slug, label])=>{
        const row = document.createElement('div'); row.className = 'filter-row';
        row.innerHTML = `<label><input type="checkbox" data-group="${slug}" ${wantGroups.has(slug) ? 'checked' : ''}> ${esc(label)}</label>`;
        row.querySelector('input').addEventListener('change', ()=>{
          const values = Array.from(groupWrap.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.dataset.group);
          applyFilterParams({ groups: values });
        });
        groupWrap.appendChild(row);
      });
      filtersRoot.appendChild(groupWrap);

      const subWrap = document.createElement('div'); subWrap.className = 'filter-section';
      subWrap.innerHTML = `<div class="filter-title">Subgrupos</div>`;
      Array.from(subMap.entries()).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).forEach(([slug, label])=>{
        const row = document.createElement('div'); row.className = 'filter-row';
        row.innerHTML = `<label><input type="checkbox" data-sub="${slug}" ${wantSubs.has(slug) ? 'checked' : ''}> ${esc(label)}</label>`;
        row.querySelector('input').addEventListener('change', ()=>{
          const values = Array.from(subWrap.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.dataset.sub);
          applyFilterParams({ subs: values });
        });
        subWrap.appendChild(row);
      });
      filtersRoot.appendChild(subWrap);

      const brandWrap = document.createElement('div'); brandWrap.className = 'filter-section';
      brandWrap.innerHTML = `<div class="filter-title">Marca</div>`;
      Array.from(brandSet).sort((a,b)=>a.localeCompare(b)).forEach(brand=>{
        const row = document.createElement('div'); row.className = 'filter-row';
        row.innerHTML = `<label><input type="checkbox" data-brand="${esc(brand)}" ${wantBrands.has(brand) ? 'checked' : ''}> ${esc(brand)}</label>`;
        row.querySelector('input').addEventListener('change', ()=>{
          const values = Array.from(brandWrap.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.dataset.brand);
          applyFilterParams({ brands: values });
        });
        brandWrap.appendChild(row);
      });
      filtersRoot.appendChild(brandWrap);

      const manufacturerWrap = document.createElement('div'); manufacturerWrap.className = 'filter-section';
      manufacturerWrap.innerHTML = `<div class="filter-title">Fabricante</div>`;
      Array.from(manufacturerSet).sort((a,b)=>a.localeCompare(b)).forEach(manufacturer=>{
        const row = document.createElement('div'); row.className = 'filter-row';
        row.innerHTML = `<label><input type="checkbox" data-manufacturer="${esc(manufacturer)}" ${wantManufacturers.has(manufacturer) ? 'checked' : ''}> ${esc(manufacturer)}</label>`;
        row.querySelector('input').addEventListener('change', ()=>{
          const values = Array.from(manufacturerWrap.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.dataset.manufacturer);
          applyFilterParams({ manufacturers: values });
        });
        manufacturerWrap.appendChild(row);
      });
      filtersRoot.appendChild(manufacturerWrap);
    }

    function buildProductCard(p){
      const el=document.createElement('div');el.className='item';el.id = 'p' + p.id;
      const img = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || 'https://via.placeholder.com/200');
      let chips = '';
      if(Array.isArray(p.variants) && p.variants.length){
        chips = '<div class="weight-chips">' + p.variants.map((v,vi)=>`<button type="button" class="weight-chip" data-id="${p.id}" data-vi="${vi}" aria-pressed="false">${esc(v.weight||'')}</button>`).join('') + '</div>';
      } else if(p.variant){
        chips = `<div class="weight-chips"><button type="button" class="weight-chip" data-id="${p.id}" data-vi="0">${esc(p.variant||'')}</button></div>`;
      }
      const basePrice = getVariantBasePrice(p, 0);
      const promoPrice = getVariantPromoPrice(p, 0);
      const subgroupLink = p.subgroup ? `<div class="subgroup"><a class="subgroup-link" href="products.html?group=${encodeURIComponent(slugify(p.group||''))}&sub=${encodeURIComponent(slugify(p.subgroup||''))}">${esc(p.subgroup||'')}</a></div>` : '';
      const linkUrl2 = `product.html?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name||'')}`;
      const imgAttr = String(img).replace(/\"/g,'&quot;');
      const brandHtml = p.brand ? ('Marca: ' + esc(p.brand)) : '';
      const manufacturerHtml = p.manufacturer ? ('Fabricante: ' + esc(p.manufacturer)) : '';
      const brandBlock = [brandHtml, manufacturerHtml].filter(Boolean).map(x=>`<div class="brand">${x}</div>`).join('');
      const unavailableBadge = toBoolean(p.is_unavailable) ? '<div class="badge-unavailable">Indisponivel</div>' : '';
      const btnClass = toBoolean(p.is_unavailable) ? 'add-circle disabled' : 'add-circle';
      const promoPriceHtml = buildPriceHtml(basePrice, promoPrice);
      el.innerHTML=`${unavailableBadge}<div class="image-wrap"><img src="${imgAttr}" alt="${esc(p.name||'')}"><button class="${btnClass}" aria-label="Adicionar" data-id="${p.id}">+</button></div>${chips}<div class="product-name"><a href="${linkUrl2}">${esc(p.name||'')}</a>${subgroupLink}${brandBlock}</div>${promoPriceHtml}`;
      return el;
    }

    // render product cards applying filters
    if(!filtered.length){
      const empty = document.createElement('div');
      empty.className = 'meta-small';
      empty.textContent = 'Nenhum produto encontrado para os filtros selecionados.';
      root.appendChild(empty);
    }

    if(splitIntoMultipleCarousels && filtered.length){
      const grouped = new Map();
      filtered.forEach(p=>{
        const label = getGroupLabel(p) || 'Outros';
        if(!grouped.has(label)) grouped.set(label, []);
        grouped.get(label).push(p);
      });

      grouped.forEach((items, label)=>{
        const section = document.createElement('section');
        section.className = 'product-carousel-group';
        const title = document.createElement('h3');
        title.className = 'product-carousel-group-title';
        title.textContent = label;
        const track = document.createElement('div');
        track.className = 'carousel products product-list-carousel';
        items.forEach(p=> track.appendChild(buildProductCard(p)));
        section.appendChild(title);
        section.appendChild(track);
        root.appendChild(section);
        bindProductListCarouselScroll(track);
      });
    } else {
      filtered.forEach(p=> root.appendChild(buildProductCard(p)));
      bindProductListCarouselScroll(root);
    }

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
          ${product.variants.map((v,i)=>{
            const base = getVariantBasePrice(product, i);
            const promo = getVariantPromoPrice(product, i);
            const priceHtml = (promo !== null)
              ? `<div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.1"><span style="font-size:12px;color:#8a8a8a;text-decoration:line-through">R$ ${base.toFixed(2)}</span><span style="font-weight:700;color:var(--orange,#f08b2a)">R$ ${promo.toFixed(2)}</span></div>`
              : `<div style="font-weight:700;color:var(--orange,#f08b2a)">R$ ${base.toFixed(2)}</div>`;
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-radius:8px;border:1px solid #eee;background:#fff"><div>${esc(v.weight||'')}</div><div style="display:flex;gap:10px;align-items:center">${priceHtml}<button class="variant-add" data-id="${product.id}" data-vi="${i}" style="background:var(--orange,#f08b2a);color:#fff;border:none;padding:6px 10px;border-radius:6px">Adicionar à sacola</button></div></div>`;
          }).join('')}
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
      if(toBoolean(p.is_unavailable)){
        alert('Produto indisponivel no momento.');
        return;
      }
      if(Array.isArray(p.variants) && p.variants.length>1){
        // If user already selected a chip, add that KG directly.
        const card = btn.closest('.item');
        const activeChip = card ? card.querySelector(`.weight-chip[data-id="${id}"].active`) : null;
        if(activeChip){
          const vi = Number(activeChip.dataset.vi);
          document.dispatchEvent(new CustomEvent('add-to-cart',{detail:{id,variantIndex:Number.isFinite(vi) ? vi : 0}}));
        } else {
          showVariantSelector(p);
        }
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
        if(!p) return;
        if(!wasActive && Array.isArray(p.variants) && p.variants[vi]){
          renderItemPrice(item, p, vi);
          return;
        }
        const defaultVi = Number(item.dataset.defaultVi);
        renderItemPrice(item, p, Number.isFinite(defaultVi) ? defaultVi : 0);
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
        const basePrice = getVariantBasePrice(p, 0);
        const promoPrice = getVariantPromoPrice(p, 0);
        const link3 = `product.html?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name||'')}`;
        it.innerHTML = `<div class="image-wrap"><img src="${String(img).replace(/\"/g,'&quot;')}" alt="${esc(p.name||'')}"><button class="add-circle" aria-label="Adicionar" data-id="${p.id}">+</button></div>${chips}<div class="product-name"><a href="${link3}">${esc(p.name||'')}</a></div>${buildPriceHtml(basePrice, promoPrice)}`;
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
