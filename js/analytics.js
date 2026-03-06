(function(){
  const KEY_SESSION = 'site_session_id';
  const KEY_SENT = 'site_analytics_sent';

  function getSessionId(){
    try{
      let sid = localStorage.getItem(KEY_SESSION);
      if(sid) return sid;
      sid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY_SESSION, sid);
      return sid;
    }catch(e){
      return 's_' + Date.now().toString(36);
    }
  }

  function markSent(key){
    try{
      const raw = localStorage.getItem(KEY_SENT) || '{}';
      const obj = JSON.parse(raw);
      obj[key] = Date.now();
      localStorage.setItem(KEY_SENT, JSON.stringify(obj));
    }catch(e){}
  }

  function wasSent(key){
    try{
      const raw = localStorage.getItem(KEY_SENT) || '{}';
      const obj = JSON.parse(raw);
      return !!obj[key];
    }catch(e){ return false; }
  }

  async function track(eventType, payload){
    try{
      const client = (window.supa && typeof window.supa.init === 'function') ? window.supa.init() : null;
      if(!client || !client.from) return false;
      const body = payload && typeof payload === 'object' ? payload : {};
      const row = {
        event_type: String(eventType || '').trim(),
        page_path: location.pathname || '/',
        product_id: body.product_id || null,
        order_number: body.order_number || null,
        total: body.total || null,
        payment: body.payment || null,
        session_id: getSessionId(),
        meta: body.meta || null
      };
      if(!row.event_type) return false;
      const { error } = await client.from('site_events').insert(row);
      if(error) return false;
      return true;
    }catch(e){
      return false;
    }
  }

  function trackPageView(){
    const key = 'pv:' + location.pathname + ':' + getSessionId();
    if(wasSent(key)) return;
    markSent(key);
    track('page_view', { meta: { title: document.title || '' } });

    if(location.pathname.toLowerCase().includes('product.html')){
      const idRaw = new URL(location.href).searchParams.get('id');
      const idNum = idRaw ? Number(idRaw) : null;
      track('product_view', { product_id: Number.isFinite(idNum) ? idNum : null });
    }
  }

  window.siteAnalytics = {
    track
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }
})();
