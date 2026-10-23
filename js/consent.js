(function(){
  // Cookies e privacidade (LGPD): faixa na primeira visita + centro de preferências.
  // Só os necessários rodam sem permissão. A análise de visitas (analytics.js) só roda se o cliente aceitar.
  var KEY = 'consent_v1', VERSION = 1;
  var CATS = [
    { id:'necessary', name:'Cookies necessários', always:true,
      text:'Essenciais para o site funcionar: manter o carrinho, o login, o tema claro/escuro que você escolheu e guardar esta preferência de privacidade. Não podem ser desativados e não identificam você diretamente.',
      items:[
        ['sb-…-auth-token','Mantém você conectado (login do cliente ou da loja).','até sair'],
        ['cart','Guarda os itens do seu carrinho neste aparelho.','até limpar'],
        ['theme_v1','Lembra se você prefere o modo claro ou escuro.','1 ano'],
        ['consent_v1','Guarda as suas escolhas de cookies.','1 ano'],
        ['products','Cópia da lista de produtos para a busca e as páginas abrirem mais rápido.','até atualizar'],
        ['weight_pref_v1 / last_order_items_v1 / favorite_product_ids','Lembram o peso (kg) que você escolheu, o seu último pedido e os seus favoritos.','até limpar'],
        ['terms_accepted_v1','Lembra que você já leu os termos neste aparelho.','até limpar']
      ] },
    { id:'functional', name:'Cookies de funcionalidade',
      text:'Permitem recursos extras e mais personalizados, como lembrar dados de preenchimento. No momento o site não usa nenhum cookie opcional desta categoria.', items:[] },
    { id:'analytics', name:'Cookies analíticos',
      text:'Ajudam a entender como os visitantes usam o site (páginas e produtos mais vistos). Os dados ficam no nosso banco, de forma agregada.',
      items:[
        ['site_session_id','Identificador anônimo da visita, para contar visitas.','até limpar'],
        ['site_analytics_sent','Evita contar a mesma página duas vezes.','até limpar']
      ] },
    { id:'performance', name:'Cookies de desempenho',
      text:'Medem a velocidade e os acessos para melhorar o site. No momento não usamos nenhum.', items:[] },
    { id:'advertising', name:'Cookies de publicidade',
      text:'Poderiam ser usados por parceiros para exibir anúncios mais relevantes em outros sites. O Box das Rações não usa cookies de publicidade.', items:[] }
  ];

  var state = null, banner = null, modal = null, lastFocus = null;

  function read(){
    try{ var r = JSON.parse(localStorage.getItem(KEY) || 'null'); if(r && r.v === VERSION) return r; }catch(e){}
    return null;
  }
  function write(s){
    s.v = VERSION; s.ts = Date.now();
    try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){}
    try{ document.cookie = KEY + '=' + encodeURIComponent(JSON.stringify({a:+!!s.analytics,f:+!!s.functional,p:+!!s.performance,d:+!!s.advertising})) + ';max-age=31536000;path=/;SameSite=Lax'; }catch(e){}
    state = s;
    try{ document.dispatchEvent(new CustomEvent('consent:changed', { detail: s })); }catch(e){}
  }
  function allowed(cat){
    if(cat === 'necessary') return true;
    return !!(state && state[cat]);
  }
  function clearAnalytics(){
    try{ localStorage.removeItem('site_session_id'); localStorage.removeItem('site_analytics_sent'); }catch(e){}
  }
  function save(sel){
    var s = { necessary:true, functional:!!sel.functional, analytics:!!sel.analytics, performance:!!sel.performance, advertising:!!sel.advertising };
    if(!s.analytics) clearAnalytics();
    write(s);
    closeAll();
  }
  function el(tag, attrs, kids){
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){ if(k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function(c){ n.appendChild(c); });
    return n;
  }

  function setDockOffset(){
    var h = banner && !banner.hidden ? banner.offsetHeight : 0;
    document.documentElement.style.setProperty('--ck-h', h ? (h + 12) + 'px' : '0px');
    document.body.classList.toggle('ck-open', !!h);
  }

  function buildBanner(){
    banner = el('section', { 'class':'ck-banner', role:'region', 'aria-label':'Aviso de cookies' });
    var p = el('p', { 'class':'ck-text' });
    p.appendChild(document.createTextNode('Usamos cookies necessários para o site funcionar e, com a sua permissão, cookies analíticos para melhorar a sua experiência. Você escolhe. '));
    var more = el('button', { type:'button', 'class':'ck-linkbtn', text:'Preferências' });
    more.addEventListener('click', function(){ openPrefs(); });
    p.appendChild(more);
    var accept = el('button', { type:'button', 'class':'ck-btn ck-primary', text:'Aceitar todos' });
    var reject = el('button', { type:'button', 'class':'ck-btn ck-secondary', text:'Só necessários' });
    accept.addEventListener('click', function(){ save({ functional:true, analytics:true, performance:true, advertising:true }); });
    reject.addEventListener('click', function(){ save({}); });
    banner.appendChild(p);
    banner.appendChild(el('div', { 'class':'ck-actions' }, [reject, accept]));
    document.body.appendChild(banner);
    setDockOffset();
    window.addEventListener('resize', setDockOffset);
  }

  function buildModal(){
    var back = el('div', { 'class':'ck-back' });
    modal = el('div', { 'class':'ck-modal', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'ck-title', tabindex:'-1' });
    modal.appendChild(el('h2', { id:'ck-title', text:'Centro de preferências de privacidade' }));
    modal.appendChild(el('p', { 'class':'ck-intro', text:'Cookies são pequenos arquivos (ou dados guardados no seu navegador) com informações sobre a sua navegação e as suas preferências. Alguns são essenciais para o funcionamento do site. Outros nos ajudam a melhorar a sua experiência. Você pode aceitar, rejeitar ou configurar os não essenciais.' }));
    var body = el('div', { 'class':'ck-body' });
    var cur = state || {};
    CATS.forEach(function(c){
      var sw;
      var head = el('div', { 'class':'ck-cat-head' });
      var title = el('h3', { id:'ck-h-' + c.id, text:c.name });
      head.appendChild(title);
      if(c.always){
        head.appendChild(el('span', { 'class':'ck-always', text:'Sempre ativo' }));
      } else {
        var lab = el('label', { 'class':'ck-switch' });
        sw = el('input', { type:'checkbox', role:'switch', id:'ck-sw-' + c.id, 'aria-labelledby':'ck-h-' + c.id });
        if(cur[c.id]) sw.checked = true;
        lab.appendChild(sw); lab.appendChild(el('span', { 'class':'ck-track', 'aria-hidden':'true' }));
        head.appendChild(lab);
      }
      var det = el('details', { 'class':'ck-cat' });
      var sum = el('summary', { text:'Ver detalhes' });
      det.appendChild(sum);
      det.appendChild(el('p', { text:c.text }));
      if(c.items.length){
        var ul = el('ul', { 'class':'ck-items' });
        c.items.forEach(function(it){
          var li = el('li');
          li.appendChild(el('strong', { text:it[0] }));
          li.appendChild(el('span', { text:it[1] }));
          li.appendChild(el('small', { text:'Duração: ' + it[2] }));
          ul.appendChild(li);
        });
        det.appendChild(ul);
      } else {
        det.appendChild(el('p', { 'class':'ck-none', text:'Nenhum cookie desta categoria em uso.' }));
      }
      var sec = el('section', { 'class':'ck-section', 'aria-labelledby':'ck-h-' + c.id }, [head, det]);
      body.appendChild(sec);
    });
    modal.appendChild(body);
    var rej = el('button', { type:'button', 'class':'ck-btn ck-secondary', text:'Rejeitar não essenciais' });
    var sv = el('button', { type:'button', 'class':'ck-btn ck-secondary', text:'Salvar minhas escolhas' });
    var all = el('button', { type:'button', 'class':'ck-btn ck-primary', text:'Aceitar todos' });
    rej.addEventListener('click', function(){ save({}); });
    all.addEventListener('click', function(){ save({ functional:true, analytics:true, performance:true, advertising:true }); });
    sv.addEventListener('click', function(){
      var sel = {};
      CATS.forEach(function(c){ var i = document.getElementById('ck-sw-' + c.id); if(i) sel[c.id] = i.checked; });
      save(sel);
    });
    modal.appendChild(el('div', { 'class':'ck-foot' }, [rej, sv, all]));
    back.appendChild(modal);
    back.addEventListener('mousedown', function(e){ if(e.target === back && state) closeAll(); });
    back.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ e.stopPropagation(); if(state) closeAll(); return; }
      if(e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(modal.querySelectorAll('button,input,summary,[href]')).filter(function(n){ return n.offsetParent !== null; });
      if(!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(back);
    return back;
  }

  var backdrop = null;
  function openPrefs(){
    lastFocus = document.activeElement;
    if(backdrop) backdrop.remove();
    backdrop = buildModal();
    document.body.classList.add('ck-modal-open');
    // fundo fica inerte para leitores de tela
    Array.prototype.forEach.call(document.body.children, function(n){ if(n !== backdrop && n.tagName !== 'SCRIPT') n.setAttribute('inert', ''); });
    modal.focus();
  }
  function closeAll(){
    if(backdrop){ backdrop.remove(); backdrop = null; }
    Array.prototype.forEach.call(document.body.children, function(n){ n.removeAttribute('inert'); });
    document.body.classList.remove('ck-modal-open');
    if(banner){ banner.hidden = true; }
    setDockOffset();
    if(lastFocus && document.contains(lastFocus) && lastFocus.offsetParent !== null){ try{ lastFocus.focus(); }catch(e){} }
  }

  function addFooterLink(){
    if(document.querySelector('.ck-open-prefs')) return;
    var b = el('button', { type:'button', 'class':'ck-open-prefs', text:'Preferências de cookies' });
    b.addEventListener('click', openPrefs);
    var host = document.querySelector('.site-footer');
    if(host){
      var wrap = el('div', { 'class':'ck-footer-link' }, [b]);
      host.appendChild(wrap);
    } else {
      var w2 = el('div', { 'class':'ck-page-link' }, [b]);
      var main = document.querySelector('main');
      if(main && main.parentNode) main.parentNode.insertBefore(w2, main.nextSibling); else document.body.appendChild(w2);
    }
  }

  window.cookieConsent = { allowed: allowed, open: openPrefs, get: function(){ return state; } };
  state = read();

  function init(){
    // o link "Preferências de cookies" fica só no rodapé (js/footer.js)
    if(!state) buildBanner();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
