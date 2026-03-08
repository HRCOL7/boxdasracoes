(function(){
  const KEY='products';
  const LOG_PREFIX = '[admin]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);
  const logError = (message, ...args) => console.error(`${LOG_PREFIX} ${message}`, ...args);
  const form=document.getElementById('product-form');
  // pagination state
  let currentPage = 1;
  let pageSize = 50;
  let totalCount = 0;
  let searchTerm = '';
  let isAdminAuthenticated = false;
  let currentAdminUser = null;
  function debounce(fn, wait){ let t=null; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a), wait); }; }
  function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function normalizeWeightKey(weight){
    return String(weight || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu,'')
      .toLowerCase()
      .replace(/\s+/g,'')
      .replace(/,/g,'.')
      .trim();
  }
  function escapeHtml(s){ if(window.appUtils && typeof window.appUtils.escapeHtml === 'function') return window.appUtils.escapeHtml(s); return String(s===null||s===undefined?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function highlight(text, term){ if(!term) return escapeHtml(text); const t = String(term); const parts = String(text||'').split(new RegExp('('+escapeRegExp(t)+')','i')); return parts.map(part=>{ if(part.toLowerCase() === t.toLowerCase()) return '<mark>'+escapeHtml(part)+'</mark>'; return escapeHtml(part); }).join(''); }
  function hasSupabaseConfig(){
    return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  }
  function normalizeEmail(email){ return String(email || '').trim().toLowerCase(); }
  function getAllowedAdminEmails(){
    const fromWindow = Array.isArray(window.ADMIN_ALLOWED_EMAILS) ? window.ADMIN_ALLOWED_EMAILS : [];
    const fromStorage = String(localStorage.getItem('admin_allowed_emails') || '')
      .split(',')
      .map(s=>normalizeEmail(s))
      .filter(Boolean);
    const all = fromWindow.concat(fromStorage).map(normalizeEmail).filter(Boolean);
    return Array.from(new Set(all));
  }
  function isAllowedAdminUser(user){
    const email = normalizeEmail(user && user.email ? user.email : '');
    if(!email) return false;
    const allowed = getAllowedAdminEmails();
    return allowed.includes(email);
  }
  function getSiteSettingsSafe(){
    try{
      if(window.appUtils && typeof window.appUtils.getSiteSettings === 'function') return window.appUtils.getSiteSettings();
    }catch(e){ logWarn('getSiteSettings failed', e); }
    return {
      banners: ['img/banner1.jpg','img/banner2.jpg','img/banner3.jpg'],
      brands: [{name:'MarcaA', image:''},{name:'MarcaB', image:''},{name:'MarcaC', image:''}],
      categories: [
        {title:'CÃES', subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
        {title:'GATOS', subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
        {title:'OUTROS', subs:['Peixes','Aves','Roedores']},
        {title:'MEDICAMENTOS', subs:['Antibióticos','Antifúngicos','Anti-inflamatórios','Analgésicos','Suplementos e Vitaminas','Dermatológicos','Antiparasitários']},
        {title:'PROMOÇÕES', subs:[]}
      ],
      whatsappIncludeCustomerData: true
    };
  }
  function saveSiteSettingsSafe(settings){
    try{
      if(window.appUtils && typeof window.appUtils.saveSiteSettings === 'function') return window.appUtils.saveSiteSettings(settings);
      localStorage.setItem('site_settings', JSON.stringify(settings));
      return true;
    }catch(e){ logError('saveSiteSettings failed', e); return false; }
  }

  let adminSiteSettings = getSiteSettingsSafe();

  function parseLines(text){ return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean); }
  function fileToDataURL(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(String(reader.result || ''));
      reader.onerror = ()=> reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }
  function parseBrands(text){
    return parseLines(text).map(line=>{
      const parts = line.split('|');
      const name = String(parts[0]||'').trim();
      const image = String(parts.slice(1).join('|')||'').trim();
      return name ? { name, image } : null;
    }).filter(Boolean);
  }
  function categoriesToTextSubs(subs){ return Array.isArray(subs) ? subs.join('\n') : ''; }
  function renderSettingsMediaPreview(){
    const bannersPreview = document.getElementById('admin-banners-preview');
    const brandsPreview = document.getElementById('admin-brands-preview');
    if(bannersPreview){
      bannersPreview.innerHTML = '';
      (adminSiteSettings.banners || []).slice(0, 8).forEach(src=>{
        const img = document.createElement('img');
        img.className = 'media-thumb';
        img.src = src;
        img.alt = 'banner';
        bannersPreview.appendChild(img);
      });
    }
    if(brandsPreview){
      brandsPreview.innerHTML = '';
      (adminSiteSettings.brands || []).slice(0, 12).forEach(entry=>{
        if(entry.image){
          const img = document.createElement('img');
          img.className = 'media-thumb';
          img.src = entry.image;
          img.alt = entry.name || 'marca';
          brandsPreview.appendChild(img);
        } else {
          const chip = document.createElement('div');
          chip.className = 'media-chip';
          chip.textContent = entry.name || 'Marca';
          brandsPreview.appendChild(chip);
        }
      });
    }
  }
  function renderCategorySelect(selectedTitle){
    const sel = document.getElementById('admin-category-select');
    if(!sel) return;
    sel.innerHTML = '';
    const categories = Array.isArray(adminSiteSettings.categories) ? adminSiteSettings.categories : [];
    categories.forEach(c=>{
      const o = document.createElement('option');
      o.value = c.title;
      o.textContent = c.title;
      if(selectedTitle && selectedTitle === c.title) o.selected = true;
      sel.appendChild(o);
    });
    if(!sel.value && sel.options.length){ sel.value = sel.options[0].value; }
    const current = categories.find(c=>c.title === sel.value);
    const nameEl = document.getElementById('admin-category-name');
    const subsEl = document.getElementById('admin-category-subs');
    if(nameEl) nameEl.value = current ? current.title : '';
    if(subsEl) subsEl.value = current ? categoriesToTextSubs(current.subs) : '';
  }
  function fillSiteSettingsForm(){
    adminSiteSettings = getSiteSettingsSafe();
    const bannersEl = document.getElementById('admin-banners');
    const brandsEl = document.getElementById('admin-brands');
    const whatsappToggle = document.getElementById('admin-whatsapp-customer-toggle');
    if(bannersEl) bannersEl.value = (adminSiteSettings.banners || []).join('\n');
    if(brandsEl) brandsEl.value = (adminSiteSettings.brands || []).map(b=>`${b.name}${b.image ? '|' + b.image : ''}`).join('\n');
    if(whatsappToggle) whatsappToggle.checked = adminSiteSettings.whatsappIncludeCustomerData !== false;
    renderCategorySelect();
    renderSettingsMediaPreview();
  }

  function bindSiteSettingsUI(){
    const settingsSaveBtn = document.getElementById('admin-settings-save');
    if(!settingsSaveBtn || settingsSaveBtn.dataset.bound === '1') return;
    settingsSaveBtn.dataset.bound = '1';

    const categorySelect = document.getElementById('admin-category-select');
    const categorySaveBtn = document.getElementById('admin-category-save');
    const categoryRemoveBtn = document.getElementById('admin-category-remove');
    const bannersFiles = document.getElementById('admin-banners-files');
    const bannersAddBtn = document.getElementById('admin-banners-add-files');
    const brandsFiles = document.getElementById('admin-brands-files');
    const brandsAddBtn = document.getElementById('admin-brands-add-files');

    async function appendBannerFiles(){
      const files = Array.from((bannersFiles && bannersFiles.files) || []);
      if(!files.length) return;
      const dataUrls = [];
      for(const f of files){
        try{ dataUrls.push(await fileToDataURL(f)); }catch(e){ logWarn('Failed to read banner file', e); }
      }
      const bannersEl = document.getElementById('admin-banners');
      const current = parseLines(bannersEl && bannersEl.value || '');
      const next = current.concat(dataUrls);
      if(bannersEl) bannersEl.value = next.join('\n');
      if(bannersFiles) bannersFiles.value = '';
    }

    async function appendBrandFiles(){
      const files = Array.from((brandsFiles && brandsFiles.files) || []);
      if(!files.length) return;
      const brandsEl = document.getElementById('admin-brands');
      const current = parseBrands(brandsEl && brandsEl.value || '');
      const appended = [];
      for(const f of files){
        try{
          const dataUrl = await fileToDataURL(f);
          const baseName = String(f.name || 'Marca').replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim();
          appended.push({ name: baseName || 'Marca', image: dataUrl });
        }catch(e){ logWarn('Failed to read brand file', e); }
      }
      const next = current.concat(appended);
      if(brandsEl) brandsEl.value = next.map(b=>`${b.name}${b.image ? '|' + b.image : ''}`).join('\n');
      if(brandsFiles) brandsFiles.value = '';
    }

    bannersAddBtn?.addEventListener('click', async ()=>{ await appendBannerFiles(); });
    brandsAddBtn?.addEventListener('click', async ()=>{ await appendBrandFiles(); });

    categorySelect?.addEventListener('change', ()=>{ renderCategorySelect(categorySelect.value); });

    categorySaveBtn?.addEventListener('click', async ()=>{
      if(!(await ensureAdminAuthenticated(true))) return;
      const nameEl = document.getElementById('admin-category-name');
      const subsEl = document.getElementById('admin-category-subs');
      const title = String(nameEl && nameEl.value || '').trim();
      if(!title){ alert('Informe o nome da categoria.'); return; }
      const subs = parseLines(subsEl && subsEl.value || '');
      const list = Array.isArray(adminSiteSettings.categories) ? adminSiteSettings.categories.slice() : [];
      const idx = list.findIndex(c=>String(c.title||'').toLowerCase() === title.toLowerCase());
      const next = { title, subs };
      if(idx >= 0) list[idx] = next; else list.push(next);
      adminSiteSettings = { ...adminSiteSettings, categories: list };
      if(!saveSiteSettingsSafe(adminSiteSettings)){ alert('Falha ao salvar categoria.'); return; }
      fillSiteSettingsForm();
      renderCategorySelect(title);
      alert('Categoria salva com sucesso.');
    });

    categoryRemoveBtn?.addEventListener('click', async ()=>{
      if(!(await ensureAdminAuthenticated(true))) return;
      const sel = document.getElementById('admin-category-select');
      const selected = String(sel && sel.value || '').trim();
      if(!selected){ alert('Selecione uma categoria para excluir.'); return; }
      if(!confirm('Excluir a categoria selecionada?')) return;
      const list = (adminSiteSettings.categories || []).filter(c=>c.title !== selected);
      adminSiteSettings = { ...adminSiteSettings, categories: list };
      if(!saveSiteSettingsSafe(adminSiteSettings)){ alert('Falha ao excluir categoria.'); return; }
      fillSiteSettingsForm();
      alert('Categoria excluída.');
    });

    settingsSaveBtn.addEventListener('click', async ()=>{
      if(!(await ensureAdminAuthenticated(true))) return;
      const bannersEl = document.getElementById('admin-banners');
      const brandsEl = document.getElementById('admin-brands');
      const whatsappToggle = document.getElementById('admin-whatsapp-customer-toggle');

      const banners = parseLines(bannersEl && bannersEl.value || '');
      const brands = parseBrands(brandsEl && brandsEl.value || '');
      const categories = Array.isArray(adminSiteSettings.categories) ? adminSiteSettings.categories : [];
      const next = {
        ...adminSiteSettings,
        banners,
        brands,
        categories,
        whatsappIncludeCustomerData: !!(whatsappToggle && whatsappToggle.checked)
      };
      adminSiteSettings = next;
      if(!saveSiteSettingsSafe(next)){ alert('Falha ao salvar configurações do site.'); return; }
      fillSiteSettingsForm();
      alert('Configurações do site salvas com sucesso.');
    });

    document.getElementById('admin-banners')?.addEventListener('input', ()=>{
      adminSiteSettings = { ...adminSiteSettings, banners: parseLines(document.getElementById('admin-banners').value) };
      renderSettingsMediaPreview();
    });
    document.getElementById('admin-brands')?.addEventListener('input', ()=>{
      adminSiteSettings = { ...adminSiteSettings, brands: parseBrands(document.getElementById('admin-brands').value) };
      renderSettingsMediaPreview();
    });
  }

  function bindHelpButtons(){
    let pop = document.getElementById('admin-help-popover');
    if(!pop){
      pop = document.createElement('div');
      pop.id = 'admin-help-popover';
      document.body.appendChild(pop);
    }

    function hide(){ pop.classList.remove('visible'); }
    function showFor(btn){
      const msg = btn && btn.dataset ? String(btn.dataset.help || '').trim() : '';
      if(!msg) return;
      pop.textContent = msg;
      const rect = btn.getBoundingClientRect();
      const top = Math.min(window.innerHeight - 20, rect.bottom + 10);
      const left = Math.min(window.innerWidth - 20, Math.max(12, rect.left - 10));
      pop.style.top = `${top}px`;
      pop.style.left = `${left}px`;
      pop.classList.add('visible');
    }

    if(document.body.dataset.helpBound !== '1'){
      document.body.dataset.helpBound = '1';
      document.addEventListener('click', (ev)=>{
        const btn = ev.target && ev.target.closest ? ev.target.closest('.help-btn') : null;
        if(btn){
          ev.preventDefault();
          if(pop.classList.contains('visible') && pop.textContent === String(btn.dataset.help||'')){
            hide();
          } else {
            showFor(btn);
          }
          return;
        }
        if(!ev.target.closest || !ev.target.closest('#admin-help-popover')) hide();
      });
      window.addEventListener('resize', hide);
      window.addEventListener('scroll', hide, true);
    }
  }

  // prefer the centralized parser in appUtils; keep a shim for backward compatibility
  window.buildGarantiaHtml = function(raw){
    try{
      if(window.appUtils && typeof window.appUtils.buildGarantiaHtml === 'function') return window.appUtils.buildGarantiaHtml(raw);
    }catch(e){ logWarn('Failed to build garantia HTML via appUtils, using fallback', e); }
    return '';
  };
  // Async read/save helpers that prefer IndexedDB when available
  async function readAll(){
    try{
      if(window.idbProducts && typeof window.idbProducts.getAll === 'function'){
        return await window.idbProducts.getAll();
      }
      return JSON.parse(localStorage.getItem(KEY)||'[]');
    }catch(e){ logError('Failed to read products', e); return []; }
  }
  async function saveAll(list){
    try{
      if(window.idbProducts && typeof window.idbProducts.bulkPut === 'function'){
        // clear then bulk put to keep parity with previous semantics
        await window.idbProducts.clear();
        await window.idbProducts.bulkPut(list);
        return;
      }
      localStorage.setItem(KEY, JSON.stringify(list));
    }catch(e){ logError('Failed to save products', e); throw e; }
  }
  async function mirrorToLocalStorage(list){
    try{
      const payload = Array.isArray(list) ? list : await readAll();
      localStorage.setItem(KEY, JSON.stringify(payload));
    }catch(e){ logWarn('Failed to mirror products to localStorage', e); }
  }
  async function waitForAdminSupaReady(maxWaitMs = 5000){
    const started = Date.now();
    while((Date.now() - started) < maxWaitMs){
      try{
        const hasCfg = !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
        const hasHelper = !!(window.supa && typeof window.supa.getProducts === 'function');
        if(hasCfg && hasHelper) return true;
      }catch(e){ /* ignore */ }
      await new Promise(resolve=>setTimeout(resolve, 120));
    }
    return false;
  }
  async function hydrateAdminStoresFromSupabase(){
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
      if(window.idbProducts && typeof window.idbProducts.clear === 'function' && typeof window.idbProducts.bulkPut === 'function'){
        try{ await window.idbProducts.clear(); await window.idbProducts.bulkPut(merged); }catch(e){ logWarn('IDB hydrate from Supabase failed', e); }
      }
      await mirrorToLocalStorage(merged);
      return true;
    }catch(err){
      logWarn('hydrateAdminStoresFromSupabase failed', err);
      return false;
    }
  }
  async function renderAdmin(page = 1){
    currentPage = Number(page) || 1;
    const out=document.getElementById('admin-products'); if(!out) return; out.innerHTML='';
    const offset = (currentPage - 1) * pageSize;
    let products = [];
    try{
      if(searchTerm){
        if(window.idbProducts && typeof window.idbProducts.search === 'function'){
          const res = await window.idbProducts.search(searchTerm, offset, pageSize);
          products = res.results || [];
          totalCount = res.total || 0;
        } else {
          const all = await readAll();
          const filtered = all.filter(p=>{ const n=String(p.name||'').toLowerCase(); const g=String(p.group||'').toLowerCase(); return n.includes(searchTerm.toLowerCase()) || g.includes(searchTerm.toLowerCase()); });
          totalCount = filtered.length; products = filtered.slice(offset, offset + pageSize);
        }
      } else {
        if(window.idbProducts && typeof window.idbProducts.getPage === 'function'){
          products = await window.idbProducts.getPage(offset, pageSize);
          totalCount = (window.idbProducts && typeof window.idbProducts.count === 'function') ? await window.idbProducts.count() : products.length;
        } else {
          const all = await readAll(); totalCount = all.length; products = all.slice(offset, offset + pageSize);
        }
      }
    }catch(e){ logError('Failed to fetch products page', e); products = []; }
    products.forEach(p=>{
      const d=document.createElement('div');d.className='admin-row';
      const price = (Array.isArray(p.variants) && p.variants.length)? p.variants[0].price : Number(p.price||0);
      const primaryImg = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || '');
      const esc = (s)=> (window.appUtils && typeof window.appUtils.escapeHtml === 'function') ? window.appUtils.escapeHtml(s) : (s===null||s===undefined?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
      const imgSrcAttr = primaryImg ? String(primaryImg).replace(/"/g,'&quot;') : '';
      const img = primaryImg ? `<img class="admin-thumb" src="${imgSrcAttr}" alt="${esc(p.name||'')}">` : `<div style="width:72px;height:72px;border-radius:8px;background:#fafafa;border:1px solid #f0f0f0;display:flex;align-items:center;justify-content:center;color:#ccc">No img</div>`;
      const descRaw = p.description ? (p.description.length>120? p.description.slice(0,117)+'...' : p.description) : '';
      const highlightedTitle = highlight(p.name||'', searchTerm);
      const highlightedGroup = highlight(p.group||'', searchTerm);
      const highlightedDesc = highlight(descRaw, searchTerm);
      d.innerHTML = `
        <div class="meta">
          ${img}
          <div class="info">
            <div class="title">${highlightedTitle}</div>
            <div class="meta-small">${highlightedGroup} • R$ ${Number(price).toFixed(2)}</div>
            <div class="meta-small">${highlightedDesc}</div>
          </div>
        </div>
        <div class="row-actions"><button class="btn-edit" data-id="${p.id}">Editar</button><button class="btn-delete" data-id="${p.id}">Remover</button></div>
      `;
      out.appendChild(d);
    });
    // attach delegated handlers for edit/delete
    out.removeEventListener('click', adminListClickHandler);
    out.addEventListener('click', adminListClickHandler);
    // render/update pagination controls
    renderPaginationControls(totalCount, currentPage);
  }

  function renderPaginationControls(total, page){
    const tools = document.querySelector('.admin-tools'); if(!tools) return;
    let container = document.getElementById('admin-pagination');
    if(container) container.remove();
    container = document.createElement('div'); container.id = 'admin-pagination'; container.style.display = 'flex'; container.style.gap = '8px'; container.style.alignItems = 'center'; container.style.marginLeft = '12px';
    const totalPages = Math.max(1, Math.ceil((total||0)/pageSize));
    const prev = document.createElement('button'); prev.id='page-prev'; prev.className='btn'; prev.textContent='‹'; prev.disabled = page<=1;
    const next = document.createElement('button'); next.id='page-next'; next.className='btn'; next.textContent='›'; next.disabled = page>=totalPages;
    const info = document.createElement('span'); info.id='page-info'; info.textContent = `Página ${page} de ${totalPages} (${total} itens)`;
    const sizeSel = document.createElement('select'); sizeSel.id='page-size'; [25,50,100,200].forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent = String(s); if(s===pageSize) o.selected=true; sizeSel.appendChild(o); });
    container.appendChild(prev); container.appendChild(info); container.appendChild(next); container.appendChild(sizeSel);
    tools.appendChild(container);
    prev.addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; renderAdmin(currentPage); } });
    next.addEventListener('click', ()=>{ if(currentPage < totalPages){ currentPage++; renderAdmin(currentPage); } });
    sizeSel.addEventListener('change', (ev)=>{ pageSize = Number(ev.target.value)||50; currentPage = 1; renderAdmin(currentPage); });
  }

  function setAdminAuthState(user){
    const allowedUser = (user && isAllowedAdminUser(user)) ? user : null;
    currentAdminUser = allowedUser;
    isAdminAuthenticated = !!allowedUser;
    const modal = document.getElementById('admin-login');
    if(modal){
      if(isAdminAuthenticated) modal.classList.remove('visible');
      else modal.classList.add('visible');
    }
    if(form){
      form.querySelectorAll('input, select, textarea, button').forEach(el=>{ el.disabled = !isAdminAuthenticated; });
    }
  }

  async function ensureAdminAuthenticated(showWarning = true){
    try{
      if(window.supa && typeof window.supa.getUser === 'function'){
        const user = await window.supa.getUser();
        setAdminAuthState(user);
      }
    }catch(e){
      logWarn('Failed to verify admin auth state', e);
      setAdminAuthState(null);
    }
    if(isAdminAuthenticated) return true;
    if(showWarning) alert('Acesso negado. Faça login com um email autorizado como administrador.');
    return false;
  }

  // Delegated click handler defined separately so it can be attached/removed
  async function adminListClickHandler(e){
    const btn = e.target.closest && e.target.closest('.btn-delete, .btn-edit'); if(!btn) return;
    if(!(await ensureAdminAuthenticated(true))) return;
    const id = btn.dataset && btn.dataset.id; if(!id) return; const nid = Number(id);
    if(btn.classList.contains('btn-delete')){
      if(!confirm('Remover este produto?')) return;
      try{
        // In production with Supabase configured, do not allow local-only deletes.
        if(hasSupabaseConfig()){
          if(!(window.supa && typeof window.supa.deleteProduct === 'function')){
            throw new Error('Supabase não inicializado no cliente. Recarregue a página.');
          }
          await window.supa.deleteProduct(nid);
          await hydrateAdminStoresFromSupabase();
        } else if(window.idbProducts && typeof window.idbProducts.delete === 'function'){
          await window.idbProducts.delete(nid);
        } else {
          const arr = await readAll(); const idx = arr.findIndex(x=>x.id===nid); if(idx>-1){ arr.splice(idx,1); await saveAll(arr); }
        }
        await mirrorToLocalStorage();
        await renderAdmin();
      }catch(err){ logError('Failed to remove product', err); alert('Erro ao remover produto'); }
      return;
    }
    // edit
    try{
      let p = null;
      if(window.idbProducts && typeof window.idbProducts.get === 'function'){
        p = await window.idbProducts.get(nid);
      } else {
        const arr = await readAll(); p = arr.find(x=>x.id===nid);
      }
      if(!p) return;
      form.dataset.editId = p.id;
      const set = (name, val) => { const el = form.querySelector('[name="'+name+'"]'); if(!el) return; if(el.type==='checkbox'){ el.checked = !!val; } else { el.value = val===undefined ? '' : val; } };
      set('name', p.name || '');
      set('price', p.price || 0);
      set('group', p.group || '');
      set('brand', p.brand || '');
      set('subgroup', p.subgroup || '');
      set('internal', p.internal || '');
      set('description', p.description || '');
      set('garantia', p.garantia_raw || '');
      const variantsEl = form.querySelector('[name="variants"]');
      if(variantsEl){ variantsEl.value = Array.isArray(p.variants)? p.variants.map(v=> (v.weight||'')+','+(v.price||'')).join('\n') : ''; }
      const imagesHidden = form.querySelector('[name="images"]');
      if(imagesHidden){ imagesHidden.value = p.images ? JSON.stringify(p.images) : (p.image ? JSON.stringify([p.image]) : ''); }
      const imageUrls = form.querySelector('[name="image_urls"]');
      if(imageUrls){ imageUrls.value = (p.images||[]).filter(u=> typeof u === 'string' && /^https?:\/\//.test(u)).join('\n'); }
      const videoEl = form.querySelector('[name="video"]'); if(videoEl) videoEl.value = p.video || '';
      const imgIll = form.querySelector('[name="image_illustrative"]'); if(imgIll) imgIll.checked = !!p.image_illustrative;
      const promoEl = form.querySelector('[name="is_promo"]'); if(promoEl) promoEl.checked = !!p.is_promo;
      const promoPriceEl = form.querySelector('[name="promo_price"]'); if(promoPriceEl) promoPriceEl.value = (p.promo_price !== null && p.promo_price !== undefined) ? String(p.promo_price) : '';
      const promoVariantsEl = form.querySelector('[name="promo_variants"]');
      if(promoVariantsEl){
        const promoMap = (p && p.promo_variants && typeof p.promo_variants === 'object') ? p.promo_variants : {};
        promoVariantsEl.value = Object.keys(promoMap).map(weight=>`${weight},${promoMap[weight]}`).join('\n');
      }
      const unavailableEl = form.querySelector('[name="is_unavailable"]'); if(unavailableEl) unavailableEl.checked = !!p.is_unavailable;
      const promoPriceRow = document.getElementById('promo-price-row'); if(promoPriceRow) promoPriceRow.style.display = (promoEl && promoEl.checked) ? 'block' : 'none';
      const promoVariantsRow = document.getElementById('promo-variants-row'); if(promoVariantsRow) promoVariantsRow.style.display = (promoEl && promoEl.checked) ? 'block' : 'none';
      try{ const ev = new Event('input', { bubbles: true }); imageUrls?.dispatchEvent(ev); }catch(e){}
    }catch(err){ logError('Failed to populate edit form', err); }

  }
  if(form){
    // status UI helpers
    const statusEl = document.getElementById('admin-status');
    function showStatus(msg, type = 'info', autoHide = 5000){
      try{
        if(!statusEl) return;
        statusEl.style.display = 'block';
        statusEl.textContent = msg;
        statusEl.style.background = type === 'error' ? '#fee' : type === 'success' ? '#e6ffed' : '#eef6ff';
        statusEl.style.color = type === 'error' ? '#900' : '#062';
        statusEl.style.border = '1px solid '+(type === 'error' ? '#f5c6cb' : type === 'success' ? '#b8e5c7' : '#cce6ff');
        if(autoHide && autoHide > 0){ clearTimeout(statusEl._hideTimer); statusEl._hideTimer = setTimeout(()=>{ try{ statusEl.style.display='none'; }catch(e){} }, autoHide); }
      }catch(e){ logWarn('showStatus failed', e); }
    }
    function clearStatus(){ try{ if(!statusEl) return; statusEl.style.display='none'; clearTimeout(statusEl._hideTimer); }catch(e){} }
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      if(!(await ensureAdminAuthenticated(true))) return;
      const fd=new FormData(form);
      const editId = form.dataset.editId ? Number(form.dataset.editId) : null;
      const variantsRaw = fd.get('variants') || '';
      let variants = null;
      if(variantsRaw && String(variantsRaw).trim()){
        variants = String(variantsRaw).split(/\r?\n/).map(line=>{
          const parts = line.split(',').map(s=>s.trim());
          return { weight: parts[0]||'', price: parseFloat(parts[1]||0) };
        }).filter(v=>v.weight);
      }
      // process garantia (nutritional table) - accept CSV or HTML table
      const garantiaRaw = fd.get('garantia') || '';

      const videoValue = (function(){
        const v = fd.get('video');
        if(v === null || v === undefined) return null;
        const s = String(v).trim();
        return s ? s : null;
      })();

      const isPromo = !!fd.get('is_promo');
      const promoPriceRaw = String(fd.get('promo_price') || '').trim();
      const promoPriceValue = promoPriceRaw ? parseFloat(promoPriceRaw) : null;
      const promoPrice = (isPromo && Number.isFinite(promoPriceValue) && promoPriceValue > 0) ? promoPriceValue : null;
      const promoVariantsRaw = String(fd.get('promo_variants') || '').trim();
      const promoVariants = (function(){
        if(!isPromo || !promoVariantsRaw) return null;
        const map = {};
        String(promoVariantsRaw).split(/\r?\n/).forEach(line=>{
          const parts = String(line || '').split(',');
          const weight = String(parts[0] || '').trim();
          const price = parseFloat(String(parts.slice(1).join(',') || '').replace(',', '.'));
          const normalized = normalizeWeightKey(weight);
          if(normalized && Number.isFinite(price) && price > 0) map[normalized] = price;
        });
        return Object.keys(map).length ? map : null;
      })();
      const isUnavailable = !!fd.get('is_unavailable');

      const p={
        id: editId || Date.now(),
        name:fd.get('name'),
        description: fd.get('description') || '',
        group:fd.get('group'),
        subgroup:fd.get('subgroup'),
        brand:fd.get('brand'),
        garantia_raw: garantiaRaw,
        garantia: buildGarantiaHtml(garantiaRaw),
        variants: variants && variants.length? variants : undefined,
        // fallback single variant support
        variant: fd.get('variant') || undefined,
        price: parseFloat(fd.get('price')||0),
        // images: try JSON array from hidden field 'images' or fallback to single 'image' field
        images: (function(){ try{ const v = fd.get('images')||''; if(!v) return undefined; const parsed = JSON.parse(v); if(Array.isArray(parsed) && parsed.length){ // ensure max 7 images
              if(parsed.length > 7){ alert('Máximo 7 imagens por produto; imagens extras foram removidas.'); return parsed.slice(0,7); }
              return parsed; }
            return undefined; } catch(e){ return undefined } })(),
        // backward compatibility: single image
        image: fd.get('image') || (function(){ try{ const v = fd.get('images')||''; const parsed = JSON.parse(v||'[]'); return (Array.isArray(parsed) && parsed.length)? parsed[0] : undefined } catch(e){ return undefined } })(),
        image_illustrative: fd.get('image_illustrative') ? true : false,
        is_promo: isPromo,
        promo_price: promoPrice,
        promo_variants: promoVariants,
        is_unavailable: isUnavailable,
        video: videoValue,
        internal:fd.get('internal')
      };
      // Sanitize images: drop extremely large data: URLs to avoid localStorage quota exceeded
      try{
        const MAX_IMAGE_DATAURL_LENGTH = 5000000; // 5,000,000 chars (~4.77MB) for data: URLs
        if(Array.isArray(p.images) && p.images.length){
          const beforeCount = p.images.length;
          p.images = p.images.filter(src => {
            try{
              if(typeof src === 'string' && src.indexOf('data:') === 0 && src.length > MAX_IMAGE_DATAURL_LENGTH) return false;
            }catch(e){ }
            return true;
          });
          if(p.images.length === 0) p.images = undefined;
          if(p.images && p.images.length !== beforeCount){
            alert('Algumas imagens muito grandes foram removidas antes de salvar. Prefira URLs ou arquivos menores.');
          }
        }
        // ensure single image fallback matches sanitized images
        if(!p.image && Array.isArray(p.images) && p.images.length){ p.image = p.images[0]; }
      }catch(e){ logWarn('Image sanitize step failed (continuing submit)', e); }
      // protect against storing very large video data-URLs in localStorage
      try{
        if(p.video && typeof p.video === 'string' && p.video.indexOf('data:')===0 && p.video.length > 5000000){
          alert('O vídeo é muito grande para ser salvo em armazenamento local. Use um link externo (YouTube/Vimeo) ou um arquivo menor.');
          p.video = null;
        }
      }catch(e){}
      // If Supabase is configured, upload any data: image URLs to storage and replace them with public URLs
      try{
        if(window.supa && typeof window.supa.uploadFile === 'function' && Array.isArray(p.images) && p.images.length){
              showStatus('Iniciando upload de imagens...', 'info', 0);
          for(let i=0;i<p.images.length;i++){
            const src = p.images[i];
            if(typeof src === 'string' && src.indexOf('data:')===0){
              try{
                    showStatus('Enviando imagem ' + (i+1) + ' de ' + p.images.length + '...', 'info', 0);
                const parts = src.split(',');
                const meta = parts[0]; const dataBase64 = parts[1] || '';
                const m = /data:([a-zA-Z0-9\-\/+.]+);base64/.exec(meta);
                const mime = m && m[1] ? m[1] : 'application/octet-stream';
                const byteString = atob(dataBase64);
                const ia = new Uint8Array(byteString.length);
                for(let j=0;j<byteString.length;j++) ia[j]=byteString.charCodeAt(j);
                const blob = new Blob([ia], { type: mime });
                const filename = (p.id || Date.now()) + '_img_' + i + (mime.indexOf('png')>-1?'.png': mime.indexOf('jpeg')>-1?'.jpg':'.bin');
                const file = new File([blob], filename, { type: mime });
                try{
                  const up = await window.supa.uploadFile('product-media', file);
                  if(up && up.publicURL){ p.images[i] = up.publicURL; showStatus('Imagem '+(i+1)+' enviada', 'success', 1500); }
                  else { showStatus('Upload concluído (sem URL pública detectada)', 'info', 2000); }
                }catch(uerr){ logWarn('Image upload failed for one image, keeping original data URL', uerr); showStatus('Falha ao enviar imagem '+(i+1), 'error', 5000); }
              }catch(convErr){ logWarn('Failed to convert/upload image data URL', convErr); showStatus('Erro ao processar imagem '+(i+1), 'error', 5000); }
            }
          }
          clearStatus();
        }
      }catch(e){ logWarn('Error uploading images to Supabase', e); showStatus('Erro ao enviar imagens: '+(e && e.message?e.message:String(e)), 'error', 8000); }
      try{
        // In production with Supabase configured, do not allow local-only saves.
        if(hasSupabaseConfig()){
          if(!(window.supa && typeof window.supa.upsertProduct === 'function')){
            throw new Error('Supabase não inicializado no cliente. Recarregue a página.');
          }
          try{
              showStatus('Salvando produto no Supabase...', 'info', 0);
              const serverResult = await window.supa.upsertProduct(p);
            // if server returned an object, try to persist it locally for parity
            try{
              const toSave = serverResult && typeof serverResult === 'object' ? serverResult : p;
              if(window.idbProducts && typeof window.idbProducts.put === 'function'){
                await window.idbProducts.put(toSave);
              } else {
                const list = await readAll();
                if(editId){ const idx=list.findIndex(x=>x.id===editId); if(idx>-1) list[idx]=toSave; else list.push(toSave); }
                else { list.push(toSave); }
                await saveAll(list);
              }
            }catch(syncErr){ logWarn('Failed to sync server product locally', syncErr); }
          }catch(supaErr){
            logError('Supabase upsert failed', supaErr);
            throw supaErr;
          }
          await hydrateAdminStoresFromSupabase();
        } else if(window.idbProducts && typeof window.idbProducts.put === 'function'){
          await window.idbProducts.put(p);
        } else {
          const list = await readAll();
          if(editId){ const idx=list.findIndex(x=>x.id===editId); if(idx>-1) list[idx]=p; }
          else { list.push(p); }
          await saveAll(list);
        }
        await mirrorToLocalStorage();
        await renderAdmin(); form.reset(); delete form.dataset.editId;
        document.dispatchEvent(new CustomEvent('products-updated'));
      }catch(saveErr){
        logError('Failed to save products to localStorage', saveErr);
        try{
          const existing = await readAll();
          if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(JSON.stringify(existing, null, 2)); }
        }catch(copyErr){ logError('Failed to copy products JSON to clipboard', copyErr); }
        alert('Erro ao salvar cadastro no armazenamento local: ' + (saveErr && saveErr.message ? saveErr.message : String(saveErr)) + '\n\nOs dados foram copiados para a área de transferência (JSON) quando possível. Verifique o console para mais detalhes.');
      }
      
    });
  }

  // admin login modal logic
  document.addEventListener('DOMContentLoaded',()=>{
    (async ()=>{
      try{ await waitForAdminSupaReady(7000); }catch(e){ /* non-fatal */ }
      let hydrated = false;
      try{ hydrated = await hydrateAdminStoresFromSupabase(); }catch(e){ /* non-fatal */ }
      // if idbProducts available and localStorage has products, migrate them
      try{
        if(!hydrated && window.idbProducts && localStorage.getItem('products')){
          console.log('Starting migration from localStorage to IndexedDB...');
          document.addEventListener('idb-migration-progress', ev=>{ console.log('Migration progress', ev.detail); });
          const result = await window.idbProducts.migrateFromLocalStorage();
          console.log('Migration complete', result);
          // remove legacy localStorage to avoid duplication
          localStorage.removeItem('products');
        }
        await mirrorToLocalStorage();
      }catch(e){ logWarn('Migration failed', e); }
      await renderAdmin();
      fillSiteSettingsForm();
      bindSiteSettingsUI();
      bindHelpButtons();
      // wire search input with debounce
      const searchEl = document.getElementById('admin-search');
      if(searchEl){
        const onSearch = debounce(async (ev)=>{ searchTerm = String(ev.target.value||'').trim(); currentPage = 1; await renderAdmin(1); }, 250);
        searchEl.removeEventListener('input', onSearch);
        searchEl.addEventListener('input', onSearch);
      }
      await ensureAdminAuthenticated(false);
    })();
    const modal=document.getElementById('admin-login');
    const passInput=document.getElementById('admin-pass');
    const enter=document.getElementById('admin-enter');
    const close=document.getElementById('admin-close');
    if(modal){
      modal.classList.add('visible');
      enter.addEventListener('click', async ()=>{
          try{
            const emailEl = document.getElementById('admin-email');
            const email = emailEl && emailEl.value ? String(emailEl.value||'').trim() : '';
            const pass = passInput.value || '';
            if(!email || !pass){
              alert('Informe email e senha para entrar.');
              return;
            }
            if(window.supa && typeof window.supa.signIn === 'function'){
              try{
                await window.supa.signIn(email, pass);
                const user = (window.supa && typeof window.supa.getUser === 'function') ? await window.supa.getUser() : null;
                if(!user){ throw new Error('Sessão não encontrada após login.'); }
                if(!isAllowedAdminUser(user)){
                  try{ if(window.supa && typeof window.supa.signOut === 'function') await window.supa.signOut(); }catch(e){}
                  setAdminAuthState(null);
                  alert('Seu usuário está autenticado, mas não possui permissão de administrador.');
                  return;
                }
                setAdminAuthState(user);
                alert('Login efetuado com sucesso.');
                return;
              }catch(authErr){
                logWarn('Supabase sign-in failed', authErr);
                setAdminAuthState(null);
                alert('Falha ao autenticar via Supabase: ' + (authErr && authErr.message ? authErr.message : String(authErr)));
                return;
              }
            } else {
              alert('Supabase não está configurado no cliente. Verifique `config.js`.');
              return;
            }
          }catch(err){ logError('Admin password flow failed', err); alert('Erro ao validar a senha.'); }
        });
      close.addEventListener('click',()=>{ window.location.href = '../index.html'; });
      if(window.supa && typeof window.supa.onAuthStateChange === 'function'){
        try{
          window.supa.onAuthStateChange(async ()=>{ await ensureAdminAuthenticated(false); });
        }catch(e){ logWarn('onAuthStateChange bind failed', e); }
      }
    }
    document.getElementById('export-json')?.addEventListener('click', async ()=>{
      try{
        const offset = (currentPage - 1) * pageSize;
        let data = [];
        if(searchTerm){
          if(window.idbProducts && typeof window.idbProducts.search === 'function'){
            const res = await window.idbProducts.search(searchTerm, offset, pageSize);
            data = res.results || [];
          } else {
            const all = await readAll();
            const filtered = all.filter(p=>{ const n=String(p.name||'').toLowerCase(); const g=String(p.group||'').toLowerCase(); return n.includes(searchTerm.toLowerCase()) || g.includes(searchTerm.toLowerCase()); });
            data = filtered.slice(offset, offset + pageSize);
          }
        } else {
          if(window.idbProducts && typeof window.idbProducts.getPage === 'function'){
            data = await window.idbProducts.getPage(offset, pageSize);
          } else {
            const all = await readAll(); data = all.slice(offset, offset + pageSize);
          }
        }
        const payload = { meta: { page: currentPage, pageSize, total: totalCount || 0, search: searchTerm || '' }, results: data };
        const json = JSON.stringify(payload, null, 2);
        // create download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTerm = searchTerm ? ('_' + encodeURIComponent(searchTerm)) : '';
        a.download = `products_page${currentPage}${safeTerm}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        // also copy to clipboard when available
        if(navigator.clipboard && navigator.clipboard.writeText){
          try{ await navigator.clipboard.writeText(json); }catch(e){ /* ignore clipboard errors */ }
        }
        alert('JSON exportado (download criado e copiado para a área de transferência quando disponível)');
      }catch(err){ logError('Export failed', err); alert('Falha ao exportar JSON: '+ (err && err.message ? err.message : String(err))); }
    });

    document.getElementById('admin-logout')?.addEventListener('click', async ()=>{
      try{
        if(window.supa && typeof window.supa.signOut === 'function'){
          await window.supa.signOut();
        }
      }catch(err){
        logWarn('Sign out failed', err);
      }
      setAdminAuthState(null);
      alert('Sessão encerrada. Faça login novamente para continuar.');
    });

    // Clear only local cache (IDB/localStorage) - does not delete from Supabase
    document.getElementById('clear-products')?.addEventListener('click', async ()=>{
      if(!(await ensureAdminAuthenticated(true))) return;
      if(!confirm('Tem certeza? Isso limpará somente o cache local deste navegador (IndexedDB/localStorage). Os produtos do Supabase NÃO serão apagados.')) return;
      try{
        // export current DB to clipboard and offer download
        let data = [];
        if(window.idbProducts && typeof window.idbProducts.getAll === 'function'){
          data = await window.idbProducts.getAll();
        } else {
          data = JSON.parse(localStorage.getItem(KEY)||'[]');
        }
        const json = JSON.stringify({ exportedAt: new Date().toISOString(), results: data }, null, 2);
        try{ navigator.clipboard && navigator.clipboard.writeText && await navigator.clipboard.writeText(json); }catch(e){}
        const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'products_backup.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        // now clear local storage only
        if(window.idbProducts && typeof window.idbProducts.clear === 'function') await window.idbProducts.clear();
        localStorage.removeItem(KEY);
        alert('Cache local limpo com sucesso. Você pode recarregar os dados a partir do Supabase.');
        await renderAdmin(1);
      }catch(err){ logError('Clear local cache failed', err); alert('Falha ao limpar cache local: '+String(err)); }
    });
  });
})();
