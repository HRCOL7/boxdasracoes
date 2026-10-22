(function(){
  // Galeria em tela cheia (imagens e vídeo): miniaturas ao lado, setas, zoom e deslizar no celular.
  var box = null, list = [], idx = 0, lastFocus = null, zoomed = false;

  function ytId(src){ var m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]+)/i.exec(src || ''); return m ? m[1] : ''; }
  function sources(){
    var pm = window.__productMedia;
    if(pm && pm.list && pm.list.length) return pm.list.map(function(m){ return { type: m.type, src: m.src, thumb: m.type === 'video' ? (m.thumb || '') : m.src }; });
    var out = [];
    document.querySelectorAll('#thumbs img').forEach(function(t){ var s = t.getAttribute('data-full') || t.currentSrc || t.src; if(s) out.push({ type: 'image', src: s, thumb: s }); });
    if(!out.length){ var m = document.getElementById('main-img'); if(m && m.src) out.push({ type: 'image', src: m.src, thumb: m.src }); }
    return out;
  }
  function startIndex(){
    if(window.__productMedia && window.__productMedia.index) return window.__productMedia.index();
    var m = document.getElementById('main-img'); if(!m) return 0;
    for(var i = 0; i < list.length; i++){ if(list[i].src === m.src) return i; }
    return 0;
  }
  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function render(){
    var stage = box.querySelector('.lb-stage'); var it = list[idx];
    zoomed = false; box.classList.remove('lb-zoomed');
    var alt = (window.__productMedia && window.__productMedia.name) || (document.querySelector('.product-title') || {}).textContent || 'Produto';
    if(it.type === 'video'){
      var id = ytId(it.src);
      stage.innerHTML = id
        ? '<iframe class="lb-video" src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '" title="Vídeo do produto" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>'
        : '<video class="lb-video" controls playsinline src="' + esc(it.src) + '"></video>';
      box.querySelector('.lb-hint').hidden = true;
    } else {
      stage.innerHTML = '<img class="lb-img" alt="' + esc(alt) + (list.length > 1 ? ' - imagem ' + (idx + 1) + ' de ' + list.length : '') + '" src="' + esc(it.src) + '">';
      box.querySelector('.lb-hint').hidden = false;
      var im = stage.querySelector('.lb-img');
      im.addEventListener('click', function(e){
        zoomed = !zoomed; box.classList.toggle('lb-zoomed', zoomed);
        var r = im.getBoundingClientRect(); im.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
      });
    }
    box.querySelectorAll('.lb-thumb').forEach(function(t, i){ t.classList.toggle('active', i === idx); t.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
    var cur = box.querySelector('.lb-thumb.active'); if(cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    box.querySelector('.lb-count').textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    box.querySelector('.lb-prev').hidden = box.querySelector('.lb-next').hidden = list.length < 2;
  }
  function go(d){ if(list.length < 2) return; idx = (idx + d + list.length) % list.length; render(); }
  function close(){
    if(!box) return;
    if(window.__productMedia && window.__productMedia.show && list[idx] && list[idx].type === 'image') window.__productMedia.show(idx);
    box.remove(); box = null; document.body.classList.remove('lb-lock');
    Array.prototype.forEach.call(document.body.children, function(n){ n.removeAttribute('inert'); });
    if(lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function open(){
    list = sources(); if(!list.length) return;
    idx = startIndex(); lastFocus = document.activeElement;
    box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Galeria do produto em tela cheia');
    var thumbs = list.length > 1 ? '<div class="lb-thumbs">' + list.map(function(m, i){
      return '<button type="button" class="lb-thumb' + (m.type === 'video' ? ' is-video' : '') + '" data-i="' + i + '" aria-label="' + (m.type === 'video' ? 'Ver vídeo' : 'Ver imagem ' + (i + 1) + ' de ' + list.length) + '">' + (m.thumb ? '<img alt="" src="' + esc(m.thumb) + '">' : '') + (m.type === 'video' ? '<span class="lb-play" aria-hidden="true">▶</span>' : '') + '</button>';
    }).join('') + '</div>' : '';
    box.innerHTML = '<button type="button" class="lb-btn lb-close" aria-label="Fechar tela cheia"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>'
      + thumbs
      + '<button type="button" class="lb-btn lb-prev" aria-label="Anterior"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '<div class="lb-stage"></div>'
      + '<button type="button" class="lb-btn lb-next" aria-label="Próxima"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '<p class="lb-count" aria-live="polite"></p><p class="lb-hint">Clique na imagem para dar zoom</p>';
    Array.prototype.forEach.call(document.body.children, function(n){ if(n.tagName !== 'SCRIPT') n.setAttribute('inert', ''); });
    document.body.appendChild(box); document.body.classList.add('lb-lock');
    box.removeAttribute('inert');
    render();
    box.querySelector('.lb-close').addEventListener('click', close);
    box.querySelector('.lb-prev').addEventListener('click', function(){ go(-1); });
    box.querySelector('.lb-next').addEventListener('click', function(){ go(1); });
    var tb = box.querySelector('.lb-thumbs');
    if(tb) tb.addEventListener('click', function(e){ var b = e.target.closest('.lb-thumb'); if(b){ idx = Number(b.dataset.i); render(); } });
    var sx = 0;
    box.addEventListener('touchstart', function(e){ sx = e.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function(e){ if(zoomed) return; var dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }, { passive: true });
    box.addEventListener('mousedown', function(e){ if(e.target === box || e.target.classList.contains('lb-stage')) close(); });
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

  function addButtons(){
    var mi = document.querySelector('.main-image');
    if(!mi || mi.querySelector('.zoom-btn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'zoom-btn'; b.setAttribute('aria-label', 'Ver em tela cheia');
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', open);
    mi.appendChild(b);
    ['prev', 'next'].forEach(function(dir){
      var n = document.createElement('button'); n.type = 'button'; n.className = 'gal-nav gal-' + dir; n.setAttribute('aria-label', dir === 'prev' ? 'Imagem anterior' : 'Próxima imagem');
      n.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      n.addEventListener('click', function(){ if(window.__productMedia) window.__productMedia.step(dir === 'prev' ? -1 : 1); });
      mi.appendChild(n);
    });
  }
  document.addEventListener('click', function(e){
    var t = e.target;
    if(t && t.id === 'main-img' && !box){ open(); }
  });
  new MutationObserver(addButtons).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', addButtons);
})();
