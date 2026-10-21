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
      panel=document.createElement('nav');panel.id='side-menu';panel.className='side-menu';panel.setAttribute('aria-label','Categorias de produtos');panel.inert=true;
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

      const icons = {"CÃES": "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><path d=\"M12 14c-3 0-5 2-5 4 0 1.5 1.5 2.5 3 2.5.8 0 1.4-.3 2-.3s1.2.3 2 .3c1.5 0 3-1 3-2.5 0-2-2-4-5-4z\"/><circle cx=\"6\" cy=\"10\" r=\"1.6\"/><circle cx=\"10\" cy=\"6.5\" r=\"1.6\"/><circle cx=\"14\" cy=\"6.5\" r=\"1.6\"/><circle cx=\"18\" cy=\"10\" r=\"1.6\"/></svg>", "GATOS": "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><path d=\"M5 10l1-6 4 3h4l4-3 1 6v4a7 7 0 0 1-14 0z\"/><path d=\"M9.5 12v.5M14.5 12v.5M10 16c1.3.8 2.7.8 4 0\"/></svg>", "MEDICAMENTOS": "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><path d=\"M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7z\"/><path d=\"M8.5 8.5l7 7\"/></svg>", "PROMOÇÕES": "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><path d=\"M3 12V4h8l10 10-8 8z\"/><circle cx=\"7.5\" cy=\"8.5\" r=\"1.3\"/></svg>", "OUTROS": "<svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" focusable=\"false\"><path d=\"M5 8h14l-1 12H6z\"/><path d=\"M9 8a3 3 0 0 1 6 0\"/></svg>"};

      menu.forEach(item=>{
        const row=document.createElement('div'); row.className='side-row';
        const header=document.createElement('div'); header.className='side-row-header';
        const hasSubs = !!(item.subs && item.subs.length);
        const left=document.createElement(hasSubs ? 'button' : 'a'); left.className='side-row-left';
        if(hasSubs){ left.type='button'; left.setAttribute('aria-expanded','false'); }
        else { left.href = 'products.html?group=' + encodeURIComponent(slugify(item.title)); }
        const iconSpan=document.createElement('span'); iconSpan.className='side-icon'; iconSpan.innerHTML = icons[item.title] || '';
        const txt=document.createElement('span'); txt.className='side-title'; txt.textContent = item.title;
        left.appendChild(iconSpan); left.appendChild(txt);
        header.appendChild(left);

        if(item.subs && item.subs.length){
          const arrow=document.createElement('button'); arrow.className='side-arrow'; arrow.type='button'; arrow.setAttribute('aria-expanded','false'); arrow.setAttribute('aria-hidden','true'); arrow.tabIndex=-1; /* duplicado do botão ao lado: só para mouse */
          arrow.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          header.appendChild(arrow);
          const subul=document.createElement('div'); subul.className='side-submenu'; subul.id='side-sub-' + slugify(item.title); left.setAttribute('aria-controls', subul.id);
          item.subs.forEach(s=>{
            const li=document.createElement('a'); li.className='side-sub'; li.textContent=s;
            li.href = 'products.html?group=' + encodeURIComponent(slugify(item.title)) + '&sub=' + encodeURIComponent(slugify(s));
            subul.appendChild(li);
          });
          row.appendChild(header);
          row.appendChild(subul);

          // toggle: close other submenus first, then toggle this one
          function toggleThis(){
            const panel = document.getElementById('side-menu');
            if(panel){
              panel.querySelectorAll('.side-submenu.open').forEach(s=>{
                if(s!==subul){ s.classList.remove('open'); const a = s.parentElement.querySelector('.side-arrow'); if(a){ a.classList.remove('rotated'); a.setAttribute('aria-expanded','false'); } const l = s.parentElement.querySelector('.side-row-left'); if(l) l.setAttribute('aria-expanded','false'); }
              });
            }
            const open = arrow.getAttribute('aria-expanded') === 'true';
            arrow.setAttribute('aria-expanded', String(!open));
            left.setAttribute('aria-expanded', String(!open));
            subul.classList.toggle('open', !open);
            arrow.classList.toggle('rotated', !open);
          }

          arrow.addEventListener('click',(e)=>{ e.stopPropagation(); toggleThis(); });
          left.addEventListener('click',(e)=>{ e.stopPropagation(); toggleThis(); });
        } else {
          // no subs: clicking header navigates to products for that group
          row.appendChild(header);
        }
        ul.appendChild(row);
      });

      const closeBtn=document.createElement('button'); closeBtn.type='button'; closeBtn.className='side-menu-close'; closeBtn.setAttribute('aria-label','Fechar menu'); closeBtn.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
      closeBtn.addEventListener('click',()=>closePanel(panel));
      const head=document.createElement('div'); head.className='side-head';
      head.innerHTML='<img class="side-logo" src="/img/logobox.png" alt="" width="44" height="44"><div class="side-brand"><strong>Box das Rações</strong><span>O que seu pet precisa?</span></div>';
      head.appendChild(closeBtn);
      const quick=document.createElement('div'); quick.className='side-quick';
      quick.innerHTML='<a href="/index.html">Início</a><a href="products.html?promo=1">Promoções</a><a href="products.html">Todos os produtos</a>';
      const lbl=document.createElement('p'); lbl.className='side-label'; lbl.textContent='Categorias';
      panel.appendChild(head); panel.appendChild(quick); panel.appendChild(lbl);
      panel.appendChild(ul); document.body.appendChild(panel);
      if(!document.getElementById('side-backdrop')){ const bd=document.createElement('div'); bd.id='side-backdrop'; bd.className='side-backdrop'; bd.addEventListener('click',()=>closePanel(panel)); document.body.appendChild(bd); }
      return panel;
    }

    let outsideClickHandler = null;
    let menuDialog = null;
    function closePanel(panel){
      if(!panel) return;
      // collapse any open submenus
      panel.querySelectorAll('.side-submenu.open').forEach(s=>s.classList.remove('open'));
      panel.querySelectorAll('.side-arrow.rotated').forEach(a=>a.classList.remove('rotated'));
      const arrows = panel.querySelectorAll('.side-arrow[aria-expanded]');
      if(arrows && arrows.length){ arrows.forEach(a=>a.setAttribute('aria-expanded','false')); }
      panel.querySelectorAll('.side-row-left[aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false'));
      panel.classList.remove('open');
      const bdc=document.getElementById('side-backdrop'); if(bdc) bdc.classList.remove('show');
      panel.inert = true;
      if(hamburger) hamburger.setAttribute('aria-expanded','false');
      if(menuDialog){ const d = menuDialog; menuDialog = null; d.close(); }
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
      const bdo=document.getElementById('side-backdrop'); if(bdo) bdo.classList.add('show');
      panel.inert = false;
      hamburger.setAttribute('aria-expanded','true');
      if(window.appA11y){ menuDialog = window.appA11y.openDialog(panel, { opener: hamburger, initialFocus: '.side-menu-close', onClose: ()=>closePanel(panel) }); }

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
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120" viewBox="0 0 220 120"><rect width="220" height="120" rx="14" fill="#ffffff"/><rect x="2" y="2" width="216" height="116" rx="12" fill="none" stroke="#e7e7e7"/><text x="110" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#bf5600">${label}</text></svg>`;
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
        const it=document.createElement('a');it.className='item'; it.href='products.html?brand=' + encodeURIComponent(b);
        const bEsc = esc(b);
        const image = (entry && typeof entry === 'object' && entry.image) ? String(entry.image).trim() : '';
        const imgUrl = image || fallbackBrandLogo(b);
        it.innerHTML=`<img src="${window.appUtils.safeImageUrl(imgUrl, fallbackBrandLogo(b))}" alt=""><div>${bEsc}</div>`;
        const imgEl = it.querySelector('img');
        if(imgEl){ imgEl.onerror = ()=>{ imgEl.src = fallbackBrandLogo(b); }; }
        brandsRoot.appendChild(it)
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
