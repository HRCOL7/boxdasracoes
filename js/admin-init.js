    document.addEventListener('DOMContentLoaded', ()=>{
      try{
        // attempt to initialize supabase client; no UI status created in production
        if(window.supa && typeof window.supa.init === 'function') window.supa.init();
      }catch(e){ console.warn('supa test failed', e); }
    });
  
