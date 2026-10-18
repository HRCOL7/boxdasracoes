/* Admin — Pedidos do site (tabela customer_orders).
   Quem pode ver/alterar é decidido pelo banco (RLS + is_admin()). Aqui só montamos a tela.
   Se a migração 20261017000000_admin_orders.sql ainda não foi aplicada, a lista vem vazia
   e o painel avisa. */
(function(){
  'use strict';
  var STATUS = {
    pending:    { label: 'Novo',       cls: 'new',  next: 'preparing',  nextLabel: 'Marcar como em preparo' },
    preparing:  { label: 'Em preparo', cls: 'prep', next: 'delivering', nextLabel: 'Marcar como a caminho' },
    delivering: { label: 'A caminho',  cls: 'way',  next: 'delivered',  nextLabel: 'Marcar como entregue' },
    delivered:  { label: 'Entregue',   cls: 'done', next: null },
    cancelled:  { label: 'Cancelado',  cls: 'off',  next: null },
    processed:  { label: 'Processado', cls: 'done', next: null },
    error:      { label: 'Erro',       cls: 'off',  next: null }
  };
  var orders = [];
  var selectedId = null;

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function money(v){ return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function dayKey(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function statusInfo(s){ return STATUS[s] || { label: String(s || '—'), cls: 'off', next: null }; }
  function $(id){ return document.getElementById(id); }

  function setStatus(msg, type){
    var el = $('orders-status'); if(!el) return;
    if(!msg){ el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = 'block'; el.className = 'reports-status ' + (type || 'info'); el.textContent = msg;
  }

  async function isAdminUser(){
    try{
      var user = (window.supa && window.supa.getUser) ? await window.supa.getUser() : null;
      if(!user) return false;
      return (window.supa.isAdmin ? await window.supa.isAdmin() : false) === true;   // falha fechada
    }catch(e){ return false; }
  }
  async function ensureAuth(){
    var ok = await isAdminUser();
    var modal = $('admin-login');
    if(modal) modal.classList.toggle('visible', !ok);
    return ok;
  }

  function client(){ return (window.supa && window.supa.init) ? window.supa.init() : null; }

  async function load(){
    var c = client();
    if(!c){ setStatus('Supabase indisponível.', 'error'); return; }
    setStatus('Carregando pedidos…', 'info');
    var res = await c.from('customer_orders').select('*').order('created_at', { ascending: false }).limit(200);
    if(res && res.error){ setStatus('Não foi possível carregar os pedidos: ' + (res.error.message || res.error), 'error'); orders = []; }
    else{
      orders = Array.isArray(res && res.data) ? res.data : [];
      setStatus(orders.length ? '' : 'Nenhum pedido ainda. Se você já recebeu pedidos, aplique a migração 20261017000000_admin_orders.sql no Supabase.', 'info');
    }
    render();
  }

  function parseNote(note){
    var out = {};
    String(note || '').split('\n').forEach(function(line){
      var i = line.indexOf(':'); if(i < 0) return;
      out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    });
    return out;
  }
  function itemsCount(o){ return (Array.isArray(o.items) ? o.items : []).reduce(function(s, i){ return s + (Number(i.qty) || 1); }, 0); }
  function filtered(){
    var f = $('orders-filter') ? $('orders-filter').value : '';
    return orders.filter(function(o){ return !f || o.status === f; });
  }

  function renderKpis(){
    var today = dayKey(new Date());
    var todays = orders.filter(function(o){ return dayKey(new Date(o.created_at)) === today && o.status !== 'cancelled'; });
    var revenue = todays.reduce(function(s, o){ return s + Number(o.total || 0); }, 0);
    $('kpi-count').textContent = String(todays.length);
    $('kpi-revenue').textContent = money(revenue);
    $('kpi-avg').textContent = money(todays.length ? revenue / todays.length : 0);
    var news = orders.filter(function(o){ return o.status === 'pending'; }).length;
    $('kpi-new').textContent = String(news);
    $('kpi-count-sub').textContent = news === 1 ? '1 novo aguardando' : news + ' novos aguardando';
    $('orders-today').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function renderTable(){
    var body = document.querySelector('#orders-table tbody'); if(!body) return;
    var list = filtered();
    if(!list.length){ body.innerHTML = '<tr><td colspan="6" class="ord-empty">Nenhum pedido para este filtro.</td></tr>'; return; }
    body.innerHTML = list.map(function(o){
      var st = statusInfo(o.status);
      var d = new Date(o.created_at);
      var sel = String(o.id) === String(selectedId);
      return '<tr' + (sel ? ' class="selected"' : '') + '>' +
        '<th scope="row"><button type="button" class="ord-pick" data-id="' + esc(o.id) + '"' + (sel ? ' aria-current="true"' : '') + ' aria-label="Abrir pedido ' + esc(o.order_number) + '">#' + esc(o.order_number) + '</button></th>' +
        '<td>' + esc(o.customer_name || o.customer_email || '—') + '</td>' +
        '<td>' + itemsCount(o) + '</td><td class="ord-money">' + money(o.total) + '</td>' +
        '<td>' + esc(d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) + '</td>' +
        '<td><span class="ord-badge ' + st.cls + '">' + esc(st.label) + '</span></td></tr>';
    }).join('');
  }

  function renderChart(){
    var root = $('orders-chart'); if(!root) return;
    var days = [];
    for(var k = 6; k >= 0; k--){ var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - k); days.push(d); }
    var totals = days.map(function(d){
      var key = dayKey(d);
      return orders.filter(function(o){ return o.status !== 'cancelled' && dayKey(new Date(o.created_at)) === key; })
        .reduce(function(s, o){ return s + Number(o.total || 0); }, 0);
    });
    var max = Math.max.apply(null, totals.concat([1]));
    var wk = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    root.innerHTML = days.map(function(d, i){
      var h = Math.max(4, Math.round(totals[i] / max * 150));
      var today = i === days.length - 1;
      return '<div class="ord-bar-col"><span class="ord-bar-val' + (today ? ' today' : '') + '">' + (totals[i] ? Math.round(totals[i]).toLocaleString('pt-BR') : '—') + '</span>' +
        '<div class="ord-bar' + (today ? ' today' : '') + '" style="height:' + h + 'px"></div>' +
        '<span class="ord-bar-day' + (today ? ' today' : '') + '">' + (today ? 'Hoje' : wk[d.getDay()]) + '</span></div>';
    }).join('');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', 'Faturamento por dia: ' + days.map(function(d, i){ return (i === days.length - 1 ? 'hoje' : wk[d.getDay()]) + ' ' + money(totals[i]); }).join(', '));
  }

  function waLink(o){
    var digits = String(o.customer_phone || '').replace(/\D/g, '');
    if(!digits) return '';
    if(digits.length <= 11) digits = '55' + digits;
    var text = 'Olá! Aqui é da Box das Rações sobre o seu pedido #' + o.order_number + '.';
    return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text);
  }

  function renderDetail(){
    var box = $('order-detail'); if(!box) return;
    var o = orders.find(function(x){ return String(x.id) === String(selectedId); });
    if(!o){ box.innerHTML = '<p class="orders-sub">Escolha um pedido na lista para ver os detalhes.</p>'; return; }
    var st = statusInfo(o.status);
    var note = parseNote(o.note);
    var items = (Array.isArray(o.items) ? o.items : []).map(function(i){
      var qty = Number(i.qty) || 1, price = Number(i.price) || 0;
      return '<li><span>' + esc(i.name || 'Item') + '<small>' + qty + ' × ' + money(price) + '</small></span><strong>' + money(qty * price) + '</strong></li>';
    }).join('');
    var confirmed = /^sim/i.test(note['endereco confirmado pelo cliente'] || '');
    var addr = note['endereco'] || '';
    var wa = waLink(o);
    var actions = '';
    if(st.next) actions += '<button type="button" class="btn btn-orange" id="ord-advance" data-next="' + st.next + '">' + esc(st.nextLabel) + '</button>';
    if(o.status !== 'cancelled' && o.status !== 'delivered') actions += '<button type="button" class="btn" id="ord-cancel">Cancelar pedido</button>';
    if(wa) actions += '<a class="btn" target="_blank" rel="noopener noreferrer" href="' + esc(wa) + '">Falar com o cliente no WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>';
    box.innerHTML =
      '<div class="ord-detail-head"><h3 class="ord-h3">Pedido #' + esc(o.order_number) + '</h3><span class="ord-badge ' + st.cls + '">' + esc(st.label) + '</span></div>' +
      '<p class="orders-sub">' + esc(o.customer_name || '—') + (o.customer_phone ? ' · ' + esc(o.customer_phone) : '') + (o.customer_email ? '<br>' + esc(o.customer_email) : '') + '</p>' +
      '<ul class="ord-items">' + (items || '<li><span>Sem itens</span></li>') + '</ul>' +
      '<p class="ord-total"><span>Total</span><span>' + money(o.total) + '</span></p>' +
      (note['pagamento escolhido'] ? '<p class="orders-sub">Pagamento: ' + esc(note['pagamento escolhido']) + '</p>' : '') +
      '<div class="ord-delivery"><p class="ord-delivery-title">Entrega · ' + esc(note['agendamento'] || 'sem agendamento') + '</p>' +
      '<p class="orders-sub">' + esc(addr || 'Endereço não informado') + (note['cep'] ? ' · CEP ' + esc(note['cep']) : '') + (note['referencia'] ? '<br>Ref.: ' + esc(note['referencia']) : '') + '</p>' +
      (confirmed ? '<span class="ord-confirmed">✓ Endereço confirmado pelo cliente</span>' : '') + '</div>' +
      '<div class="ord-actions">' + actions + '</div>';
    var adv = $('ord-advance'); if(adv) adv.addEventListener('click', function(){ changeStatus(o, adv.dataset.next); });
    var can = $('ord-cancel'); if(can) can.addEventListener('click', function(){ if(confirm('Cancelar o pedido #' + o.order_number + '?')) changeStatus(o, 'cancelled'); });
  }

  async function changeStatus(o, next){
    var c = client(); if(!c) return;
    setStatus('Salvando…', 'info');
    var res = await c.from('customer_orders').update({ status: next }).eq('id', o.id).select().single();
    if(res && res.error){
      setStatus('Não foi possível alterar o status: ' + (res.error.message || res.error) + '. Confira se a migração 20261017000000_admin_orders.sql foi aplicada.', 'error');
      return;
    }
    o.status = (res && res.data && res.data.status) || next;
    setStatus('Pedido #' + o.order_number + ': ' + statusInfo(o.status).label + '.', 'success');
    if(window.appA11y && window.appA11y.announce) window.appA11y.announce('Pedido ' + o.order_number + ' agora está ' + statusInfo(o.status).label);
    render();
  }

  function render(){ renderKpis(); renderTable(); renderChart(); renderDetail(); }

  document.addEventListener('DOMContentLoaded', function(){
    document.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('.ord-pick'); if(!b) return;
      selectedId = b.dataset.id; renderTable(); renderDetail();
      var d = $('order-detail'); if(d && window.matchMedia('(max-width: 899px)').matches) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if($('orders-filter')) $('orders-filter').addEventListener('change', renderTable);
    if($('orders-refresh')) $('orders-refresh').addEventListener('click', load);
    if($('admin-close')) $('admin-close').addEventListener('click', function(){ location.href = '../index.html'; });
    if($('admin-enter')) $('admin-enter').addEventListener('click', async function(){
      var email = String(($('admin-email') || {}).value || '').trim(), pass = String(($('admin-pass') || {}).value || '');
      if(!email || !pass){ alert('Informe email e senha.'); return; }
      try{
        await window.supa.signIn(email, pass);
        if(await ensureAuth()) await load(); else alert('Acesso negado. Entre com um email autorizado.');
      }catch(err){ alert('Falha no login: ' + (err && err.message ? err.message : String(err))); }
    });
    if($('orders-logout')) $('orders-logout').addEventListener('click', async function(){
      try{ if(window.supa && window.supa.signOut) await window.supa.signOut(); }catch(e){}
      location.reload();
    });
    ensureAuth().then(function(ok){ if(ok) load(); else render(); });
  });
})();
