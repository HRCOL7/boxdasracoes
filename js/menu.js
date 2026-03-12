(function(){
  (function(){
    let hambHandler = null;
    let settingsListenersBound = false;
    function setup(){
      const settings = (window.appUtils && typeof window.appUtils.getSiteSettings === 'function')
        ? window.appUtils.getSiteSettings()
        : null;
      function slugify(s){ if(!s) return ''; return String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
      try{
        const hamburger=document.getElementById('hamburger');
    function buildPanel(){
      let panel=document.getElementById('side-menu');
      if(panel) return panel;
      panel=document.createElement('div');panel.id='side-menu';panel.className='side-menu';
      const ul=document.createElement('div');ul.className='side-list';

      const menu = (settings && Array.isArray(settings.categories) && settings.categories.length)
        ? settings.categories
        : [
            {title:'CÃES',subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
            {title:'GATOS',subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
            {title:'OUTROS',subs:['Peixes','Aves','Roedores']},
            {title:'MEDICAMENTOS',subs:['Antibióticos','Antifúngicos','Anti-inflamatórios','Analgésicos','Suplementos e Vitaminas','Dermatológicos','Antiparasitários']},
            {title:'PROMOÇÕES',subs:[]}
          ];

      const icons = {
        'CÃES': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM7.5 13c-.83 0-1.5.67-1.5 1.5S6.67 16 7.5 16 9 15.33 9 14.5 8.33 13 7.5 13zM16.5 13c-.83 0-1.5.67-1.5 1.5S15.67 16 16.5 16 18 15.33 18 14.5 17.33 13 16.5 13zM12 18.5c-2 0-3.5-1.5-3.5-3.5h7c0 2-1.5 3.5-3.5 3.5z" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'GATOS': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 6c1-2 3-3 6-3s5 1 6 3c0 0 1 2 1 4s-1 4-3 5-5 1-7 0-4-3-4-6 0-3 1-3zM7 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'OUTROS': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="0.9"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'MEDICAMENTOS': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="0.9"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'PROMOÇÕES': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 12l4-3 4 1 4-6 4 6 2 2-2 2-6 2-4 6-4-6-2-4z" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      };

      menu.forEach(item=>{
        const row=document.createElement('div'); row.className='side-row';
        const header=document.createElement('div'); header.className='side-row-header';
        const left=document.createElement('div'); left.className='side-row-left';
        const iconSpan=document.createElement('span'); iconSpan.className='side-icon'; iconSpan.innerHTML = icons[item.title] || '';
        const txt=document.createElement('span'); txt.className='side-title'; txt.textContent = item.title;
        left.appendChild(iconSpan); left.appendChild(txt);
        header.appendChild(left);

        if(item.subs && item.subs.length){
          const arrow=document.createElement('button'); arrow.className='side-arrow'; arrow.type='button'; arrow.setAttribute('aria-expanded','false');
          arrow.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          header.appendChild(arrow);
          const subul=document.createElement('div'); subul.className='side-submenu';
          item.subs.forEach(s=>{
            const li=document.createElement('div'); li.className='side-sub'; li.textContent=s;
            li.addEventListener('click',()=>{ window.location.href = 'products.html?group=' + encodeURIComponent(slugify(item.title)) + '&sub=' + encodeURIComponent(slugify(s)); });
            subul.appendChild(li);
          });
          row.appendChild(header);
          row.appendChild(subul);

          // toggle: close other submenus first, then toggle this one
          function toggleThis(){
            const panel = document.getElementById('side-menu');
            if(panel){
              panel.querySelectorAll('.side-submenu.open').forEach(s=>{
                if(s!==subul){ s.classList.remove('open'); const a = s.parentElement.querySelector('.side-arrow'); if(a){ a.classList.remove('rotated'); a.setAttribute('aria-expanded','false'); } }
              });
            }
            const open = arrow.getAttribute('aria-expanded') === 'true';
            arrow.setAttribute('aria-expanded', String(!open));
            subul.classList.toggle('open', !open);
            arrow.classList.toggle('rotated', !open);
          }

          arrow.addEventListener('click',(e)=>{ e.stopPropagation(); toggleThis(); });
          left.addEventListener('click',(e)=>{ e.stopPropagation(); toggleThis(); });
        } else {
          // no subs: clicking header navigates to products for that group
          header.appendChild(document.createElement('span'));
          header.addEventListener('click',()=>{ window.location.href = 'products.html?group=' + encodeURIComponent(slugify(item.title)); });
          row.appendChild(header);
        }
        ul.appendChild(row);
      });

      panel.appendChild(ul); document.body.appendChild(panel);
      return panel;
    }

    let outsideClickHandler = null;
    function closePanel(panel){
      if(!panel) return;
      // collapse any open submenus
      panel.querySelectorAll('.side-submenu.open').forEach(s=>s.classList.remove('open'));
      panel.querySelectorAll('.side-arrow.rotated').forEach(a=>a.classList.remove('rotated'));
      const arrows = panel.querySelectorAll('.side-arrow[aria-expanded]');
      if(arrows && arrows.length){ arrows.forEach(a=>a.setAttribute('aria-expanded','false')); }
      panel.classList.remove('open');
      if(outsideClickHandler){ document.removeEventListener('click', outsideClickHandler); outsideClickHandler = null; }
    }

    if(!hamburger){ console.warn('menu.js: #hamburger not found'); }
    if(hamburger){
      // remove previous handler if present
      if(hambHandler) hamburger.removeEventListener('click', hambHandler);
      hambHandler = function(e){
        e.stopPropagation();
        const panel = buildPanel();
      const isOpen = panel.classList.contains('open');
      if(isOpen){ closePanel(panel); return; }
      // open
      panel.classList.add('open');

      // add document click listener to close when clicking outside
      outsideClickHandler = function(ev){
        const target = ev.target;
        if(!panel.contains(target) && target !== hamburger && !hamburger.contains(target)){
          closePanel(panel);
        }
      };
      // use capture to ensure we catch clicks early
      document.addEventListener('click', outsideClickHandler);
      };
      hamburger.addEventListener('click', hambHandler);
    }
    // brands carousel clickable via event delegation
    const brandsRoot=document.getElementById('brands-carousel');
    if(brandsRoot){
      const fallbackBrandLogo = (name)=>{
        const label = String(name || 'Marca').replace(/</g,'').replace(/>/g,'').slice(0, 18);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120" viewBox="0 0 220 120"><rect width="220" height="120" rx="14" fill="#ffffff"/><rect x="2" y="2" width="216" height="116" rx="12" fill="none" stroke="#e7e7e7"/><text x="110" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ff7a00">${label}</text></svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      };
      const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
      brandsRoot.innerHTML = '';
      const configuredBrands = (settings && Array.isArray(settings.brands) && settings.brands.length)
        ? settings.brands
        : [{name:'MarcaA',image:''},{name:'MarcaB',image:''},{name:'MarcaC',image:''}];
      configuredBrands.forEach(entry=>{
        const b = (entry && typeof entry === 'object') ? String(entry.name||'').trim() : String(entry||'').trim();
        if(!b) return;
        const it=document.createElement('div');it.className='item';
        const bEsc = esc(b);
        const image = (entry && typeof entry === 'object' && entry.image) ? String(entry.image).trim() : '';
        const imgUrl = image || fallbackBrandLogo(b);
        it.innerHTML=`<img src="${imgUrl}" alt="${bEsc}"><div>${bEsc}</div>`;
        const imgEl = it.querySelector('img');
        if(imgEl){ imgEl.onerror = ()=>{ imgEl.src = fallbackBrandLogo(b); }; }
        it.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('filter',{detail:{group:undefined},b: b})));brandsRoot.appendChild(it)
      });
      try{ document.dispatchEvent(new CustomEvent('brands:rendered')); }catch(e){}
    }
      }catch(err){
        console.error('menu.js init error:', err);
      }
    }

    document.addEventListener('DOMContentLoaded', setup);
    document.addEventListener('header:loaded', setup);
    document.addEventListener('site-settings-updated', setup);
    if(!settingsListenersBound){
      settingsListenersBound = true;
      window.addEventListener('storage', (ev)=>{
        if(ev && ev.key === 'site_settings') setup();
      });
    }
    if(document.readyState !== 'loading'){ setup(); }
  })();
})();
