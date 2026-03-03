(function(){
  document.addEventListener('DOMContentLoaded',()=>{
    let liveSettingsBound = false;
    const fillBanner = ()=>{
      const el = document.getElementById('top-carousel');
      if(!el) return; el.innerHTML='';
      // attempt to use a global BANNERS array, otherwise default paths
      const defaults = ['img/banner1.jpg','img/banner2.jpg','img/banner3.jpg'];
      const configured = (window.appUtils && typeof window.appUtils.getSiteSettings === 'function')
        ? window.appUtils.getSiteSettings().banners
        : null;
      const banners = (window.BANNERS && window.BANNERS.length)
        ? window.BANNERS
        : (configured && configured.length ? configured : defaults);
      banners.forEach((src,idx)=>{
        const d = document.createElement('div'); d.className='item';
        const img = document.createElement('img'); img.src = src; img.alt = `Banner ${idx+1}`; img.loading='lazy';
        d.appendChild(img);
        el.appendChild(d);
      });
    };

    // generic carousel builder: selector - container (.carousel), options: {withNav, dots, visible}
    const makeScrollCarousel = (selector, opts={})=>{
      const root = document.querySelector(selector); if(!root) return;
      const withNav = !!opts.withNav;
      const dots = !!opts.dots;
      const visible = opts.visible || 1;

      // allow wheel horizontal scroll
      root.addEventListener('wheel', e=>{ if(Math.abs(e.deltaX) < Math.abs(e.deltaY)) { root.scrollLeft += e.deltaY; e.preventDefault(); }});

      // wrap root if nav/dots needed
      let wrap = root.parentNode;
      if(withNav || dots){
        wrap = document.createElement('div'); wrap.className = 'carousel-wrap';
        root.parentNode.insertBefore(wrap, root);
        wrap.appendChild(root);
      }

      // nav buttons
      let prev, next;
      if(withNav){
        prev = document.createElement('button'); prev.type='button'; prev.className='carousel-nav prev'; prev.setAttribute('aria-label','Anterior');
        prev.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        next = document.createElement('button'); next.type='button'; next.className='carousel-nav next'; next.setAttribute('aria-label','Próximo');
        next.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        wrap.appendChild(prev); wrap.appendChild(next);
        prev.addEventListener('click', ()=>{ root.scrollBy({left: -root.clientWidth, behavior:'smooth'}); });
        next.addEventListener('click', ()=>{ root.scrollBy({left: root.clientWidth, behavior:'smooth'}); });
      }

      // dots
      let dotsWrap = null; let dotButtons = [];
      if(dots){
        dotsWrap = document.createElement('div'); dotsWrap.className = 'carousel-dots';
        if(wrap) wrap.appendChild(dotsWrap);
      }

      const items = Array.from(root.querySelectorAll('.item'));
      function updateDots(){
        if(!dotsWrap) return;
        const pageWidth = root.clientWidth;
        const page = Math.round(root.scrollLeft / pageWidth) || 0;
        dotButtons.forEach((b,i)=> b.classList.toggle('active', i===page));
      }

      function buildDots(){
        if(!dotsWrap) return;
        dotsWrap.innerHTML=''; dotButtons = [];
        const pages = opts.forceDotsCount || Math.max(1, Math.ceil(items.length / visible));
        for(let i=0;i<pages;i++){
          const b = document.createElement('button'); b.type='button'; b.className='carousel-dot'; b.setAttribute('data-index', i);
          b.addEventListener('click', ()=>{ root.scrollTo({left: i * root.clientWidth, behavior:'smooth'}); });
          dotsWrap.appendChild(b); dotButtons.push(b);
        }
        updateDots();
      }

      // initial build
      buildDots();

      // autoplay support
      let autoplayTimer = null;
      const startAutoplay = ()=>{
        if(!opts.autoplay) return;
        const interval = opts.interval || 4000;
        if(autoplayTimer) clearInterval(autoplayTimer);
        autoplayTimer = setInterval(()=>{
          const pages = opts.forceDotsCount || Math.max(1, Math.ceil(items.length / visible));
          const page = Math.round(root.scrollLeft / root.clientWidth) || 0;
          const next = (page + 1) % pages;
          root.scrollTo({left: next * root.clientWidth, behavior: 'smooth'});
        }, interval);
      };
      const stopAutoplay = ()=>{ if(autoplayTimer){ clearInterval(autoplayTimer); autoplayTimer = null; }};

      // pause on hover/focus to allow user interaction
      root.addEventListener('mouseenter', stopAutoplay);
      root.addEventListener('mouseleave', startAutoplay);
      root.addEventListener('focusin', stopAutoplay);
      root.addEventListener('focusout', startAutoplay);

      // start if requested
      if(opts.autoplay) startAutoplay();

      // update on scroll/resize
      root.addEventListener('scroll', ()=>{ window.requestAnimationFrame(updateDots); });
      window.addEventListener('resize', ()=>{ buildDots(); if(opts.autoplay) startAutoplay(); });
    };

    fillBanner();
    // Initialize banner as a simple controlled carousel: one slide per view, translateX transitions,
    // side arrows and 3 dots. Keep HTML structure (root id/class) intact; create controls if absent.
    const initBannerSimple = (selector)=>{
      const root = document.querySelector(selector); if(!root) return;
      const items = Array.from(root.querySelectorAll('.item'));
      if(items.length === 0) return;

      // create track if not present
      let track = root.querySelector('.carousel-track');
      if(!track){
        track = document.createElement('div'); track.className = 'carousel-track';
        // move items into track
        items.forEach(it=> track.appendChild(it));
        // append track to root
        root.appendChild(track);
      }

      // ensure item sizing (100% width per slide relative to dotsCount)
      const dotsCount = 3; // fixed 3 dots as requested
      let index = 0;

      // create nav buttons if missing
      if(!root.querySelector('.carousel-nav.prev')){
        const prev = document.createElement('button'); prev.type='button'; prev.className='carousel-nav prev'; prev.setAttribute('aria-label','Anterior');
        prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        const next = document.createElement('button'); next.type='button'; next.className='carousel-nav next'; next.setAttribute('aria-label','Próximo');
        next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        root.appendChild(prev); root.appendChild(next);
        prev.addEventListener('click', ()=>{ index = (index - 1 + dotsCount) % dotsCount; goTo(index); });
        next.addEventListener('click', ()=>{ index = (index + 1) % dotsCount; goTo(index); });
      }

      // create dots container if missing
      let dotsWrap = root.querySelector('.carousel-dots');
      if(!dotsWrap){
        dotsWrap = document.createElement('div'); dotsWrap.className = 'carousel-dots';
        root.appendChild(dotsWrap);
      }

      // build fixed dots (avoid duplication)
      dotsWrap.innerHTML='';
      const dotButtons = [];
      for(let i=0;i<dotsCount;i++){
        const b = document.createElement('button'); b.type='button'; b.className='carousel-dot'; b.setAttribute('data-index', i);
        b.addEventListener('click', ()=>{ index = i; goTo(index); });
        dotsWrap.appendChild(b); dotButtons.push(b);
      }

      // navigation function uses translateX on the track
      function goTo(i){
        index = i;
        // clamp
        if(index < 0) index = 0; if(index >= dotsCount) index = dotsCount-1;
        const pct = index * 100;
        track.style.transform = `translateX(-${pct}%)`;
        dotButtons.forEach((b,idx)=> b.classList.toggle('active', idx===index));
      }

      // set initial layout styles (only visual, via JS to avoid changing HTML file)
      root.style.overflow = 'hidden'; root.style.position = 'relative';
      track.style.display = 'flex'; track.style.width = `${dotsCount * 100}%`; track.style.transition = 'transform .52s ease';
      // ensure each slide is 100%/dotsCount of the track width so translateX works
      Array.from(track.children).forEach((child,ci)=>{ child.style.flex = `0 0 ${100 / dotsCount}%`; child.style.maxWidth = `${100 / dotsCount}%`; });

      // initialize
      goTo(0);
    };

    initBannerSimple('#top-carousel');
    // products carousel keep nav+dots already applied earlier
    makeScrollCarousel('.carousel.products', {withNav:true, dots:false, visible:3});
    // brands carousel: show nav and dots, visible 6 on desktop
    makeScrollCarousel('.brands-list', {withNav:true, dots:true, visible:6});

    function refreshBannerFromSettings(){
      try{
        fillBanner();
        initBannerSimple('#top-carousel');
      }catch(e){ console.warn('Banner refresh failed', e); }
    }

    if(!liveSettingsBound){
      liveSettingsBound = true;
      document.addEventListener('site-settings-updated', refreshBannerFromSettings);
      window.addEventListener('storage', (ev)=>{
        if(ev && ev.key === 'site_settings') refreshBannerFromSettings();
      });
    }
  });
})();
