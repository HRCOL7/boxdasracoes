(function(){
  'use strict';
  // Página da comanda: mostra o pedido para quem tem o link (código secreto na URL).
  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function money(n){ return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ','); }
  function safeImg(u){ return (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : ''; }

  function parseNote(note){
    var out = { delivery: {}, change: '', pay: '' };
    String(note || '').split('\n').forEach(function(l){
      var m = /^([^:]+):\s*(.*)$/.exec(l.trim()); if(!m) return;
      var k = m[1].toLowerCase(), v = m[2];
      if(k === 'endereco'){ var p = v.split(',').map(function(x){ return x.trim(); }); out.delivery.street = p[0] || ''; out.delivery.number = p[1] || ''; out.delivery.neighborhood = p.slice(2).join(', '); }
      else if(k === 'cep') out.delivery.zip = v;
      else if(k === 'referencia') out.delivery.reference = v;
      else if(k === 'agendamento'){ out.delivery.when = v; }
      else if(k === 'pagamento escolhido') out.pay = v;
    });
    if(/troco/i.test(note || '')){ var t = /Troco para R\$\s*([\d.,]+)/i.exec(note); out.change = t ? 'Troco para R$ ' + t[1] : 'Cliente precisa de troco'; }
    return out;
  }
  function row(k, v){ return v ? '<div class="cp-row"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>' : ''; }

  function render(o){
    var n = parseNote(o.note), d = n.delivery;
    var items = Array.isArray(o.items) ? o.items : [];
    var dt = o.created_at ? new Date(o.created_at) : null;
    $('cp-num').textContent = '#' + o.order_number;
    var html = '';
    html += '<p class="cp-when">' + (dt ? esc(dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) : '') + '</p>';
    html += '<section class="cp-box" aria-labelledby="cp-h-cli"><h2 id="cp-h-cli">Cliente</h2><dl>' + row('Nome', o.customer_name) + row('Telefone', o.customer_phone) + '</dl></section>';
    var addr = [d.street, d.number].filter(Boolean).join(', ');
    html += '<section class="cp-box" aria-labelledby="cp-h-ent"><h2 id="cp-h-ent">Entrega</h2><dl>' + row('Endereço', addr) + row('Bairro', d.neighborhood) + row('CEP', d.zip) + row('Referência', d.reference) + row('Data e horário', d.when) + '</dl></section>';
    html += '<section class="cp-box" aria-labelledby="cp-h-pag"><h2 id="cp-h-pag">Pagamento</h2><dl>' + row('Forma', n.pay || o.payment) + row('Troco', n.change) + '</dl></section>';
    html += '<section class="cp-box" aria-labelledby="cp-h-it"><h2 id="cp-h-it">Itens</h2><ul class="cp-items">' + items.map(function(i){
      var im = safeImg(i.image);
      return '<li>' + (im ? '<img src="' + esc(im) + '" alt="" loading="lazy">' : '<span class="cp-noimg" aria-hidden="true"></span>') +
        '<div class="cp-it-main"><strong>' + esc(i.name || 'Produto') + '</strong>' + (i.internal ? '<small>Cód. ' + esc(i.internal) + '</small>' : '') + '</div>' +
        '<div class="cp-it-qty">' + esc(String(i.qty || 1)) + ' x ' + money(i.price) + '</div><div class="cp-it-sum">' + money((Number(i.price) || 0) * (Number(i.qty) || 1)) + '</div></li>';
    }).join('') + '</ul></section>';
    html += '<p class="cp-total">Total: <strong>' + money(o.total) + '</strong></p>';
    html += '<div class="cp-actions"><button type="button" id="cp-print" class="cp-btn cp-primary">Imprimir</button><button type="button" id="cp-img" class="cp-btn">Baixar imagem</button></div>';
    $('cp-body').innerHTML = html; $('cp-body').hidden = false; $('cp-status').hidden = true;
    document.title = 'Comanda #' + o.order_number + ' - Box Das Rações';

    $('cp-print').addEventListener('click', function(){ window.print(); });
    $('cp-img').addEventListener('click', async function(){
      var b = $('cp-img'); b.disabled = true; b.textContent = 'Gerando...';
      try{
        var blob = await window.comanda.build({
          code: o.order_number, items: items, total: Number(o.total || 0), payment: o.payment, paymentLabel: n.pay || o.payment,
          needChange: !!n.change, delivery: { street: d.street, number: d.number, neighborhood: d.neighborhood, zip: d.zip, reference: d.reference, date: '', window: d.when || '' },
          customer: { name: o.customer_name || '', phone: o.customer_phone || '' }, createdAt: dt ? dt.getTime() : Date.now()
        });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'comanda-' + o.order_number + '.png'; document.body.appendChild(a); a.click(); a.remove();
      }catch(e){ $('cp-status').hidden = false; $('cp-status').textContent = 'Não foi possível gerar a imagem. Use "Imprimir".'; }
      b.disabled = false; b.textContent = 'Baixar imagem';
    });
  }

  async function start(){
    var st = $('cp-status');
    var token = new URLSearchParams(location.search).get('c') || '';
    if(!/^[0-9a-f-]{36}$/i.test(token)){ st.textContent = 'Link da comanda inválido.'; st.className = 'cp-msg cp-err'; return; }
    try{
      var client = window.supa && window.supa.init && window.supa.init();
      if(!client) throw new Error('sem conexão');
      var r = await client.rpc('get_order_comanda', { p_token: token });
      if(r.error) throw r.error;
      if(!r.data){ st.textContent = 'Comanda não encontrada. Confira se o link foi copiado inteiro.'; st.className = 'cp-msg cp-err'; return; }
      render(r.data);
      $('main').focus();
    }catch(e){ st.textContent = 'Não foi possível carregar a comanda agora. Tente de novo em instantes.'; st.className = 'cp-msg cp-err'; }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
