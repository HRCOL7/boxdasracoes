(function(){
  // header loader: insert a lightweight placeholder synchronously so other scripts can bind,
  // then fetch the full include and replace it when available.
  const tries = ['includes/header.html','../includes/header.html','/includes/header.html'];

  function createPlaceholder(){
    if(document.querySelector('header.top')){
      try{ document.dispatchEvent(new CustomEvent('header:loaded')); }catch(e){}
      return;
    }
    const hdr = document.createElement('header'); hdr.className='top stacked';
    hdr.innerHTML = `
      <button id="hamburger" aria-label="menu" class="icon">☰</button>
      <div class="logo"><img src="/logobox.png" alt="logo" class="logo-img"></div>
      <button id="cart-btn" class="icon"><img src="/cart-l2.png" alt="carrinho" class="cart-icon"><span id="cart-count" class="cart-count">0</span></button>
      <div id="search-area" class="search-area"><div style="position:relative"><input id="search" placeholder="O seu pet merece o melhor !"><button id="search-btn" class="search-btn" aria-label="Pesquisar" title="Pesquisar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button></div><div id="search-results" class="search-results"></div></div>
    `;
    const main = document.querySelector('main');
    if(main) document.body.insertBefore(hdr, main);
    else document.body.insertBefore(hdr, document.body.firstChild);
    // notify that a header (placeholder) is present so other scripts can bind immediately
    try{ document.dispatchEvent(new CustomEvent('header:loaded')); }catch(e){}
  }

  function insertHeader(html){
    try{
      const wrap = document.createElement('div'); wrap.innerHTML = html; const header = wrap.querySelector('header');
      if(!header) return;
      const existing = document.querySelector('header.top');
      if(existing) existing.replaceWith(header);
      else {
        const main = document.querySelector('main');
        if(main) document.body.insertBefore(header, main);
        else document.body.insertBefore(header, document.body.firstChild);
      }

      // also insert/replace any shared nodes that accompany the header (e.g. cart panel)
      try{
        const fetchedAside = wrap.querySelector('aside#cart-panel');
        if(fetchedAside){
          const existingAside = document.getElementById('cart-panel');
          if(existingAside) existingAside.replaceWith(fetchedAside);
          else {
            // insert the aside right after the header when possible
            const headerEl = document.querySelector('header.top') || header;
            if(headerEl && headerEl.parentNode){ headerEl.parentNode.insertBefore(fetchedAside, headerEl.nextSibling); }
            else document.body.appendChild(fetchedAside);
          }
        }
      }catch(e){/* ignore */}

      document.dispatchEvent(new CustomEvent('header:loaded'));
    }catch(e){/* ignore */}
  }

  async function tryLoad(paths){
    for(const p of paths){
      try{
        const res = await fetch(p, {cache: 'no-store'});
        if(!res.ok) continue;
        const text = await res.text();
        insertHeader(text);
        return true;
      }catch(e){/* ignore */}
    }
    return false;
  }

  // create placeholder synchronously so menu/search can bind immediately
  createPlaceholder();

  // start loading as soon as possible
  tryLoad(tries);

  // also try again after DOMContentLoaded in case relative paths resolve differently
  document.addEventListener('DOMContentLoaded', ()=>{
    tryLoad(tries);
  });

})();
