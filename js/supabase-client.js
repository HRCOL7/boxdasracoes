/* Lightweight Supabase client wrapper with safe fallback.
   Usage (in HTML before this script loads):
   <script>window.SUPABASE_CONFIG = { url: 'https://xxx.supabase.co', anonKey: 'public-anon-key' }</script>
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js"></script>
   <script src="../js/supabase-client.js" defer></script>

   This module exposes `window.supa` with methods:
   - init()
   - getProducts({ offset, limit, search })
   - upsertProduct(product)
   - deleteProduct(id)
   - uploadFile(bucket, file) -> returns { publicURL }
   Falls back to `window.idbProducts` or localStorage when not configured.
*/
(function(){
  const LOG_PREFIX = '[supabase-client]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);
  const logError = (message, ...args) => console.error(`${LOG_PREFIX} ${message}`, ...args);
  let client = null;
  function init(){
    if(client) return client;
    try{
      const cfg = (window.SUPABASE_CONFIG || null);
      if(cfg && window.supabase){
        client = window.supabase.createClient(cfg.url, cfg.anonKey);
      }
    }catch(e){ logWarn('Supabase client init failed', e); client = null; }
    return client;
  }

  async function getProducts({ offset = 0, limit = 50, search = '' } = {}){
    const supa = init();
    if(supa){
      try{
        let q = supa.from('products').select('*').order('id', { ascending: true }).range(offset, offset + limit - 1);
        if(search && String(search).trim()){
          // basic ilike filter for name or group
          const s = `%${String(search).trim()}%`;
          q = supa.from('products').select('*').or(`name.ilike.${s},group.ilike.${s}` ).order('id', { ascending: true }).range(offset, offset + limit - 1);
        }
        const { data, error } = await q;
        if(error) throw error;
        return { results: data || [], total: null };
      }catch(err){ logError('Supabase getProducts failed', err); }
    }
    // fallback
    if(window.idbProducts && typeof window.idbProducts.getPage === 'function'){
      const results = await window.idbProducts.getPage(offset, limit);
      const total = (window.idbProducts && typeof window.idbProducts.count === 'function') ? await window.idbProducts.count() : null;
      return { results, total };
    }
    try{ const arr = JSON.parse(localStorage.getItem('products')||'[]'); return { results: arr.slice(offset, offset+limit), total: arr.length }; }catch(e){ return { results:[], total:0 }; }
  }

  async function upsertProduct(p){
    const supa = init();
    if(supa){
      try{
        const res = await supa.from('products').upsert(p, { onConflict: ['id'] }).select();
        // res may be { data, error } or SDK-specific shape
        const data = res && (res.data || res) && (res.data || res.data === null ? res.data : res);
        const error = res && res.error ? res.error : null;
        if(error) {
          logError('Supabase upsert returned error', error, res);
          throw error;
        }
        // prefer first item from data array when present
        if(Array.isArray(data)) return data[0];
        return data;
      }catch(err){ logError('Supabase upsert failed', err); throw err; }
    }
    // fallback to idb/localStorage
    if(window.idbProducts && typeof window.idbProducts.put === 'function'){ await window.idbProducts.put(p); return p; }
    try{ const arr = JSON.parse(localStorage.getItem('products')||'[]'); const idx = arr.findIndex(x=>x.id===p.id); if(idx>-1) arr[idx]=p; else arr.push(p); localStorage.setItem('products', JSON.stringify(arr)); return p; }catch(e){ throw e; }
  }

  async function deleteProduct(id){
    const supa = init();
    if(supa){ const { error } = await supa.from('products').delete().eq('id', id); if(error) throw error; return true; }
    if(window.idbProducts && typeof window.idbProducts.delete === 'function'){ await window.idbProducts.delete(id); return true; }
    try{ const arr = JSON.parse(localStorage.getItem('products')||'[]'); const idx = arr.findIndex(x=>x.id===id); if(idx>-1){ arr.splice(idx,1); localStorage.setItem('products', JSON.stringify(arr)); } return true; }catch(e){ throw e; }
  }

  async function uploadFile(bucket, file){
    const supa = init();
    if(!supa) throw new Error('Supabase not configured');
    try{
      const key = `${Date.now()}_${(file.name||'upload').replace(/[^a-z0-9\.\-]/gi,'_')}`;
      const { data, error } = await supa.storage.from(bucket).upload(key, file, { upsert: false });
      if(error) throw error;
      // getPublicUrl may return different shapes across SDK versions
      const pub = supa.storage.from(bucket).getPublicUrl(data.path);
      let publicUrl = null;
      if(pub){
        if(pub.data && pub.data.publicUrl) publicUrl = pub.data.publicUrl;
        else if(pub.publicUrl) publicUrl = pub.publicUrl;
        else if(pub.publicURL) publicUrl = pub.publicURL;
      }
      if(!publicUrl){ logWarn('Could not determine public URL shape from getPublicUrl response', pub); }
      return { publicURL: publicUrl || null, raw: pub };
    }catch(err){ logError('Supabase upload failed', err); throw err; }
  }
  // realtime helper for products table
  let _productsSub = null;
  function _normalizeRecord(payload){
    // payload may come in different shapes depending on client version
    if(!payload) return null;
    return payload.new || payload.record || payload || payload.data || null;
  }

  async function subscribeProducts(handler){
    const supa = init();
    if(!supa) throw new Error('Supabase not configured');
    // unsubscribe existing
    try{ unsubscribeProducts(); }catch(e){}

    // v2: use Realtime channels
    if(typeof supa.channel === 'function'){
      try{
        const ch = supa.channel('products:changes');
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
          const event = payload.eventType || payload.event || payload.type || null;
          const record = payload.new || payload.record || null;
          const oldRecord = payload.old || null;
          handler && handler({ event, record, oldRecord, raw: payload });
        });
        ch.subscribe();
        _productsSub = { type: 'channel', sub: ch };
        return _productsSub;
      }catch(err){ logWarn('subscribeProducts channel failed', err); }
    }

    // v1-style fallback: from(...).on(...).subscribe()
    try{
      const ins = supa.from('products').on('INSERT', payload => { handler && handler({ event: 'INSERT', record: _normalizeRecord(payload) }); }).subscribe();
      const upd = supa.from('products').on('UPDATE', payload => { handler && handler({ event: 'UPDATE', record: _normalizeRecord(payload) }); }).subscribe();
      const del = supa.from('products').on('DELETE', payload => { handler && handler({ event: 'DELETE', record: _normalizeRecord(payload) }); }).subscribe();
      _productsSub = { type: 'v1', subs: [ins, upd, del] };
      return _productsSub;
    }catch(err){ logWarn('subscribeProducts fallback failed', err); throw err; }
  }

  function unsubscribeProducts(){
    if(!_productsSub) return;
    try{
      if(_productsSub.type === 'channel' && _productsSub.sub && typeof _productsSub.sub.unsubscribe === 'function'){
        _productsSub.sub.unsubscribe();
      } else if(_productsSub.type === 'v1' && Array.isArray(_productsSub.subs)){
        _productsSub.subs.forEach(s=>{ try{ s.unsubscribe(); }catch(e){} });
      }
    }catch(e){ logWarn('unsubscribeProducts error', e); }
    _productsSub = null;
  }

  // Auth helpers (wrap v2/v1 differences)
  async function signIn(email, password){
    const supa = init(); if(!supa) throw new Error('Supabase not configured');
    try{
      if(supa.auth && typeof supa.auth.signInWithPassword === 'function'){
        const res = await supa.auth.signInWithPassword({ email, password });
        if(res.error) throw res.error; return res;
      }
      if(supa.auth && typeof supa.auth.signIn === 'function'){
        const res = await supa.auth.signIn({ email, password });
        if(res.error) throw res.error; return res;
      }
      throw new Error('Auth API not available');
    }catch(err){ logError('supa.signIn failed', err); throw err; }
  }

  async function resendConfirmation(email){
    const supa = init();
    if(!supa) throw new Error('Supabase not configured');
    const safeEmail = String(email || '').trim();
    if(!safeEmail) throw new Error('Email is required');

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    try{
      if(supa.auth && typeof supa.auth.resend === 'function'){
        const res = await supa.auth.resend({
          type: 'signup',
          email: safeEmail,
          options: { emailRedirectTo: redirectTo }
        });
        if(res && res.error) throw res.error;
        return res;
      }
      throw new Error('Auth resend API not available');
    }catch(err){ logWarn('supa.resendConfirmation failed', err); throw err; }
  }

  async function signOut(){
    const supa = init(); if(!supa) throw new Error('Supabase not configured');
    try{ if(supa.auth && typeof supa.auth.signOut === 'function') return await supa.auth.signOut(); }catch(err){ logWarn('supa.signOut failed', err); throw err; }
  }

  async function getUser(){
    const supa = init(); if(!supa) return null;
    try{
      if(supa.auth && typeof supa.auth.getUser === 'function'){
        const r = await supa.auth.getUser(); return r && r.data ? r.data.user : null;
      }
      // v1 fallback
      if(supa.auth && typeof supa.auth.user === 'function'){
        return supa.auth.user();
      }
      return null;
    }catch(e){ logWarn('supa.getUser failed', e); return null; }
  }

  function onAuthStateChange(cb){
    const supa = init(); if(!supa || !supa.auth || typeof supa.auth.onAuthStateChange !== 'function') return ()=>{};
    const sub = supa.auth.onAuthStateChange((event, session) => { try{ cb && cb(event, session); }catch(e){ logWarn('onAuthStateChange handler error', e); } });
    return () => { try{ if(sub && typeof sub.unsubscribe === 'function') sub.unsubscribe(); }catch(e){} };
  }

  window.supa = { init, getProducts, upsertProduct, deleteProduct, uploadFile, subscribeProducts, unsubscribeProducts, signIn, signOut, getUser, onAuthStateChange, resendConfirmation };
})();
