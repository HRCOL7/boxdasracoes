(function(){
  // Comanda do pedido: imagem PNG organizada (cliente, entrega, pagamento e itens com foto).
  // window.comanda.build(order) -> Promise<Blob>.  window.comanda.showDialog(order, blob) mostra a janela de envio.
  var W = 840, PAD = 36, FONT = "'Nunito', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
  var C = { black:'#1F1B16', orange:'#FF7A00', brown:'#5C2E0A', cream:'#FBF8F3', line:'#E4DBCF', ink:'#1F1B16', muted:'#6B645B', accent:'#A84800' };

  function money(n){ return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ','); }
  function loadImg(src, ms){
    return new Promise(function(resolve){
      if(!src){ resolve(null); return; }
      var im = new Image(); var done = false;
      var t = setTimeout(function(){ if(!done){ done = true; resolve(null); } }, ms || 3500);
      im.crossOrigin = 'anonymous';
      im.onload = function(){ if(!done){ done = true; clearTimeout(t); resolve(im); } };
      im.onerror = function(){ if(!done){ done = true; clearTimeout(t); resolve(null); } };
      im.src = src;
    });
  }
  function wrap(ctx, text, maxW, maxLines){
    var words = String(text || '').split(/\s+/), lines = [], cur = '';
    words.forEach(function(w){
      var test = cur ? cur + ' ' + w : w;
      if(ctx.measureText(test).width > maxW && cur){ lines.push(cur); cur = w; } else cur = test;
    });
    if(cur) lines.push(cur);
    if(maxLines && lines.length > maxLines){
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while(last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }
  function rr(ctx, x, y, w, h, r){
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function productImage(item){
    if(item.image) return item.image;
    try{
      var list = JSON.parse(localStorage.getItem('products') || '[]');
      for(var i = 0; i < list.length; i++){
        if(String(list[i].id) === String(item.productId)){
          return (Array.isArray(list[i].images) && list[i].images[0]) || list[i].image || '';
        }
      }
    }catch(e){}
    return '';
  }

  // order: { code, items:[{name,qty,price,internal,image,productId}], total, payment, paymentLabel, needChange, cashPaid,
  //          customer:{name,phone,email,document}, delivery:{street,number,neighborhood,zip,reference,date,window}, createdAt }
  async function build(order){
    var items = Array.isArray(order.items) ? order.items : [];
    var cust = order.customer || {}, dl = order.delivery || {};
    var imgs = await Promise.all(items.map(function(it){ return loadImg(productImage(it)); }));
    var logo = await loadImg('/img/logobox.png', 2500);

    var scratch = document.createElement('canvas').getContext('2d');
    scratch.font = '700 22px ' + FONT;
    var rowsInfo = items.map(function(it){ scratch.font = '800 22px ' + FONT; return wrap(scratch, it.name || 'Produto', W - PAD * 2 - 96 - 200, 2); });

    var custLines = [];
    if(cust.name) custLines.push(['Cliente', cust.name]);
    if(cust.phone) custLines.push(['Telefone', cust.phone]);
    if(cust.email) custLines.push(['E-mail', cust.email]);
    if(cust.document) custLines.push(['Documento', cust.document]);
    var addr = [dl.street, dl.number].filter(Boolean).join(', ');
    var addr2 = [dl.neighborhood, dl.zip ? 'CEP ' + dl.zip : ''].filter(Boolean).join(' · ');
    var delLines = [];
    if(addr) delLines.push(['Endereço', addr]);
    if(addr2) delLines.push(['Bairro', addr2]);
    if(dl.reference) delLines.push(['Referência', dl.reference]);
    if(dl.date || dl.window){
      var d = dl.date ? dl.date.split('-').reverse().join('/') : '';
      delLines.push(['Entrega', [d, dl.window].filter(Boolean).join(' · ')]);
    }
    var payLines = [['Pagamento', order.paymentLabel || order.payment || '-']];
    if(order.needChange === 'yes' || order.needChange === true){
      payLines.push(['Troco', order.cashPaid ? 'Troco para ' + money(order.cashPaid) : 'Cliente precisa de troco']);
    }

    var boxH = function(n){ return 56 + n * 36 + 12; };
    var itemsH = rowsInfo.reduce(function(s, l){ return s + Math.max(96, 36 + l.length * 28 + 38) + 12; }, 0);
    var H = 150 + boxH(custLines.length || 1) + 18 + boxH(delLines.length || 1) + 18 + boxH(payLines.length) + 18 + 64 + itemsH + 150;

    var cv = document.createElement('canvas'); var scale = 2;
    cv.width = W * scale; cv.height = H * scale;
    var ctx = cv.getContext('2d'); ctx.scale(scale, scale);
    ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);

    // topo
    ctx.fillStyle = C.black; ctx.fillRect(0, 0, W, 130);
    ctx.strokeStyle = 'rgba(255,122,0,.35)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(W - 40, -10, 90, 0, Math.PI * 2); ctx.stroke();
    if(logo){ ctx.save(); ctx.beginPath(); ctx.arc(PAD + 40, 65, 40, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, PAD, 25, 80, 80); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.font = '900 32px ' + FONT; ctx.fillText('Box das Rações', PAD + 100, 62);
    ctx.fillStyle = C.orange; ctx.font = '800 20px ' + FONT; ctx.fillText('COMANDA DE PEDIDO', PAD + 100, 96);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '900 30px ' + FONT; ctx.fillText('Nº ' + (order.code || '-'), W - PAD, 62);
    var when = order.createdAt ? new Date(order.createdAt) : new Date();
    ctx.fillStyle = '#FFD2A8'; ctx.font = '700 18px ' + FONT; ctx.fillText(when.toLocaleDateString('pt-BR') + ' ' + when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), W - PAD, 96);
    ctx.textAlign = 'left';

    var y = 150;
    function box(title, lines){
      var h = boxH(lines.length || 1);
      ctx.fillStyle = '#fff'; rr(ctx, PAD, y, W - PAD * 2, h, 18); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = C.accent; ctx.font = '900 16px ' + FONT; ctx.fillText(title.toUpperCase(), PAD + 22, y + 34);
      ctx.font = '700 21px ' + FONT;
      if(!lines.length){ ctx.fillStyle = C.muted; ctx.fillText('Não informado', PAD + 22, y + 72); }
      lines.forEach(function(l, i){
        var ly = y + 72 + i * 36;
        ctx.fillStyle = C.muted; ctx.font = '700 18px ' + FONT; ctx.fillText(l[0], PAD + 22, ly);
        ctx.fillStyle = C.ink; ctx.font = '800 21px ' + FONT;
        var t = wrap(ctx, l[1], W - PAD * 2 - 220, 1)[0] || '';
        ctx.fillText(t, PAD + 170, ly);
      });
      y += h + 18;
    }
    box('Cliente', custLines); box('Entrega', delLines); box('Pagamento', payLines);

    // itens
    ctx.fillStyle = C.black; ctx.font = '900 26px ' + FONT; ctx.fillText('Itens do pedido', PAD, y + 34);
    ctx.fillStyle = C.orange; ctx.fillRect(PAD, y + 44, 64, 5);
    y += 64;
    items.forEach(function(it, i){
      var lines = rowsInfo[i];
      var h = Math.max(96, 36 + lines.length * 28 + 38);
      ctx.fillStyle = '#fff'; rr(ctx, PAD, y, W - PAD * 2, h, 16); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      // foto
      var ix = PAD + 12, iy = y + 12, is = h - 24 < 84 ? 72 : Math.min(h - 24, 84);
      ctx.fillStyle = '#F6F0E7'; rr(ctx, ix, iy, is, is, 12); ctx.fill();
      if(imgs[i]){
        ctx.save(); rr(ctx, ix, iy, is, is, 12); ctx.clip();
        var iw = imgs[i].width, ih = imgs[i].height, r = Math.min((is - 8) / iw, (is - 8) / ih);
        ctx.drawImage(imgs[i], ix + (is - iw * r) / 2, iy + (is - ih * r) / 2, iw * r, ih * r); ctx.restore();
      } else {
        ctx.fillStyle = C.orange; ctx.font = '900 30px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('🐾', ix + is / 2, iy + is / 2 + 11); ctx.textAlign = 'left';
      }
      var tx = ix + is + 18;
      ctx.fillStyle = C.ink; ctx.font = '800 22px ' + FONT;
      lines.forEach(function(l, k){ ctx.fillText(l, tx, y + 36 + k * 28); });
      ctx.fillStyle = C.muted; ctx.font = '700 17px ' + FONT;
      var sub = (it.internal ? 'Cód.: ' + it.internal + '   ' : '') + money(it.price) + ' un.';
      ctx.fillText(sub, tx, y + 36 + lines.length * 28 + 6);
      // qtd e subtotal
      ctx.textAlign = 'right';
      ctx.fillStyle = C.black; ctx.font = '900 24px ' + FONT; ctx.fillText(money(Number(it.price || 0) * Number(it.qty || 0)), W - PAD - 18, y + 42);
      ctx.fillStyle = C.orange; rr(ctx, W - PAD - 18 - 74, y + h - 46, 74, 32, 16); ctx.fill();
      ctx.fillStyle = C.black; ctx.font = '900 19px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('x ' + it.qty, W - PAD - 18 - 37, y + h - 24);
      ctx.textAlign = 'left';
      y += h + 12;
    });

    // total
    ctx.fillStyle = C.brown; rr(ctx, PAD, y + 6, W - PAD * 2, 76, 18); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 22px ' + FONT; ctx.fillText('TOTAL DO PEDIDO', PAD + 24, y + 54);
    ctx.textAlign = 'right'; ctx.fillStyle = C.orange; ctx.font = '900 36px ' + FONT; ctx.fillText(money(order.total), W - PAD - 24, y + 56); ctx.textAlign = 'left';
    y += 110;
    ctx.fillStyle = C.muted; ctx.font = '700 16px ' + FONT;
    ctx.fillText('Imagens meramente ilustrativas. Valores sujeitos à confirmação de estoque pela loja.', PAD, y);
    ctx.fillText('boxdasracoes.com.br', PAD, y + 26);

    // corta altura sobrando
    var finalH = Math.min(H, y + 50);
    var out = document.createElement('canvas'); out.width = W * scale; out.height = finalH * scale;
    out.getContext('2d').drawImage(cv, 0, 0, W * scale, finalH * scale, 0, 0, W * scale, finalH * scale);
    return new Promise(function(resolve, reject){
      out.toBlob(function(b){ b ? resolve(b) : reject(new Error('Falha ao gerar a comanda')); }, 'image/png');
    });
  }

  // ---- janela com as opções de envio ----
  function showDialog(order, blob){
    var old = document.getElementById('comanda-dialog'); if(old) old.remove();
    var url = URL.createObjectURL(blob);
    var file = null; try{ file = new File([blob], 'comanda-' + (order.code || 'pedido') + '.png', { type: 'image/png' }); }catch(e){}
    var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    var canCopy = !!(navigator.clipboard && window.ClipboardItem);
    var back = document.createElement('div'); back.id = 'comanda-dialog'; back.className = 'cmd-back';
    back.innerHTML = '<div class="cmd" role="dialog" aria-modal="true" aria-labelledby="cmd-title" tabindex="-1">'
      + '<h2 id="cmd-title">Comanda do seu pedido</h2>'
      + '<p class="cmd-text">O texto do pedido já foi para o WhatsApp. Envie também a <strong>comanda com as fotos</strong>, para a loja separar tudo certinho.</p>'
      + '<div class="cmd-prev"><img alt="Comanda do pedido ' + (order.code || '') + '" src="' + url + '"></div>'
      + '<div class="cmd-actions"></div><p class="cmd-status" role="status" aria-live="polite"></p></div>';
    var actions = back.querySelector('.cmd-actions'), status = back.querySelector('.cmd-status');
    function btn(label, cls, fn){ var b = document.createElement('button'); b.type = 'button'; b.className = 'cmd-btn ' + cls; b.textContent = label; b.addEventListener('click', fn); actions.appendChild(b); return b; }
    if(canShare){
      btn('Enviar comanda pelo WhatsApp', 'cmd-primary', async function(){
        try{ await navigator.share({ files: [file], title: 'Comanda ' + (order.code || ''), text: 'Comanda do pedido ' + (order.code || '') }); status.textContent = 'Comanda compartilhada.'; }
        catch(e){ if(e && e.name !== 'AbortError') status.textContent = 'Não foi possível compartilhar. Use "Baixar comanda".'; }
      });
    }
    if(canCopy){
      btn('Copiar imagem', canShare ? 'cmd-secondary' : 'cmd-primary', async function(){
        try{ await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); status.textContent = 'Imagem copiada. Cole (Ctrl+V) na conversa do WhatsApp.'; }
        catch(e){ status.textContent = 'Não foi possível copiar. Use "Baixar comanda".'; }
      });
    }
    var dl = btn('Baixar comanda', 'cmd-secondary', function(){
      var a = document.createElement('a'); a.href = url; a.download = 'comanda-' + (order.code || 'pedido') + '.png'; document.body.appendChild(a); a.click(); a.remove();
      status.textContent = 'Comanda baixada. Anexe na conversa do WhatsApp.';
    });
    btn('Fechar', 'cmd-ghost', close);
    function close(){ back.remove(); URL.revokeObjectURL(url); Array.prototype.forEach.call(document.body.children, function(n){ n.removeAttribute('inert'); }); if(last && document.contains(last)) last.focus(); }
    var last = document.activeElement;
    Array.prototype.forEach.call(document.body.children, function(n){ if(n.tagName !== 'SCRIPT') n.setAttribute('inert', ''); });
    document.body.appendChild(back); back.removeAttribute('inert');
    back.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ e.stopPropagation(); close(); }
      if(e.key === 'Tab'){
        var f = Array.prototype.slice.call(back.querySelectorAll('button')); var a = f[0], z = f[f.length - 1];
        if(e.shiftKey && document.activeElement === a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey && document.activeElement === z){ e.preventDefault(); a.focus(); }
      }
    });
    (actions.querySelector('button') || back.querySelector('.cmd')).focus();
    return { close: close };
  }

  window.comanda = { build: build, showDialog: showDialog };
})();
