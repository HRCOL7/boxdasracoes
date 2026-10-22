(function(){
  document.addEventListener('DOMContentLoaded',()=>{
    let liveSettingsBound = false;
    const fallbackBanner = (index)=>{
      const palette = ['#F1F8FF','#FFF5E8','#EEF9F0'];
      const bg = palette[index % palette.length];
      const text = encodeURIComponent(`Banner ${index + 1}`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1188" height="419" viewBox="0 0 1188 419"><rect width="1188" height="419" fill="${bg}"/><circle cx="120" cy="90" r="58" fill="#ffffff" opacity=".55"/><circle cx="1020" cy="320" r="82" fill="#ffffff" opacity=".5"/><text x="594" y="220" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#bf5600">${decodeURIComponent(text)}</text></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    };

    const fillBanner = ()=>{
      const el = document.getElementById('top-carousel');
      if(!el) return; el.innerHTML='';
      // attempt to use a global BANNERS array, otherwise default paths
      const defaults = ['img/banner1.jpg','img/banner2.jpg','img/banner3.jpg'];
      const configured = (window.appUtils && typeof window.appUtils.getSiteSettings === 'function')
        ? window.appUtils.getSiteSettings().banners
        : null;
      // os 3 banners padrão (img/banner1-3.jpg) não contam: só banners que o admin cadastrou
      const isDefault = (list)=> Array.isArray(list) && list.length === defaults.length && list.every((v, i)=> String(v || '').trim() === defaults[i]);
      const hasCustom = !!((window.BANNERS && window.BANNERS.length) || (configured && configured.length && !isDefault(configured)));
      el.hidden = !hasCustom;      // sem banners cadastrados no admin, as ofertas da home ocupam o lugar
      if(!hasCustom) return;
      const banners = (window.BANNERS && window.BANNERS.length)
        ? window.BANNERS
        : (configured && configured.length ? configured : defaults);
      const safeBanners = Array.isArray(banners)
        ? banners.map(v=>String(v || '').trim()).filter(Boolean)
        : [];
      const finalBanners = safeBanners.length ? safeBanners : [fallbackBanner(0), fallbackBanner(1), fallbackBanner(2)];

      finalBanners.forEach((entry,idx)=>{
        // formato aceito no admin: "https://endereco-da-imagem | texto que descreve a imagem"
        const parts = String(entry).split('|');
        const src = parts[0].trim();
        const altText = parts.slice(1).join('|').trim();
        const d = document.createElement('div'); d.className='item';
        const img = document.createElement('img');
        img.src = src;
        img.alt = altText || `Destaque ${idx+1} de ${finalBanners.length}`;
        img.loading='lazy';
        img.onerror = ()=>{ img.src = fallbackBanner(idx); };
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
      const wasWrapped = !!(wrap && wrap.classList && wrap.classList.contains('carousel-wrap'));
      if(withNav || dots){
        if(!wasWrapped){
          wrap = document.createElement('div'); wrap.className = 'carousel-wrap';
          root.parentNode.insertBefore(wrap, root);
          wrap.appendChild(root);
        }
      }

      // nav buttons
      let prev, next;
      if(withNav){
        prev = wrap.querySelector('.carousel-nav.prev');
        next = wrap.querySelector('.carousel-nav.next');
        if(!prev){
          prev = document.createElement('button'); prev.type='button'; prev.className='carousel-nav prev'; prev.setAttribute('aria-label','Anterior');
          prev.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          wrap.appendChild(prev);
        }
        if(!next){
          next = document.createElement('button'); next.type='button'; next.className='carousel-nav next'; next.setAttribute('aria-label','Próximo');
          next.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          wrap.appendChild(next);
        }
        if(!prev.dataset.bound){
          prev.dataset.bound = '1';
          prev.addEventListener('click', ()=>{ root.scrollBy({left: -root.clientWidth, behavior:'smooth'}); });
        }
        if(!next.dataset.bound){
          next.dataset.bound = '1';
          next.addEventListener('click', ()=>{ root.scrollBy({left: root.clientWidth, behavior:'smooth'}); });
        }
      }

      // dots
      let dotsWrap = null; let dotButtons = [];
      if(dots){
        dotsWrap = wrap.querySelector('.carousel-dots');
        if(!dotsWrap){
          dotsWrap = document.createElement('div'); dotsWrap.className = 'carousel-dots';
          if(wrap) wrap.appendChild(dotsWrap);
        }
      }

      const getItems = ()=> Array.from(root.querySelectorAll('.item'));
      function updateDots(){
        if(!dotsWrap) return;
        const pageWidth = root.clientWidth;
        const page = Math.round(root.scrollLeft / pageWidth) || 0;
        dotButtons.forEach((b,i)=>{ b.classList.toggle('active', i===page); if(i===page) b.setAttribute('aria-current','true'); else b.removeAttribute('aria-current'); });
      }

      function buildDots(){
        if(!dotsWrap) return;
        dotsWrap.innerHTML=''; dotButtons = [];
        const items = getItems();
        const pages = opts.forceDotsCount || Math.max(1, Math.ceil(items.length / visible));
        for(let i=0;i<pages;i++){
          const b = document.createElement('button'); b.type='button'; b.className='carousel-dot'; b.setAttribute('data-index', i); b.setAttribute('aria-label', 'Ir para o item ' + (i+1));
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
          const items = getItems();
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

      // Rebuild controls when items are rendered asynchronously (products/brands/settings).
      const observer = new MutationObserver(()=>{ buildDots(); });
      observer.observe(root, { childList: true });
    };

    fillBanner();
    // Initialize banner as a centered hero carousel (Petz-like): dominant center slide,
    // side peeks on desktop, arrows and dots based on real slide count.
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

      // use real number of slides to avoid mismatch when admin config changes
      const dotsCount = items.length;
      let index = 0;
      let autoplayTimer = null;

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
        const b = document.createElement('button'); b.type='button'; b.className='carousel-dot'; b.setAttribute('data-index', i); b.setAttribute('aria-label', 'Ir para o item ' + (i+1));
        b.addEventListener('click', ()=>{ index = i; goTo(index); });
        dotsWrap.appendChild(b); dotButtons.push(b);
      }

      // navigation function uses translateX on the track
      function goTo(i){
        index = i;
        // clamp
        if(index < 0) index = 0; if(index >= dotsCount) index = dotsCount-1;
        const cardWidth = Number(root.dataset.bannerCardWidth || 0);
        const gap = Number(root.dataset.bannerGap || 0);
        const offset = index * (cardWidth + gap);
        track.style.transform = `translateX(-${offset}px)`;
        dotButtons.forEach((b,idx)=>{ b.classList.toggle('active', idx===index); if(idx===index) b.setAttribute('aria-current','true'); else b.removeAttribute('aria-current'); });
        Array.from(track.children).forEach((child, idx)=>{
          child.classList.toggle('active', idx === index);
          child.setAttribute('role', 'group'); child.setAttribute('aria-roledescription', 'slide');
          child.setAttribute('aria-label', (idx + 1) + ' de ' + dotsCount);
          // slides fora da tela não são lidos nem focados
          if(idx === index) child.removeAttribute('aria-hidden'); else child.setAttribute('aria-hidden', 'true');
        });
      }

      function applyResponsiveLayout(){
        const isMobile = window.matchMedia('(max-width: 899px)').matches;
        const rootWidth = root.clientWidth || window.innerWidth;
        const gap = isMobile ? 0 : 20;
        const desktopTargetWidth = 1188;
        // Keep only a small safety margin so the banner can approach 1188px on desktop.
        const maxDesktopWidth = Math.max(900, rootWidth - 24);
        const mobileTargetWidth = 360;
        const cardWidth = isMobile ? Math.min(mobileTargetWidth, rootWidth) : Math.min(desktopTargetWidth, maxDesktopWidth);
        const sidePeek = Math.max(0, Math.round((rootWidth - cardWidth) / 2));

        root.style.padding = `0 ${sidePeek}px`;
        root.dataset.bannerCardWidth = String(cardWidth);
        root.dataset.bannerGap = String(gap);

        track.style.gap = `${gap}px`;
        Array.from(track.children).forEach((child)=>{
          child.style.flex = `0 0 ${cardWidth}px`;
          child.style.maxWidth = `${cardWidth}px`;
        });
      }

      let userPaused = false;
      const reduced = ()=> !!(window.appA11y && window.appA11y.prefs.prefersReducedMotion());
      function startAutoplay(){
        stopAutoplay();
        if(dotsCount <= 1 || userPaused || reduced()) return;
        track.setAttribute('aria-live', 'off');
        autoplayTimer = setInterval(()=>{
          index = (index + 1) % dotsCount;
          goTo(index);
        }, 4500);
      }

      function stopAutoplay(){
        track.setAttribute('aria-live', 'polite');   // parado: leitor de tela anuncia o slide novo
        if(autoplayTimer){
          clearInterval(autoplayTimer);
          autoplayTimer = null;
        }
      }

      // Botão de pausa (WCAG 2.2.2): quem não consegue acompanhar o movimento precisa poder parar.
      let pauseBtn = root.querySelector('.carousel-pause');
      if(!pauseBtn && dotsCount > 1 && !reduced()){
        const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
        const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
        pauseBtn = document.createElement('button'); pauseBtn.type = 'button'; pauseBtn.className = 'carousel-pause';
        const paint = ()=>{ pauseBtn.innerHTML = userPaused ? ICON_PLAY : ICON_PAUSE; pauseBtn.setAttribute('aria-label', userPaused ? 'Retomar apresentação automática dos destaques' : 'Pausar apresentação automática dos destaques'); };
        paint();
        pauseBtn.addEventListener('click', ()=>{ userPaused = !userPaused; paint(); if(userPaused) stopAutoplay(); else startAutoplay(); });
        root.appendChild(pauseBtn);
      }

      // set initial layout styles
      root.style.overflow = 'hidden';
      root.style.position = 'relative';
      track.style.display = 'flex';
      track.style.width = 'max-content';
      track.style.transition = 'transform .56s cubic-bezier(.22,.61,.36,1)';

      applyResponsiveLayout();

      // initialize
      goTo(0);

      root.addEventListener('mouseenter', stopAutoplay);
      root.addEventListener('mouseleave', startAutoplay);
      root.addEventListener('focusin', stopAutoplay);
      root.addEventListener('focusout', startAutoplay);

      let touchStartX = 0;
      root.addEventListener('touchstart', (ev)=>{ touchStartX = ev.changedTouches[0].clientX; }, { passive: true });
      root.addEventListener('touchend', (ev)=>{
        const dx = ev.changedTouches[0].clientX - touchStartX;
        if(Math.abs(dx) < 40) return;
        if(dx < 0) index = (index + 1) % dotsCount;
        else index = (index - 1 + dotsCount) % dotsCount;
        goTo(index);
      }, { passive: true });

      window.addEventListener('resize', ()=>{
        applyResponsiveLayout();
        goTo(index);
      });

      startAutoplay();
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
