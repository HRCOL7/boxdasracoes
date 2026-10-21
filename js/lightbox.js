(function(){
  // Imagem do produto em tela cheia (com zoom, setas e deslizar no celular)
  var box = null, imgs = [], idx = 0, lastFocus = null, zoomed = false;

  function currentSources(){
    var list = [];
    document.querySelectorAll('#thumbs img').forEach(function(t){ var s = t.getAttribute('data-full') || t.currentSrc || t.src; if(s) list.push(s); });
    if(!list.length){ var m = document.getElementById('main-img'); if(m && m.src) list.push(m.src); }
    return list;
  }
  function currentIndex(list){
    var m = document.getElementById('main-img'); if(!m) return 0;
    var i = list.indexOf(m.src); return i < 0 ? 0 : i;
  }
  function render(){
    var im = box.querySelector('.lb-img');
    im.src = imgs[idx]; zoomed = false; box.classList.remove('lb-zoomed'); im.style.transformOrigin = '50% 50%';
    box.querySelector('.lb-count').textContent = imgs.length > 1 ? (idx + 1) + ' / ' + imgs.length : '';
    box.querySelector('.lb-prev').hidden = box.querySelector('.lb-next').hidden = imgs.length < 2;
  }
  function go(d){ if(imgs.length < 2) return; idx = (idx + d + imgs.length) % imgs.length; render(); }
  function close(){
    if(!box) return;
    box.remove(); box = null; document.body.classList.remove('lb-lock');
    Array.prototype.forEach.call(document.body.children, function(n){ n.removeAttribute('inert'); });
    if(lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function open(){
    imgs = currentSources(); if(!imgs.length) return;
    idx = currentIndex(imgs); lastFocus = document.activeElement;
    box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Imagem do produto em tela cheia');
    var alt = (document.querySelector('.product-title') || {}).textContent || 'Produto';
    box.innerHTML = '<button type="button" class="lb-btn lb-close" aria-label="Fechar tela cheia"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>'
      + '<button type="button" class="lb-btn lb-prev" aria-label="Imagem anterior"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '<img class="lb-img" alt="' + alt.replace(/"/g, '&quot;') + '">'
      + '<button type="button" class="lb-btn lb-next" aria-label="Próxima imagem"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '<p class="lb-count" aria-live="polite"></p><p class="lb-hint">Toque na imagem para dar zoom</p>';
    Array.prototype.forEach.call(document.body.children, function(n){ if(n.tagName !== 'SCRIPT') n.setAttribute('inert', ''); });
    document.body.appendChild(box); document.body.classList.add('lb-lock');
    box.removeAttribute('inert');
    render();
    box.querySelector('.lb-close').addEventListener('click', close);
    box.querySelector('.lb-prev').addEventListener('click', function(){ go(-1); });
    box.querySelector('.lb-next').addEventListener('click', function(){ go(1); });
    var im = box.querySelector('.lb-img');
    im.addEventListener('click', function(e){
      zoomed = !zoomed; box.classList.toggle('lb-zoomed', zoomed);
      var r = im.getBoundingClientRect(); im.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
    });
    var sx = 0;
    box.addEventListener('touchstart', function(e){ sx = e.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function(e){ if(zoomed) return; var dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }, { passive: true });
    box.addEventListener('mousedown', function(e){ if(e.target === box) close(); });
    box.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ e.stopPropagation(); close(); }
      else if(e.key === 'ArrowLeft') go(-1); else if(e.key === 'ArrowRight') go(1);
      else if(e.key === 'Tab'){
        var f = Array.prototype.slice.call(box.querySelectorAll('button')).filter(function(b){ return !b.hidden; });
        if(!f.length) return; var first = f[0], last = f[f.length - 1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
    box.querySelector('.lb-close').focus();
  }

  function addButton(){
    var mi = document.querySelector('.main-image');
    if(!mi || mi.querySelector('.zoom-btn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'zoom-btn'; b.setAttribute('aria-label', 'Ver imagem em tela cheia');
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', open);
    mi.appendChild(b);
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    if(t && t.id === 'main-img' && !box){ open(); }
  });
  new MutationObserver(addButton).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', addButton);
})();
