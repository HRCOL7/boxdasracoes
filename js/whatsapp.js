(function(){
  function deliveryText(dl){
    if(!dl) return '';
    var parts = [];
    var a = [dl.street, dl.number].filter(Boolean).join(', ');
    if(a) parts.push('Endereço: ' + a);
    if(dl.neighborhood) parts.push('Bairro: ' + dl.neighborhood);
    if(dl.zip) parts.push('CEP: ' + dl.zip);
    if(dl.reference) parts.push('Ref.: ' + dl.reference);
    if(dl.date || dl.window) parts.push('Entrega: ' + [dl.date ? dl.date.split('-').reverse().join('/') : '', dl.window].filter(Boolean).join(' ' ));
    return parts.join(' | ');
  }
  function noteFor(data){
    // linhas no mesmo formato que o painel de pedidos já entende (Endereco:, CEP:, Referencia:, Agendamento:...)
    var n = [], dl = data.delivery || {};
    if(data.needChange === 'yes' || data.needChange === true) n.push('Cliente informou que precisa de troco.' + (data.cashPaid ? ' Troco para R$ ' + Number(data.cashPaid).toFixed(2) + '.' : ''));
    if(data.payment) n.push('Pagamento escolhido: ' + ((window.appUtils && window.appUtils.paymentLabels && window.appUtils.paymentLabels[data.payment]) || data.payment));
    var addr = [dl.street, dl.number, dl.neighborhood].filter(Boolean).join(', ');
    if(addr) n.push('Endereco: ' + addr);
    if(dl.zip) n.push('CEP: ' + dl.zip);
    if(dl.reference) n.push('Referencia: ' + dl.reference);
    if(dl.date || dl.window) n.push('Agendamento: ' + [dl.date ? dl.date.split('-').reverse().join('/') : '', dl.window].filter(Boolean).join(' '));
    if(addr) n.push('Endereco confirmado pelo cliente: sim');
    return n.length ? n.join('\n') : null;
  }
  async function createPreOrder(data){
    try{
      if(!window.supa || typeof window.supa.init !== 'function') return null;
      const client = window.supa.init();
      if(!client || !client.from) return null;

      const authUser = (window.customerAuth && typeof window.customerAuth.getCurrentUser === 'function')
        ? window.customerAuth.getCurrentUser()
        : null;

      const payload = {
        customer_id: authUser && authUser.id ? authUser.id : null,
        customer_email: authUser && authUser.email ? authUser.email : null,
        customer_name: authUser && authUser.user_metadata && authUser.user_metadata.full_name ? authUser.user_metadata.full_name : null,
        customer_phone: authUser && authUser.user_metadata && authUser.user_metadata.phone ? authUser.user_metadata.phone : null,
        items: Array.isArray(data.items) ? data.items : [],
        payment: data.payment || null,
        total: Number(data.total || 0),
        note: noteFor(data),
        status: 'pending',
        source: 'site_checkout'
      };

      const result = await client
        .from('customer_orders')
        .insert(payload)
        .select('order_number')
        .single();

      if(result && result.error) throw result.error;
      if(result && result.data && result.data.order_number){
        return String(result.data.order_number);
      }
      return null;
    }catch(err){
      console.warn('Falha ao criar pré-venda no Supabase', err);
      return null;
    }
  }

  // Build and open WhatsApp message when checkout event is dispatched
  document.addEventListener('checkout-ready', async e => {
    const data = e.detail || {};
    const items = Array.isArray(data.items) ? data.items : [];
    try{
      if(window.siteAnalytics && typeof window.siteAnalytics.track === 'function'){
        window.siteAnalytics.track('checkout_started', {
          total: Number(data.total || 0),
          payment: data.payment || null,
          meta: { items_count: items.length }
        });
      }
    }catch(err){ console.warn('Falha ao registrar evento checkout_started', err); }
    const popup = window.open('', '_blank');
    const code = await createPreOrder(data) || ('ORD' + Date.now().toString(36).toUpperCase().slice(-8));
    const settings = (window.appUtils && typeof window.appUtils.getSiteSettings === 'function')
      ? window.appUtils.getSiteSettings()
      : { whatsappIncludeCustomerData: true };

    const stripTags = (s) => (s===null||s===undefined) ? '' : String(s).replace(/<[^>]*>/g,'').trim();
    // use centralized payment labels directly
    const payLabel = (window.appUtils && window.appUtils.paymentLabels && window.appUtils.paymentLabels[data.payment]) || data.payment || '';

    let lines = [];
    lines.push(`Pré-venda: ${code}`);
    items.forEach(i => {
      const name = stripTags(i.name || '');
      const internal = i.internal ? ` (cód: ${stripTags(i.internal)})` : '';
      lines.push(`${name}${internal} x${i.qty} - R$ ${(i.price * i.qty).toFixed(2)}`);
    });
    lines.push('');
    lines.push(`Total: R$ ${Number(data.total || 0).toFixed(2)}`);
    lines.push(`Pagamento: ${payLabel}`);
    if(data.delivery){
      var dt = deliveryText(data.delivery);
      if(dt){ lines.push(''); lines.push('Entrega:'); dt.split(' | ').forEach(function(l){ lines.push(l); }); }
    }
    if(data.needChange === 'yes' || data.needChange === true) lines.push(`Necessita troco: ${data.needChange}`);

    if(settings.whatsappIncludeCustomerData !== false){
      const authUser = (window.customerAuth && typeof window.customerAuth.getCurrentUser === 'function')
        ? window.customerAuth.getCurrentUser()
        : null;
      const md = authUser && authUser.user_metadata ? authUser.user_metadata : {};
      const customerLines = [
        md.full_name ? `Cliente: ${stripTags(md.full_name)}` : '',
        authUser && authUser.email ? `Email: ${stripTags(authUser.email)}` : '',
        md.phone ? `Telefone: ${stripTags(md.phone)}` : '',
        md.document ? `Documento: ${stripTags(md.document)}` : '',
        md.street ? `Rua: ${stripTags(md.street)}` : '',
        md.number ? `Número: ${stripTags(md.number)}` : '',
        md.neighborhood ? `Bairro: ${stripTags(md.neighborhood)}` : '',
        md.zip ? `CEP: ${stripTags(md.zip)}` : ''
      ].filter(Boolean);
      if(customerLines.length){
        lines.push('');
        lines.push('Dados do cliente:');
        customerLines.forEach(l=>lines.push(l));
      }
    }

    const text = lines.join('\n');
    const encoded = encodeURIComponent(text);

    // Número padrão (internacional, sem '+'). Pode ser sobrescrito em runtime via localStorage.setItem('whatsapp_phone', '<num>')
    const defaultPhone = '5579999028870';
    const phone = localStorage.getItem('whatsapp_phone') || defaultPhone;

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    let url;
    if(isMobile){
      url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    } else {
      url = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://web.whatsapp.com/send?text=${encoded}`;
    }

    try{
      if(window.siteAnalytics && typeof window.siteAnalytics.track === 'function'){
        const orderNumber = Number(code);
        const safeOrder = Number.isFinite(orderNumber) ? orderNumber : null;
        const total = Number(data.total || 0);
        window.siteAnalytics.track('whatsapp_opened', {
          order_number: safeOrder,
          total,
          payment: data.payment || null,
          meta: { items_count: items.length }
        });
        if(safeOrder){
          window.siteAnalytics.track('preorder_created', {
            order_number: safeOrder,
            total,
            payment: data.payment || null
          });
        }
      }
    }catch(err){ console.warn('Falha ao registrar eventos de checkout', err); }

    if(popup && !popup.closed){ popup.location.href = url; }
    else { window.open(url, '_blank'); }

    // Comanda em imagem (cliente, entrega, pagamento e itens com foto) para enviar junto ao WhatsApp
    try{
      if(window.comanda){
        const au = (window.customerAuth && typeof window.customerAuth.getCurrentUser === 'function') ? window.customerAuth.getCurrentUser() : null;
        const md = au && au.user_metadata ? au.user_metadata : {};
        const order = {
          code, items, total: Number(data.total || 0), payment: data.payment, paymentLabel: payLabel,
          needChange: data.needChange, cashPaid: data.cashPaid, delivery: data.delivery || {},
          customer: { name: md.full_name || '', phone: md.phone || '', email: au && au.email ? au.email : '', document: md.document || '' },
          createdAt: Date.now()
        };
        const blob = await window.comanda.build(order);
        window.comanda.showDialog(order, blob);
      }
    }catch(err){ console.warn('Falha ao gerar a comanda', err); }
  });
})();
