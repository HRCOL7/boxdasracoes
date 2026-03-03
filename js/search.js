(function(){
  let isSetup = false;

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
    if(isSetup) return;
    const input = document.getElementById('search');
    const results = document.getElementById('search-results');
    const btn = document.getElementById('search-btn');
    if(!input||!results) return;
    isSetup = true;

    let productsCacheRaw = null;
    let productsCacheParsed = [];
    function getProducts(){
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

    function performSearch(){
      const q = input.value.trim().toLowerCase();
      results.innerHTML = '';
      if(!q) return;
      const matches = getProducts().filter(p=>String((p && p.name) || '').toLowerCase().includes(q)).slice(0,5);
      const frag = document.createDocumentFragment();
      matches.forEach(p=>{
        const r = document.createElement('div');
        r.className = 'search-row';
        const img = p.image || 'https://via.placeholder.com/80';
        const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
        r.innerHTML = `<img class="search-thumb" src="${String(img).replace(/\"/g,'&quot;')}"><div class="search-body"><div class="search-name">${esc(p.name||'')}</div><div class="search-price">R$ ${Number(p.price).toFixed(2)}</div></div>`;
        r.addEventListener('click', ()=>{ window.location.href = 'product.html?id='+encodeURIComponent(p.id); });
        frag.appendChild(r);
      });
      results.appendChild(frag);
    }

    const performSearchDebounced = debounce(performSearch, 140);

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

    // Mobile search (separate input/button)
    const mobileInput = document.getElementById('mobile-search');
    const mobileBtn = document.getElementById('mobile-search-btn');
    const mobileSuggestions = document.getElementById('search-suggestions');
    if(mobileInput){
      function performMobileSearch(){
        const q = mobileInput.value.trim().toLowerCase();
        if(!q){ if(mobileSuggestions) mobileSuggestions.innerHTML=''; return; }
        const matches = getProducts().filter(p=>String((p && p.name) || '').toLowerCase().includes(q)).slice(0,5);
        if(mobileSuggestions) mobileSuggestions.innerHTML = '';
        const frag = document.createDocumentFragment();
        matches.forEach(p=>{
          const r = document.createElement('div'); r.className='search-row'; const img = p.image || 'https://via.placeholder.com/80'; const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
          r.innerHTML = `<img class="search-thumb" src="${String(img).replace(/\"/g,'&quot;')}"><div class="search-body"><div class="search-name">${esc(p.name||'')}</div><div class="search-price">R$ ${Number(p.price).toFixed(2)}</div></div>`;
          r.addEventListener('click', ()=>{ window.location.href='product.html?id='+encodeURIComponent(p.id); });
          frag.appendChild(r);
        });
        if(mobileSuggestions) mobileSuggestions.appendChild(frag);
      }
      const performMobileSearchDebounced = debounce(performMobileSearch, 140);
      mobileInput.addEventListener('input', performMobileSearchDebounced);
      mobileInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); performMobileSearch(); const f = (mobileSuggestions||document).querySelector('.search-row'); if(f) f.click(); } });
      if(mobileBtn){ mobileBtn.addEventListener('click',(e)=>{ e.preventDefault(); performMobileSearch(); const f = (mobileSuggestions||document).querySelector('.search-row'); if(f) f.click(); }); }
    }
  }

  document.addEventListener('DOMContentLoaded', setup);
  document.addEventListener('header:loaded', setup);
  if(document.readyState !== 'loading'){ setup(); }
})();
