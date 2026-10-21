(function(){
  // Tela de abertura do app instalado (só aparece quando o site é aberto como aplicativo, uma vez por abertura).
  try{
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    var forced = /[?&]splash=1\b/.test(location.search);
    if(!standalone && !forced) return;
    if(sessionStorage.getItem('splash_shown') === '1' && !forced) return;
    sessionStorage.setItem('splash_shown', '1');
  }catch(e){ return; }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var paw = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><ellipse cx="32" cy="42" rx="14" ry="12"/><ellipse cx="12" cy="30" rx="6" ry="8" transform="rotate(-20 12 30)"/><ellipse cx="24" cy="16" rx="6" ry="9" transform="rotate(-8 24 16)"/><ellipse cx="40" cy="16" rx="6" ry="9" transform="rotate(8 40 16)"/><ellipse cx="52" cy="30" rx="6" ry="8" transform="rotate(20 52 30)"/></svg>';
  var steps = '';
  // patinhas "andando": esquerda/direita, de baixo para cima
  for(var i = 0; i < 8; i++){
    var left = i % 2 === 0;
    steps += '<span class="sp-paw" style="--i:' + i + ';--x:' + (left ? -22 : 22) + 'px;--r:' + (left ? -14 : 14) + 'deg">' + paw + '</span>';
  }
  var el = document.createElement('div');
  el.id = 'splash';
  el.className = 'splash' + (reduce ? ' splash-still' : '');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Carregando Box das Rações');
  el.innerHTML = '<div class="sp-stage"><img class="sp-logo" src="/img/logobox.png" alt="" width="132" height="132"><p class="sp-name" aria-hidden="true">Box das Rações</p><div class="sp-trail" aria-hidden="true">' + steps + '</div></div>';
  document.documentElement.appendChild(el);

  var started = Date.now(), MIN = reduce ? 600 : 1900, MAX = 3500, done = false;
  function hide(){
    if(done) return; done = true;
    el.classList.add('splash-out');
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 450);
  }
  function ready(){ var wait = Math.max(0, MIN - (Date.now() - started)); setTimeout(hide, wait); }
  if(document.readyState === 'complete') ready(); else window.addEventListener('load', ready);
  setTimeout(hide, MAX);
})();
