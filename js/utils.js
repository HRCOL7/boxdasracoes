(function(){
  // Minimal safe localStorage JSON helpers
  function safeReadJSON(key, defaultValue){
    try{
      const raw = localStorage.getItem(key);
      if(raw === null || raw === undefined || raw === '') return defaultValue === undefined ? [] : defaultValue;
      return JSON.parse(raw);
    }catch(e){
      console.error('safeReadJSON failed for', key, e);
      return defaultValue === undefined ? [] : defaultValue;
    }
  }
  function safeSaveJSON(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.error('safeSaveJSON failed for', key, e);
      return false;
    }
  }
  window.appUtils = window.appUtils || {};
  window.appUtils.readJSON = window.appUtils.readJSON || safeReadJSON;
  window.appUtils.saveJSON = window.appUtils.saveJSON || safeSaveJSON;
  const SITE_SETTINGS_KEY = 'site_settings';
  const DEFAULT_SITE_SETTINGS = {
    banners: ['img/banner1.jpg','img/banner2.jpg','img/banner3.jpg'],
    brands: [
      { name: 'MarcaA', image: '' },
      { name: 'MarcaB', image: '' },
      { name: 'MarcaC', image: '' }
    ],
    categories: [
      { title:'CÃES', subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
      { title:'GATOS', subs:['Ração Seca','Ração Úmida','Brinquedos','Acessórios','Higiene & Limpeza']},
      { title:'OUTROS', subs:['Peixes','Aves','Roedores']},
      { title:'MEDICAMENTOS', subs:['Antibióticos','Antifúngicos','Anti-inflamatórios','Analgésicos','Suplementos e Vitaminas','Dermatológicos','Antiparasitários']},
      { title:'PROMOÇÕES', subs:[]}
    ],
    whatsappIncludeCustomerData: true
  };

  function normalizeSettings(input){
    const raw = input && typeof input === 'object' ? input : {};
    const banners = Array.isArray(raw.banners) ? raw.banners.map(x=>String(x||'').trim()).filter(Boolean) : DEFAULT_SITE_SETTINGS.banners.slice();
    const brands = Array.isArray(raw.brands)
      ? raw.brands
          .map(b=>{
            if(typeof b === 'string') return { name: String(b).trim(), image: '' };
            if(!b || typeof b !== 'object') return null;
            return { name: String(b.name||'').trim(), image: String(b.image||'').trim() };
          })
          .filter(b=>b && b.name)
      : DEFAULT_SITE_SETTINGS.brands.slice();
    const categories = Array.isArray(raw.categories)
      ? raw.categories
          .map(c=>{
            if(!c || typeof c !== 'object') return null;
            const title = String(c.title||'').trim();
            if(!title) return null;
            const subs = Array.isArray(c.subs) ? c.subs.map(s=>String(s||'').trim()).filter(Boolean) : [];
            return { title, subs };
          })
          .filter(Boolean)
      : DEFAULT_SITE_SETTINGS.categories.slice();
    return {
      banners: banners.length ? banners : DEFAULT_SITE_SETTINGS.banners.slice(),
      brands: brands.length ? brands : DEFAULT_SITE_SETTINGS.brands.slice(),
      categories: categories.length ? categories : DEFAULT_SITE_SETTINGS.categories.slice(),
      whatsappIncludeCustomerData: raw.whatsappIncludeCustomerData !== false
    };
  }

  function getSiteSettings(){
    const saved = safeReadJSON(SITE_SETTINGS_KEY, {});
    return normalizeSettings(saved);
  }

  function saveSiteSettings(settings){
    const normalized = normalizeSettings(settings);
    const ok = safeSaveJSON(SITE_SETTINGS_KEY, normalized);
    if(ok){
      // keep cross-device copy in Supabase when available (non-blocking)
      try{
        if(window.supa && typeof window.supa.saveSiteSettings === 'function'){
          Promise.resolve(window.supa.saveSiteSettings(normalized)).catch(e=>{
            console.warn('saveSiteSettings Supabase sync failed', e);
          });
        }
      }catch(e){ console.warn('saveSiteSettings Supabase sync setup failed', e); }
      try{ document.dispatchEvent(new CustomEvent('site-settings-updated', { detail: normalized })); }catch(e){}
    }
    return ok;
  }

  async function syncSiteSettingsFromSupabase(){
    try{
      if(!window.supa || typeof window.supa.getSiteSettings !== 'function') return false;
      const remote = await window.supa.getSiteSettings();
      if(!remote || typeof remote !== 'object') return false;
      const normalized = normalizeSettings(remote);
      const current = normalizeSettings(safeReadJSON(SITE_SETTINGS_KEY, {}));
      const remoteStr = JSON.stringify(normalized);
      const currentStr = JSON.stringify(current);
      if(remoteStr === currentStr) return true;
      const ok = safeSaveJSON(SITE_SETTINGS_KEY, normalized);
      if(ok){
        try{ document.dispatchEvent(new CustomEvent('site-settings-updated', { detail: normalized })); }catch(e){}
      }
      return ok;
    }catch(e){
      console.warn('syncSiteSettingsFromSupabase failed', e);
      return false;
    }
  }

  window.appUtils.SITE_SETTINGS_KEY = window.appUtils.SITE_SETTINGS_KEY || SITE_SETTINGS_KEY;
  window.appUtils.DEFAULT_SITE_SETTINGS = window.appUtils.DEFAULT_SITE_SETTINGS || DEFAULT_SITE_SETTINGS;
  window.appUtils.getSiteSettings = window.appUtils.getSiteSettings || getSiteSettings;
  window.appUtils.saveSiteSettings = window.appUtils.saveSiteSettings || saveSiteSettings;
  window.appUtils.syncSiteSettingsFromSupabase = window.appUtils.syncSiteSettingsFromSupabase || syncSiteSettingsFromSupabase;

  // Attempt one background sync after initial scripts load.
  function scheduleSettingsSync(){
    setTimeout(()=>{ syncSiteSettingsFromSupabase(); }, 800);
    setTimeout(()=>{ syncSiteSettingsFromSupabase(); }, 2500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSettingsSync);
  else scheduleSettingsSync();
  // parser for garantia (nutritional table) shared by admin and product pages
  function buildGarantiaHtml(raw){
    let s = String(raw||'').trim();
    if(!s) return '';
    if(s.indexOf('<table') !== -1){
      s = s.replace(/<table([^>]*)>/i, function(full, attrs){
        if(/class=/.test(attrs)) return '<table' + attrs + '>';
        return '<table class="nutri-table"' + (attrs||'') + '>';
      });
      return s;
    }
    let rows = s.split(/\r?\n/).map(r=>r.trim()).filter(Boolean);
    if(rows.length===1 && rows[0].includes(',') && rows[0].split(',').length>2){
      const tokens = rows[0].split(',').map(t=>t.trim()).filter(Boolean);
      const paired = [];
      for(let i=0;i<tokens.length;i+=2){ const label = tokens[i]||''; const val = (i+1<tokens.length)? tokens[i+1] : ''; paired.push(label + ',' + val); }
      rows = paired;
    }
    if(rows.length===0) return '';
    const parsed = rows.map(r=>{
      const partsComma = r.split(',').map(c=>c.trim());
      if(partsComma.length>1){
        const label = partsComma[0]||'';
        let val = partsComma[1]||'';
        let pct = partsComma[2] || '';
        if(String(val).indexOf('%') !== -1 && !pct){ pct = val; val = ''; }
        const normNum = (s)=>{ if(!s) return null; const cleaned = String(s).replace('%','').replace(/[^0-9\.,\-]/g,'').replace(',', '.'); const n = parseFloat(cleaned); return isNaN(n)? null : n; };
        const numVal = normNum(val);
        const numPct = normNum(pct);
        const isPercent = !!pct;
        return {label, rawVal: val||'', rawPct: pct||'', isPercent: isPercent, num: isPercent ? numPct : numVal};
      }
      const tokens = r.split(/\s+/).filter(Boolean);
      let pctToken = null; let unitToken = null;
      if(tokens.length>0 && /\d+[\.,]?\d*%$/.test(tokens[tokens.length-1])){ pctToken = tokens.pop(); }
      if(!pctToken && tokens.length>0 && /%$/.test(tokens[tokens.length-1])){ pctToken = tokens.pop(); }
      if(tokens.length>0 && /\d+[\.,]?\d*(mg|g|kg|kcal|g\/kg|mg\/kg|kcal\/kg)?$/i.test(tokens[tokens.length-1])){ unitToken = tokens.pop(); }
      const label = tokens.join(' ');
      const num = unitToken ? (function(s){ const cleaned = String(s).replace(/[^0-9\.,\-]/g,'').replace(',', '.'); const n = parseFloat(cleaned); return isNaN(n)? null : n })(unitToken) : null;
      return {label, rawVal: unitToken||'', rawPct: pctToken||'', isPercent: !!pctToken, num: num};
    });
    const fixedSum = parsed.reduce((s,r)=> s + (r.isPercent && r.num? r.num : 0), 0);
    const numericSum = parsed.reduce((s,r)=> s + (r.num !== null && !r.isPercent ? r.num : 0), 0);
    const targetForNumeric = fixedSum>0 ? Math.max(0, 100 - fixedSum) : 100;
    let html = '<table class="nutri-table"><thead><tr><th>Componente</th><th>Valor</th><th>%</th></tr></thead><tbody>';
    parsed.forEach(r=>{
      let pct = '';
      if(r.rawPct){ pct = r.rawPct; }
      else if(r.isPercent && r.num !== null){ pct = (r.num) + '%'; }
      else if(r.num !== null){ const computed = numericSum>0 ? (r.num / numericSum) * targetForNumeric : 0; const val = Math.round(computed * 100) / 100; pct = (Number.isInteger(val) ? String(val) : String(val).replace('.',',')) + '%'; }
      const displayVal = r.rawVal || '';
      html += '<tr><td>' + (r.label.replace(/</g,'&lt;')) + '</td><td>' + (displayVal.replace(/</g,'&lt;')) + '</td><td>' + pct + '</td></tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  window.appUtils.buildGarantiaHtml = window.appUtils.buildGarantiaHtml || buildGarantiaHtml;
  function escapeHtml(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  window.appUtils.escapeHtml = window.appUtils.escapeHtml || escapeHtml;
  // standardized payment label map (code -> display)
  const PAYMENT_LABELS = {
    PIX: 'PIX',
    DEBITO: 'DÉBITO',
    CREDITO: 'CRÉDITO',
    DINHEIRO: 'DINHEIRO',
    BANESE_CREDITO: 'BANESE CRÉDITO',
    BANESE_DEBITO: 'BANESE DÉBITO',
    LINK: 'LINK DE PAGAMENTO'
  };
  window.appUtils.paymentLabels = window.appUtils.paymentLabels || PAYMENT_LABELS;
})();
