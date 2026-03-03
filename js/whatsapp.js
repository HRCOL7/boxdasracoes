(function(){
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
        note: data.needChange === 'yes' || data.needChange === true ? 'Cliente informou que precisa de troco.' : null,
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
    if(popup && !popup.closed){ popup.location.href = url; }
    else { window.open(url, '_blank'); }
  });
})();
