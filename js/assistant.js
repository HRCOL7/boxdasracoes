/* Assistente de acessibilidade — widget de chat + preferências.
 *
 * Funciona em dois modos:
 *  - COM IA: envia a conversa para a Edge Function "assistant" (a chave da IA fica no servidor).
 *  - SEM IA (ou se o servidor falhar): entende comandos simples por regras locais
 *    ("aumentar a letra", "alto contraste", "buscar ração gato", "abrir carrinho").
 * As ações possíveis são só as das ferramentas abaixo; o texto vindo de produtos/IA é sempre
 * inserido com textContent (nunca como HTML).
 * Depende de: a11y.js (appA11y) e, para busca, supabase-client.js (window.supa).
 */
(function(){
  'use strict';
  if(!window.appA11y || window.__assistantLoaded) return;
  window.__assistantLoaded = true;

  var A = window.appA11y;
  var STATE_KEY = 'assistant_state_v1';
  var MAX_LOOPS = 4;
  var MAX_API_MESSAGES = 20;
  var FONT_ORDER = ['normal', 'lg', 'xl', 'xxl'];

  // ---------------------------------------------------------------- estado
  var state = { open: false, log: [], api: [], speak: false };
  try{
    var saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    if(saved && Array.isArray(saved.log) && Array.isArray(saved.api)) state = Object.assign(state, saved);
  }catch(e){}
  function save(){
    try{
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        open: state.open, speak: state.speak,
        log: state.log.slice(-40), api: state.api.slice(-MAX_API_MESSAGES)
      }));
    }catch(e){}
  }

  // Escolha de ocultar o botão (fica salva neste navegador até a pessoa mostrar de novo).
  var HIDE_KEY = 'assistant_hidden_v1';
  function readHidden(){ try{ return localStorage.getItem(HIDE_KEY) === '1'; }catch(e){ return false; } }
  function writeHidden(v){ try{ if(v) localStorage.setItem(HIDE_KEY, '1'); else localStorage.removeItem(HIDE_KEY); }catch(e){} }

  // ---------------------------------------------------------------- endpoint
  function endpointInfo(){
    var c = window.ASSISTANT_CONFIG || {};
    if(c.enabled === false) return null;
    var base = window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url;
    var url = c.endpoint || (base ? base.replace(/\/$/, '') + '/functions/v1/assistant' : '');
    if(!url) return null;
    return { url: url, key: (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) || '' };
  }

  // ---------------------------------------------------------------- utilidades
  function norm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function money(n){ return 'R$ ' + Number(n).toFixed(2).replace('.', ','); }
  function fromPage(name){
    var parts = location.pathname.split('/');
    var inSub = parts.length > 2 && parts[parts.length - 2] === 'admin';
    return (inSub ? '../' : '') + name;
  }
  function unitFrom(p){
    var prices = [];
    if(Array.isArray(p.variants)) p.variants.forEach(function(v){ var n = Number(v && v.price); if(n > 0) prices.push(n); });
    if(!prices.length && Number(p.price) > 0) prices.push(Number(p.price));
    var min = prices.length ? Math.min.apply(null, prices) : null;
    if(p.is_promo && Number(p.promo_price) > 0) return { price: Number(p.promo_price), promo: true };
    return min === null ? null : { price: min, promo: false, from: Array.isArray(p.variants) && p.variants.length > 1 };
  }

  // ---------------------------------------------------------------- ferramentas
  var pendingLinks = [];

  function toolSearch(query){
    query = String(query || '').slice(0, 80).trim();
    if(query.length < 2) return Promise.resolve('Busca vazia. Peça à pessoa o que ela procura.');
    if(!window.supa || typeof window.supa.getProducts !== 'function') return Promise.resolve('Busca indisponível nesta página.');
    function run(q){ return window.supa.getProducts({ search: q, limit: 5 }).then(function(r){ return (r && r.results) || []; }); }
    return run(query).then(function(list){
      if(list.length) return list;
      var words = norm(query).split(/\s+/).filter(function(w){ return w.length > 3; }).sort(function(a, b){ return b.length - a.length; });
      return words[0] ? run(words[0]) : [];
    }).then(function(list){
      list = list.filter(function(p){ return p && p.id != null && p.name; }).slice(0, 5);
      if(!list.length) return 'Nenhum produto encontrado para "' + query + '".';
      return list.map(function(p){
        var u = unitFrom(p);
        var url = fromPage('product.html') + '?id=' + encodeURIComponent(p.id);
        pendingLinks.push({ text: String(p.name), href: url });
        var price = u ? (u.promo ? 'em promoção por ' : (u.from ? 'a partir de ' : '')) + money(u.price) : 'preço não informado';
        return 'id ' + p.id + ': ' + String(p.name).slice(0, 120) + (p.brand ? ' (' + String(p.brand).slice(0, 40) + ')' : '') +
          ' — ' + price + (p.is_unavailable ? ' — indisponível' : '');
      }).join('\n');
    }).catch(function(){ return 'Não consegui consultar o catálogo agora.'; });
  }

  function toolNavigate(input){
    var d = input && input.destination, target = null;
    if(d === 'home') target = fromPage('index.html');
    else if(d === 'products') target = fromPage('products.html');
    else if(d === 'product'){
      var id = parseInt(input.product_id, 10);
      if(id > 0) target = fromPage('product.html') + '?id=' + id;
    }
    if(!target) return 'Destino inválido.';
    save();
    setTimeout(function(){ location.href = target; }, 400);
    return 'Abrindo a página.';
  }

  function toolPref(input){
    var name = input && input.name, value = input && input.value;
    if(name === 'reset'){ A.prefs.reset(); syncPrefUi(); return 'Preferências restauradas ao padrão.'; }
    var patch = {}; patch[name] = value;
    var before = A.prefs.get()[name];
    var after = A.prefs.set(patch)[name];
    syncPrefUi();
    if(before === after && value !== after) return 'Valor não permitido para essa preferência.';
    return 'Preferência aplicada: ' + name + ' = ' + after + '.';
  }

  function toolReadPage(){
    var root = document.getElementById('main-content') || document.body;
    var clone = root.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('script,style,noscript,[aria-hidden="true"],.sr-only,#assistant-root,.a11y-live'), function(n){ n.remove(); });
    var t = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
    return 'Título: ' + document.title + '\nTexto da página: ' + (t || '(sem texto)');
  }

  function toolOpenCart(){
    var b = document.getElementById('cart-btn');
    var panel = document.getElementById('cart-panel');
    if(!b || !panel) return 'Esta página não tem carrinho.';
    if(panel.classList.contains('hidden')) b.click();
    return 'Carrinho aberto.';
  }

  function runTool(name, input){
    input = input && typeof input === 'object' ? input : {};
    switch(name){
      case 'search_products': return toolSearch(input.query);
      case 'navigate': return Promise.resolve(toolNavigate(input));
      case 'set_preference': return Promise.resolve(toolPref(input));
      case 'read_page': return Promise.resolve(toolReadPage());
      case 'open_cart': return Promise.resolve(toolOpenCart());
      default: return Promise.resolve('Ferramenta desconhecida.');
    }
  }

  // ---------------------------------------------------------------- modo sem IA (regras)
  function offlineReply(text){
    var t = norm(text), has = function(re){ return re.test(t); };
    var cur = A.prefs.get();
    if(has(/\b(restaurar|resetar|padrao|desfazer ajustes)\b/)) return toolPref({ name: 'reset' });
    if(has(/\b(letra|fonte|texto|tamanho)\b/) && has(/\b(legivel|dislexia|simples)\b/)) return toolPref({ name: 'family', value: 'legible' });
    if(has(/\b(aument|maior|grande|ampli)/) && has(/\b(letra|fonte|texto|tamanho|zoom)\b/)){
      var i = FONT_ORDER.indexOf(cur.font); var nx = FONT_ORDER[Math.min(i + 1, FONT_ORDER.length - 1)];
      return i === FONT_ORDER.length - 1 ? 'O texto já está no tamanho máximo.' : toolPref({ name: 'font', value: nx });
    }
    if(has(/\b(diminu|menor|reduz|normal)\b/) && has(/\b(letra|fonte|texto|tamanho)\b/)) return toolPref({ name: 'font', value: 'normal' });
    if(has(/contraste/)) return toolPref({ name: 'contrast', value: has(/\b(normal|desativ|tirar|remov)/) ? 'normal' : 'high' });
    if(has(/\b(espac|entrelinha)/)) return toolPref({ name: 'spacing', value: has(/\b(normal|tirar)/) ? 'normal' : 'wide' });
    if(has(/sublinh/)) return toolPref({ name: 'links', value: 'underline' });
    if(has(/\b(movimento|animac|pausar|parar)/)) return toolPref({ name: 'motion', value: 'reduce' });
    if(has(/\bcarrinho\b/)) return toolOpenCart();
    if(has(/\b(ler|leia|le)\b.*\b(pagina|tela)\b|\bresum/)) return toolReadPage();
    if(has(/\b(inicio|home|pagina inicial)\b/)) return toolNavigate({ destination: 'home' });
    if(has(/\b(produtos|catalogo|loja)\b/) && has(/\b(ir|abrir|ver|mostrar|levar)/)) return toolNavigate({ destination: 'products' });
    var m = t.match(/(?:buscar|busque|procurar|procure|quero|preciso de|tem|achar)\s+(.{2,80})/);
    return toolSearch(m ? m[1] : t);
  }

  // ---------------------------------------------------------------- chamada à IA
  function callApi(){
    var ep = endpointInfo();
    if(!ep) return Promise.reject(new Error('sem_endpoint'));
    var headers = { 'Content-Type': 'application/json' };
    if(ep.key){ headers.apikey = ep.key; headers.Authorization = 'Bearer ' + ep.key; }
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function(){ ctl.abort(); }, 30000) : null;
    return fetch(ep.url, {
      method: 'POST', headers: headers, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ messages: state.api.slice(-MAX_API_MESSAGES), page: { path: location.pathname, title: document.title } })
    }).then(function(r){
      if(timer) clearTimeout(timer);
      if(!r.ok) throw new Error('http_' + r.status);
      return r.json();
    });
  }

  // Remove do começo do histórico mensagens que deixariam um tool_result sem seu tool_use.
  function trimApi(){
    while(state.api.length > MAX_API_MESSAGES) state.api.shift();
    while(state.api.length && (state.api[0].role !== 'user' || (Array.isArray(state.api[0].content) && state.api[0].content[0] && state.api[0].content[0].type === 'tool_result'))) state.api.shift();
  }

  function aiTurn(loops){
    return callApi().then(function(res){
      var blocks = Array.isArray(res.content) ? res.content : [];
      state.api.push({ role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: '...' }] });
      var uses = blocks.filter(function(b){ return b.type === 'tool_use'; });
      var text = blocks.filter(function(b){ return b.type === 'text'; }).map(function(b){ return b.text; }).join('\n').trim();
      if(!uses.length || loops >= MAX_LOOPS) return text || 'Pronto.';
      return Promise.all(uses.map(function(u){
        return runTool(u.name, u.input).then(function(out){ return { type: 'tool_result', tool_use_id: u.id, content: String(out).slice(0, 5000) }; });
      })).then(function(results){
        state.api.push({ role: 'user', content: results });
        return aiTurn(loops + 1).then(function(next){ return [text, next].filter(Boolean).join('\n'); });
      });
    });
  }

  // ---------------------------------------------------------------- interface
  var els = {};
  var busy = false;
  var recognition = null;

  function icon(){
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.innerHTML = '<circle cx="12" cy="4.5" r="2.2" fill="currentColor"/><path d="M5 8.5h14M12 8.5V14m0 0-3.5 6.5M12 14l3.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    return s;
  }
  function mk(tag, props, kids){
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function(k){
      if(k === 'text') e.textContent = props[k];
      else if(k === 'class') e.className = props[k];
      else e.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function(c){ if(c) e.appendChild(c); });
    return e;
  }

  var PREFS = [
    { key: 'font', label: 'Tamanho do texto', opts: [['normal', 'Normal'], ['lg', 'Grande'], ['xl', 'Maior'], ['xxl', 'Máximo']] },
    { key: 'contrast', label: 'Contraste', opts: [['normal', 'Normal'], ['high', 'Alto']] },
    { key: 'spacing', label: 'Espaço entre linhas', opts: [['normal', 'Normal'], ['wide', 'Largo']] },
    { key: 'family', label: 'Tipo de letra', opts: [['normal', 'Normal'], ['legible', 'Fácil de ler']] },
    { key: 'links', label: 'Links', opts: [['normal', 'Normal'], ['underline', 'Sublinhados']] },
    { key: 'motion', label: 'Movimento na tela', opts: [['normal', 'Normal'], ['reduce', 'Reduzido']] }
  ];

  function syncPrefUi(){
    if(!els.panel) return;
    var cur = A.prefs.get();
    Array.prototype.forEach.call(els.panel.querySelectorAll('[data-pref]'), function(b){
      b.setAttribute('aria-pressed', cur[b.getAttribute('data-pref')] === b.getAttribute('data-value') ? 'true' : 'false');
    });
  }

  function addMsg(role, text, links, silent){
    var d = mk('div', { 'class': 'as-msg ' + role });
    d.appendChild(mk('span', { text: text }));
    if(links && links.length){
      var ul = mk('ul', { style: 'margin:8px 0 0;padding-left:18px' });
      links.forEach(function(l){ ul.appendChild(mk('li', {}, [mk('a', { href: l.href, text: l.text })])); });
      d.appendChild(ul);
    }
    els.log.appendChild(d);
    els.log.scrollTop = els.log.scrollHeight;
    if(!silent){ state.log.push({ role: role, text: text, links: links || [] }); save(); }
    return d;
  }

  function speak(text){
    if(!state.speak || !('speechSynthesis' in window)) return;
    try{
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).slice(0, 1200));
      u.lang = 'pt-BR'; window.speechSynthesis.speak(u);
    }catch(e){}
  }

  function setBusy(b){
    busy = b;
    els.send.disabled = b;
    els.panel.setAttribute('aria-busy', b ? 'true' : 'false');
    els.status.textContent = b ? 'Pensando…' : '';
  }

  function finish(text){
    var links = pendingLinks.slice(0, 5); pendingLinks = [];
    var shown = text || (links.length ? 'Encontrei estes produtos:' : 'Pronto.');
    addMsg('bot', shown, links);
    // O container .as-log é role="log": a resposta é anunciada sozinha. A voz é opcional.
    speak(shown + (links.length ? '. ' + links.map(function(l){ return l.text; }).join('. ') : ''));
    setBusy(false);
  }

  function submit(text){
    text = String(text || '').trim().slice(0, 500);
    if(!text || busy) return;
    addMsg('user', text);
    setBusy(true);
    pendingLinks = [];
    var mark = state.api.length;
    state.api.push({ role: 'user', content: text });
    trimApi();
    mark = Math.max(0, state.api.length - 1);
    var ep = endpointInfo();
    var useAi = !!ep && !els.panel.hasAttribute('data-ai-off');
    var p = useAi ? aiTurn(0) : Promise.reject(new Error('offline'));
    p.then(finish, function(err){
      // Sem IA (ou falhou): usa as regras locais. Desfaz a mensagem pendente do histórico da IA.
      state.api.length = Math.min(state.api.length, mark);
      var note = '';
      if(useAi){
        els.panel.setAttribute('data-ai-off', '1');   // não insiste a cada mensagem
        note = 'A IA não está disponível agora; usei o modo simples.\n';
      }
      return Promise.resolve(offlineReply(text)).then(function(o){ finish(note + o); });
    }).catch(function(){ finish('Desculpe, algo deu errado. Tente de novo ou use o menu do site.'); });
  }

  // Voz (reconhecimento) — só aparece se o navegador suportar.
  function setupMic(){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return null;
    var btn = mk('button', { type: 'button', 'class': 'as-btn', 'aria-pressed': 'false', 'aria-label': 'Falar em vez de digitar', text: 'Falar' });
    btn.addEventListener('click', function(){
      if(recognition){ try{ recognition.stop(); }catch(e){} return; }
      recognition = new SR(); recognition.lang = 'pt-BR'; recognition.interimResults = false; recognition.maxAlternatives = 1;
      btn.setAttribute('aria-pressed', 'true'); els.status.textContent = 'Ouvindo… fale agora.';
      recognition.onresult = function(ev){ var t = ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript; if(t){ els.input.value = t; submit(t); els.input.value = ''; } };
      recognition.onerror = function(){ els.status.textContent = 'Não consegui ouvir. Verifique a permissão do microfone.'; };
      recognition.onend = function(){ recognition = null; btn.setAttribute('aria-pressed', 'false'); if(!busy && els.status.textContent === 'Ouvindo… fale agora.') els.status.textContent = ''; };
      try{ recognition.start(); }catch(e){ recognition = null; btn.setAttribute('aria-pressed', 'false'); }
    });
    return btn;
  }

  function build(){
    var root = mk('div', { id: 'assistant-root' });
    els.launcher = mk('button', { type: 'button', 'class': 'as-launcher', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'assistant-panel' }, [icon(), mk('span', { text: 'Ajuda e acessibilidade' })]);
    els.hideX = mk('button', { type: 'button', 'class': 'as-hide-x', 'aria-label': 'Ocultar o botão de ajuda e acessibilidade', title: 'Ocultar este botão' });
    els.hideX.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    els.dock = mk('div', { 'class': 'as-dock' }, [els.launcher, els.hideX]);
    // Link discreto no fim da página para trazer o botão de volta (só aparece quando está oculto).
    els.restoreBtn = mk('button', { type: 'button', 'class': 'as-restore-btn', text: 'Mostrar ajuda e acessibilidade' });
    els.restore = mk('div', { 'class': 'as-restore', hidden: '' }, [els.restoreBtn]);

    els.panel = mk('section', { id: 'assistant-panel', 'class': 'as-panel', role: 'dialog', 'aria-labelledby': 'assistant-title' });
    els.close = mk('button', { type: 'button', 'class': 'as-btn', text: 'Fechar', 'aria-label': 'Fechar assistente' });
    var head = mk('div', { 'class': 'as-head' }, [mk('h2', { id: 'assistant-title', text: 'Assistente da loja' }), els.close]);

    // Preferências
    var grid = mk('div', { 'class': 'as-prefs-grid' });
    PREFS.forEach(function(p){
      var row = mk('div', { 'class': 'as-pref', role: 'group', 'aria-label': p.label }, [mk('span', { 'class': 'as-pref-label', text: p.label })]);
      p.opts.forEach(function(o){
        var b = mk('button', { type: 'button', 'class': 'as-btn', 'data-pref': p.key, 'data-value': o[0], 'aria-pressed': 'false', text: o[1] });
        b.addEventListener('click', function(){ A.prefs.set((function(){ var x = {}; x[p.key] = o[0]; return x; })()); syncPrefUi(); });
        row.appendChild(b);
      });
      grid.appendChild(row);
    });
    var reset = mk('button', { type: 'button', 'class': 'as-btn', text: 'Restaurar padrão' });
    reset.addEventListener('click', function(){ A.prefs.reset(); syncPrefUi(); A.announce('Preferências restauradas.'); });
    var prefs = mk('details', { 'class': 'as-prefs' }, [mk('summary', { text: 'Ajustar a exibição do site' }), grid, mk('div', { style: 'margin-top:8px' }, [reset])]);

    // Voz de saída
    els.hideBtn = mk('button', { type: 'button', 'class': 'as-btn', text: 'Ocultar este botão' });
    els.speakBtn = mk('button', { type: 'button', 'class': 'as-btn', 'aria-pressed': state.speak ? 'true' : 'false', text: 'Ler respostas em voz alta' });
    els.speakBtn.addEventListener('click', function(){
      state.speak = !state.speak; els.speakBtn.setAttribute('aria-pressed', state.speak ? 'true' : 'false');
      if(!state.speak && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      save();
    });

    els.log = mk('div', { 'class': 'as-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversa', tabindex: '0' });
    els.status = mk('p', { 'class': 'as-note', role: 'status' });
    els.input = mk('textarea', { id: 'assistant-input', rows: '2', maxlength: '500', 'aria-label': 'Escreva sua pergunta ou pedido', placeholder: 'Ex.: ração para gato, aumentar a letra, abrir carrinho' });
    els.send = mk('button', { type: 'submit', 'class': 'as-btn', text: 'Enviar' });
    var form = mk('form', { 'class': 'as-form' }, [els.input, els.send]);
    var mic = setupMic();
    var actions = mk('div', { 'class': 'as-suggest' }, [els.speakBtn, els.hideBtn, mic]);
    var note = mk('p', { 'class': 'as-note', text: 'As mensagens podem ser processadas por uma IA. Não digite senhas, cartão ou documentos. O assistente não finaliza compras.' });

    form.addEventListener('submit', function(e){ e.preventDefault(); var v = els.input.value; els.input.value = ''; submit(v); els.input.focus(); });
    els.input.addEventListener('keydown', function(e){ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); } });

    els.panel.appendChild(head);
    els.panel.appendChild(mk('div', { 'class': 'as-body' }, [prefs, els.log, els.status, form, actions, note]));
    root.appendChild(els.dock); root.appendChild(els.panel); root.appendChild(els.restore);
    document.body.appendChild(root);

    state.log.forEach(function(m){ addMsg(m.role, m.text, m.links, true); });
    if(!state.log.length) addMsg('bot', 'Olá! Posso buscar produtos, abrir o carrinho, ler a página e ajustar letra, contraste e espaçamento. O que você precisa?', null, true);
    syncPrefUi();

    var dlg = null;
    function open(){
      if(state.open && dlg) return;
      els.panel.classList.add('open'); els.dock.hidden = true; els.launcher.setAttribute('aria-expanded', 'true');
      dlg = A.openDialog(els.panel, { modal: false, opener: els.launcher, labelledby: 'assistant-title', initialFocus: els.input, onClose: close });
      state.open = true; save();
    }
    function close(){
      els.panel.classList.remove('open'); els.dock.hidden = false; els.launcher.setAttribute('aria-expanded', 'false');
      if(dlg){ dlg.close(); dlg = null; }
      if('speechSynthesis' in window) window.speechSynthesis.cancel();
      state.open = false; save();
    }
    function hideWidget(){
      if(state.open) close();
      writeHidden(true);
      els.dock.hidden = true; els.restore.hidden = false;
      A.announce('Botão de ajuda ocultado. Para mostrar de novo, use o botão "Mostrar ajuda e acessibilidade" no fim da página.');
      els.restoreBtn.focus();
    }
    function showWidget(){
      writeHidden(false);
      els.restore.hidden = true; els.dock.hidden = false;
      A.announce('Botão de ajuda visível de novo.');
      els.launcher.focus();
    }
    els.launcher.addEventListener('click', open);
    els.close.addEventListener('click', close);
    els.hideX.addEventListener('click', hideWidget);
    els.hideBtn.addEventListener('click', hideWidget);
    els.restoreBtn.addEventListener('click', showWidget);
    if(readHidden()){ els.dock.hidden = true; els.restore.hidden = false; state.open = false; }
    else if(state.open){ state.open = false; open(); }
    window.appAssistant = { open: open, close: close, ask: submit, hide: hideWidget, show: showWidget };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
