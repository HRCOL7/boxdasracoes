(function(){
  const SELF_SCRIPT = document.currentScript;
  // Cabeçalho ÚNICO do site: montado aqui, de forma síncrona, igual em todas as páginas
  // (antes havia 3 versões diferentes e o cabeçalho era trocado no meio do carregamento,
  // o que fazia a barra de busca "pular" ao mudar de página). Agora ele nunca é substituído.
  const LOG_PREFIX = '[header]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);

  const HEADER_HTML = `
    <div class="hd-main">
      <div class="hd-left">
        <button id="hamburger" type="button" class="icon" aria-label="Abrir menu de categorias" aria-expanded="false" aria-controls="side-menu"><span aria-hidden="true">☰</span></button>
        <div id="customer-auth-holder"></div>
      </div>
      <div class="logo"><a href="/index.html" aria-label="Box Das Rações, página inicial"><img src="/img/logobox.png" alt="" class="logo-img"></a></div>
      <div id="search-area" class="search-area" role="search" aria-label="Buscar produtos">
        <div class="search-box">
          <label for="search" class="sr-only">Buscar produtos</label>
          <input id="search" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="O seu pet merece o melhor !">
          <button id="search-btn" class="search-btn" type="button" aria-label="Pesquisar" title="Pesquisar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2"/></svg>
          </button>
        </div>
        <div id="search-results" class="search-results"></div>
        <div id="search-status" class="sr-only" role="status" aria-live="polite"></div>
      </div>
      <div class="hd-actions">
        <button id="cart-btn" type="button" class="icon" aria-label="Abrir carrinho" aria-expanded="false" aria-controls="cart-panel"><img src="/img/cart-l2.png" alt="" class="cart-icon"><span id="cart-count" class="cart-count" aria-hidden="true">0</span></button>
      </div>
    </div>`;

  function mountHeader(){
    if(document.querySelector('header.top')) return;
    const hdr = document.createElement('header');
    hdr.className = 'top site-header';
    hdr.innerHTML = HEADER_HTML;
    // entra exatamente onde o <script> está (logo depois do link "Pular para o conteúdo")
    const me = SELF_SCRIPT;
    if(me && me.parentNode) me.parentNode.insertBefore(hdr, me.nextSibling);
    else document.body.insertBefore(hdr, document.body.firstChild);
    try{ document.dispatchEvent(new CustomEvent('header:loaded')); }catch(e){}
  }

  // Só o carrinho lateral vem do arquivo includes/header.html (o cabeçalho em si nunca é trocado)
  async function loadCartPanel(){
    if(document.getElementById('cart-panel')) return;
    for(const p of ['/includes/header.html','includes/header.html','../includes/header.html']){
      try{
        const res = await fetch(p, {cache: 'no-store'});
        if(!res.ok) continue;
        const wrap = document.createElement('div'); wrap.innerHTML = await res.text();
        const aside = wrap.querySelector('aside#cart-panel');
        if(!aside || document.getElementById('cart-panel')) return;
        const headerEl = document.querySelector('header.top');
        if(headerEl && headerEl.parentNode) headerEl.parentNode.insertBefore(aside, headerEl.nextSibling);
        else document.body.appendChild(aside);
        document.dispatchEvent(new CustomEvent('header:loaded'));
        return;
      }catch(e){ logWarn('Falha ao carregar o carrinho lateral: ' + p, e); }
    }
  }

  mountHeader();
  loadCartPanel();
})();
