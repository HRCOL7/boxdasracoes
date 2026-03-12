(function(){
  function isSiteCheckoutEnabled(){
    try{
      if(window.appUtils && typeof window.appUtils.getSiteSettings === 'function'){
        const settings = window.appUtils.getSiteSettings() || {};
        return settings.siteCheckoutEnabled === true;
      }
    }catch(err){ }
    return false;
  }

  function buildPaymentPendingNote(data){
    const delivery = data && data.delivery ? data.delivery : {};
    const lines = [
      'Checkout no site (preparacao de gateway)',
      `Canal: ${data && data.checkoutChannel ? data.checkoutChannel : 'site'}`,
      `Pagamento escolhido: ${data && data.payment ? data.payment : ''}`,
      `Agendamento: ${delivery.date || ''} ${delivery.window || ''}`,
      `Endereco: ${delivery.street || ''}, ${delivery.number || ''} - ${delivery.neighborhood || ''}`,
      `CEP: ${delivery.zip || ''}`,
      `Referencia: ${delivery.reference || ''}`
    ];
    return lines.join('\n').trim();
  }

  async function createSitePreOrder(data){
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
        note: buildPaymentPendingNote(data),
        status: 'pending',
        source: 'site_checkout_pending_payment'
      };

      const result = await client
        .from('customer_orders')
        .insert(payload)
        .select('order_number')
        .single();

      if(result && result.error) throw result.error;
      if(result && result.data && result.data.order_number) return String(result.data.order_number);
      return null;
    }catch(err){
      console.warn('Falha ao criar pedido de checkout no site', err);
      return null;
    }
  }

  document.addEventListener('checkout-site-ready', async function(e){
    if(!isSiteCheckoutEnabled()) return;
    const data = e && e.detail ? e.detail : {};
    const items = Array.isArray(data.items) ? data.items : [];

    try{
      if(window.siteAnalytics && typeof window.siteAnalytics.track === 'function'){
        window.siteAnalytics.track('site_checkout_started', {
          total: Number(data.total || 0),
          payment: data.payment || null,
          meta: { items_count: items.length }
        });
      }
    }catch(err){ console.warn('Falha ao registrar site_checkout_started', err); }

    const orderNumber = await createSitePreOrder(data);
    const localCode = 'SCP' + Date.now().toString(36).toUpperCase().slice(-8);
    const code = orderNumber || localCode;

    try{
      localStorage.setItem('site_checkout_last', JSON.stringify({
        order_number: code,
        created_at: new Date().toISOString(),
        payment: data.payment || null,
        total: Number(data.total || 0),
        delivery: data.delivery || null
      }));
    }catch(err){ }

    alert(
      'Pedido criado para checkout no site: ' + code + '\n\n' +
      'Endereco e agendamento confirmados.\n' +
      'Integracao PIX/cartao fica pronta para conectar com o gateway quando voce decidir ativar.'
    );

    try{
      if(window.siteAnalytics && typeof window.siteAnalytics.track === 'function'){
        const numericOrder = Number(code);
        window.siteAnalytics.track('site_checkout_created', {
          order_number: Number.isFinite(numericOrder) ? numericOrder : null,
          total: Number(data.total || 0),
          payment: data.payment || null,
          meta: { mode: orderNumber ? 'supabase' : 'local-fallback' }
        });
      }
    }catch(err){ console.warn('Falha ao registrar site_checkout_created', err); }

    document.dispatchEvent(new CustomEvent('site-checkout-created', { detail: { orderNumber: code, source: orderNumber ? 'supabase' : 'local' } }));
  });
})();
