(function(){
  let hydratePromise = null;
  let productsCacheRaw = null;
  let productsCacheParsed = [];

  function normalizeText(v){
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function tokenize(v){
    return normalizeText(v).split(/\s+/).filter(Boolean);
  }

  function levenshtein(a, b){
    const sa = String(a || '');
    const sb = String(b || '');
    const m = sa.length;
    const n = sb.length;
    if(!m) return n;
    if(!n) return m;
    const dp = new Array(n + 1);
    for(let j = 0; j <= n; j++) dp[j] = j;
    for(let i = 1; i <= m; i++){
      let prev = dp[0];
      dp[0] = i;
      for(let j = 1; j <= n; j++){
        const temp = dp[j];
        const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prev + cost
        );
        prev = temp;
      }
    }
    return dp[n];
  }

  function tokenMatches(token, candidateToken){
    if(!token || !candidateToken) return false;
    if(candidateToken.includes(token) || token.includes(candidateToken)) return true;
    if(token.length <= 2 || candidateToken.length <= 2) return false;
    const dist = levenshtein(token, candidateToken);
    const maxLen = Math.max(token.length, candidateToken.length);
    if(maxLen <= 4) return dist <= 1;
    if(maxLen <= 7) return dist <= 2;
    return dist <= 3;
  }

  function buildSearchText(product){
    return normalizeText([
      product && product.name,
      product && product.brand,
      product && product.manufacturer,
      product && product.group,
      product && product.subgroup,
      product && product.description
    ].filter(Boolean).join(' '));
  }

  function scoreProduct(product, query){
    const q = normalizeText(query);
    if(!q) return 0;
    const text = buildSearchText(product);
    if(!text) return 0;
    if(text.includes(q)) return 1000 + q.length;

    const qTokens = tokenize(q);
    if(!qTokens.length) return 0;
    const cTokens = tokenize(text);
    let matched = 0;
    let score = 0;
    qTokens.forEach(token=>{
      let best = 0;
      cTokens.forEach(c=>{
        if(c.includes(token)) best = Math.max(best, 90);
        else if(tokenMatches(token, c)){
          const dist = levenshtein(token, c);
          best = Math.max(best, Math.max(50, 85 - dist * 10));
        }
      });
      if(best > 0){
        matched += 1;
        score += best;
      }
    });

    // Require at least half of query tokens to match to avoid noisy results.
    const minimumMatches = Math.max(1, Math.ceil(qTokens.length / 2));
    if(matched < minimumMatches) return 0;
    return score + matched * 20;
  }

  function hasSupabaseConfig(){
    return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  }

  async function fetchProductsDirect(offset, limit){
    if(!hasSupabaseConfig()) return [];
    const cfg = window.SUPABASE_CONFIG;
    const base = String(cfg.url || '').replace(/\/$/, '');
    const url = `${base}/rest/v1/products?select=*&order=id.asc&offset=${offset || 0}&limit=${limit || 200}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    });
    if(!resp.ok) throw new Error(`Supabase REST ${resp.status}`);
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  }

  function debounce(fn, wait){
    let timer = null;
    return function debounced(){
      const ctx = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function(){ fn.apply(ctx, args); }, wait);
    };
  }

  function setup(){
    const input = document.getElementById('search');
    const results = document.getElementById('search-results');
    const btn = document.getElementById('search-btn');
    if(!input||!results) return;
    const mobileInput = document.getElementById('mobile-search');
    const desktopAlreadyBound = input.dataset.searchBound === '1';
    const mobileAlreadyBound = !mobileInput || mobileInput.dataset.searchBound === '1';
    if(desktopAlreadyBound && mobileAlreadyBound) return;

    function getProductsSync(){
      try{
        if(window.appUtils && typeof window.appUtils.readJSON === 'function') return window.appUtils.readJSON('products', []);
        const raw = localStorage.getItem('products') || '[]';
        if(raw === productsCacheRaw) return productsCacheParsed;
        productsCacheRaw = raw;
        productsCacheParsed = JSON.parse(raw);
        return productsCacheParsed;
      }catch(e){
        console.error('Failed to read products', e);
        return [];
      }
    }

    async function hydrateProductsFromSupabase(){
      try{
        const limit = 200;
        const maxPages = 20;
        let offset = 0;
        const merged = [];

        // First try helper client when available.
        if(window.supa && typeof window.supa.getProducts === 'function'){
          for(let page = 0; page < maxPages; page++){
            const res = await window.supa.getProducts({ offset, limit, search: '' });
            const rows = res && Array.isArray(res.results) ? res.results : [];
            if(!rows.length) break;
            merged.push(...rows);
            if(rows.length < limit) break;
            offset += rows.length;
          }
        }

        // If helper returned nothing, try direct REST as fallback.
        if(!merged.length){
          offset = 0;
          for(let page = 0; page < maxPages; page++){
            const rows = await fetchProductsDirect(offset, limit);
            if(!rows.length) break;
            merged.push(...rows);
            if(rows.length < limit) break;
            offset += rows.length;
          }
        }

        if(!merged.length) return false;
        try{ localStorage.setItem('products', JSON.stringify(merged)); }catch(e){}
        productsCacheRaw = null;
        productsCacheParsed = [];
        return true;
      }catch(e){
        console.warn('Search hydrate from Supabase failed', e);
        return false;
      }
    }

    async function ensureProductsReady(){
      const local = getProductsSync();
      if(Array.isArray(local) && local.length) return local;
      if(!hydratePromise){
        hydratePromise = hydrateProductsFromSupabase().finally(()=>{ hydratePromise = null; });
      }
      await hydratePromise;
      return getProductsSync();
    }

    async function findMatches(q, limit){
      const products = await ensureProductsReady();
      let scored = (Array.isArray(products) ? products : []).map(p=>({ product: p, score: scoreProduct(p, q) })).filter(x=>x.score > 0);
      scored.sort((a,b)=> b.score - a.score);
      let matches = scored.map(x=>x.product);
      if(matches.length === 0){
        if(!hydratePromise){
          hydratePromise = hydrateProductsFromSupabase().finally(()=>{ hydratePromise = null; });
        }
        await hydratePromise;
        const retryProducts = getProductsSync();
        scored = (Array.isArray(retryProducts) ? retryProducts : []).map(p=>({ product: p, score: scoreProduct(p, q) })).filter(x=>x.score > 0);
        scored.sort((a,b)=> b.score - a.score);
        matches = scored.map(x=>x.product);
      }
      return matches.slice(0, limit || 8);
    }

    function getCardImage(p){
      if(Array.isArray(p && p.images) && p.images.length) return p.images[0];
      return (p && p.image) || 'https://via.placeholder.com/80';
    }

    function getDisplayPrice(p){
      if(Array.isArray(p && p.variants) && p.variants.length) return Number(p.variants[0].price || 0);
      return Number((p && p.price) || 0);
    }

    async function performSearch(){
      const q = normalizeText(input.value);
      results.innerHTML = '';
      if(!q) return;
      const matches = await findMatches(q, 8);
      const frag = document.createDocumentFragment();
      matches.forEach(p=>{
        const r = document.createElement('div');
        r.className = 'search-row';
        const img = getCardImage(p);
        const displayPrice = getDisplayPrice(p);
        const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
        r.innerHTML = `<img class="search-thumb" src="${String(img).replace(/\"/g,'&quot;')}"><div class="search-body"><div class="search-name">${esc(p.name||'')}</div><div class="search-price">R$ ${displayPrice.toFixed(2)}</div></div>`;
        r.addEventListener('click', ()=>{ window.location.href = 'product.html?id='+encodeURIComponent(p.id); });
        frag.appendChild(r);
      });
      results.appendChild(frag);
    }

    if(input.dataset.searchBound !== '1'){
      const performSearchDebounced = debounce(function(){ performSearch(); }, 140);
      input.addEventListener('input', performSearchDebounced);

      // Enter key in input should trigger search/navigation if appropriate
      input.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          e.preventDefault(); performSearch();
          const first = results.querySelector('.search-row'); if(first) first.click();
        }
      });

      if(btn){
        btn.addEventListener('click',(e)=>{
          e.preventDefault(); performSearch();
          const first = results.querySelector('.search-row'); if(first) first.click();
        });
      }
      input.dataset.searchBound = '1';
    }

    // Mobile search (separate input/button)
    const mobileBtn = document.getElementById('mobile-search-btn');
    const mobileSuggestions = document.getElementById('search-suggestions');
    if(mobileInput && mobileInput.dataset.searchBound !== '1'){
      function performMobileSearch(){
        const q = normalizeText(mobileInput.value);
        if(!q){ if(mobileSuggestions) mobileSuggestions.innerHTML=''; return; }
        findMatches(q, 8).then(matches=>{
          if(mobileSuggestions) mobileSuggestions.innerHTML = '';
          const frag = document.createDocumentFragment();
          matches.forEach(p=>{
            const r = document.createElement('div'); r.className='search-row';
            const img = getCardImage(p);
            const displayPrice = getDisplayPrice(p);
            const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
            r.innerHTML = `<img class="search-thumb" src="${String(img).replace(/\"/g,'&quot;')}"><div class="search-body"><div class="search-name">${esc(p.name||'')}</div><div class="search-price">R$ ${displayPrice.toFixed(2)}</div></div>`;
            r.addEventListener('click', ()=>{ window.location.href='product.html?id='+encodeURIComponent(p.id); });
            frag.appendChild(r);
          });
          if(mobileSuggestions) mobileSuggestions.appendChild(frag);
        });
      }
      const performMobileSearchDebounced = debounce(performMobileSearch, 140);
      mobileInput.addEventListener('input', performMobileSearchDebounced);
      mobileInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); performMobileSearch(); const f = (mobileSuggestions||document).querySelector('.search-row'); if(f) f.click(); } });
      if(mobileBtn){ mobileBtn.addEventListener('click',(e)=>{ e.preventDefault(); performMobileSearch(); const f = (mobileSuggestions||document).querySelector('.search-row'); if(f) f.click(); }); }
      mobileInput.dataset.searchBound = '1';
    }

    // background warm-up for global search on any page
    ensureProductsReady();
  }

  document.addEventListener('DOMContentLoaded', setup);
  document.addEventListener('header:loaded', setup);
  if(document.readyState !== 'loading'){ setup(); }
})();
