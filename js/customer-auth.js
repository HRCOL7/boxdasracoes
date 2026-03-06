(function(){
  const AUTH_MODAL_ID = 'customer-auth-modal';
  const ACCOUNT_MODAL_ID = 'customer-account-modal';
  const FAVORITES_KEY = 'favorite_product_ids';
  let currentUser = null;
  let resolver = null;

  function escapeHtml(s){
    if(window.appUtils && typeof window.appUtils.escapeHtml === 'function') return window.appUtils.escapeHtml(s);
    return String(s===null||s===undefined?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function isEmailConfirmationError(err){
    const msg = String((err && (err.message || err.error_description || err.code)) || '').toLowerCase();
    return msg.includes('email not confirmed') || msg.includes('email_not_confirmed') || msg.includes('confirm your email') || msg.includes('confirme seu email');
  }

  function getClient(){
    try{
      if(window.supa && typeof window.supa.init === 'function') return window.supa.init();
    }catch(e){ console.warn('Supabase client unavailable', e); }
    return null;
  }

  async function getUser(){
    try{
      if(window.supa && typeof window.supa.getUser === 'function'){
        currentUser = await window.supa.getUser();
      }
    }catch(e){ currentUser = null; }
    return currentUser;
  }

  function ensureModal(){
    let modal = document.getElementById(AUTH_MODAL_ID);
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = AUTH_MODAL_ID;
    modal.className = 'modal customer-auth-modal';
    modal.innerHTML = `
      <div class="modal-body customer-auth-card">
        <h3 class="customer-auth-title">Entrar para finalizar compra</h3>
        <p class="customer-auth-subtitle">Cadastre-se uma vez e nas próximas compras é só fazer login.</p>

        <div class="customer-auth-tabs">
          <button type="button" class="btn customer-auth-tab active" data-tab="login">Login</button>
          <button type="button" class="btn customer-auth-tab" data-tab="register">Cadastrar</button>
        </div>

        <div id="customer-auth-status" class="customer-auth-status" style="display:none"></div>

        <form id="customer-login-form" class="customer-auth-form">
          <label>Email
            <input type="email" name="email" required autocomplete="email" placeholder="seuemail@dominio.com">
          </label>
          <label>Senha
            <input type="password" name="password" required autocomplete="current-password" placeholder="Sua senha">
          </label>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Entrar</button>
            <button type="button" class="btn customer-auth-cancel">Cancelar</button>
          </div>
        </form>

        <form id="customer-register-form" class="customer-auth-form hidden">
          <label>Nome completo
            <input type="text" name="full_name" required placeholder="Nome e sobrenome">
          </label>
          <label>Email
            <input type="email" name="email" required autocomplete="email" placeholder="seuemail@dominio.com">
          </label>
          <label>Senha
            <input type="password" name="password" required autocomplete="new-password" placeholder="Crie uma senha" minlength="6">
          </label>
          <label>Confirmar senha
            <input type="password" name="password_confirm" required autocomplete="new-password" placeholder="Digite a senha novamente" minlength="6">
          </label>
          <label>Telefone / WhatsApp
            <input type="text" name="phone" required placeholder="(79) 99999-9999">
          </label>
          <label>CPF/CNPJ
            <input type="text" name="document" required placeholder="000.000.000-00">
          </label>
          <div class="customer-auth-grid two-cols">
            <label>CEP
              <input type="text" name="zip" required placeholder="49000-000">
            </label>
            <label>UF
              <input type="text" name="state" required placeholder="SE" maxlength="2">
            </label>
          </div>
          <label>Rua
            <input type="text" name="street" required placeholder="Nome da rua/avenida">
          </label>
          <div class="customer-auth-grid two-cols">
            <label>Número
              <input type="text" name="number" required placeholder="123">
            </label>
            <label>Complemento
              <input type="text" name="complement" placeholder="Casa, apto, bloco...">
            </label>
          </div>
          <div class="customer-auth-grid two-cols">
            <label>Bairro
              <input type="text" name="neighborhood" required placeholder="Seu bairro">
            </label>
            <label>Cidade
              <input type="text" name="city" required placeholder="Sua cidade">
            </label>
          </div>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Cadastrar</button>
            <button type="button" class="btn customer-auth-cancel">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const loginForm = modal.querySelector('#customer-login-form');
    const registerForm = modal.querySelector('#customer-register-form');
    const status = modal.querySelector('#customer-auth-status');

    function setStatus(msg, type){
      if(!status) return;
      if(!msg){ status.style.display = 'none'; status.textContent = ''; return; }
      status.style.display = 'block';
      status.textContent = msg;
      status.className = 'customer-auth-status ' + (type || 'info');
    }

    modal.querySelectorAll('.customer-auth-tab').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        modal.querySelectorAll('.customer-auth-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if(tab === 'login'){
          loginForm.classList.remove('hidden');
          registerForm.classList.add('hidden');
        } else {
          loginForm.classList.add('hidden');
          registerForm.classList.remove('hidden');
        }
        setStatus('');
      });
    });

    modal.querySelectorAll('.customer-auth-cancel').forEach(btn=>btn.addEventListener('click', ()=>closeModal(false)));

    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(loginForm);
      const email = String(fd.get('email') || '').trim();
      const password = String(fd.get('password') || '');
      if(!email || !password){ setStatus('Informe email e senha.', 'error'); return; }
      try{
        if(!window.supa || typeof window.supa.signIn !== 'function') throw new Error('Supabase Auth não configurado.');
        await window.supa.signIn(email, password);
        currentUser = await getUser();
        setStatus('Login efetuado com sucesso.', 'success');
        setTimeout(()=>closeModal(true), 250);
      }catch(err){
        console.warn('Customer login failed', err);
        if(isEmailConfirmationError(err)){
          let resent = false;
          try{
            if(window.supa && typeof window.supa.resendConfirmation === 'function'){
              await window.supa.resendConfirmation(email);
              resent = true;
            }
          }catch(resendErr){ console.warn('Resend confirmation failed', resendErr); }
          if(resent) setStatus('Email não confirmado. Reenviamos um novo link de confirmação para seu email.', 'error');
          else setStatus('Confirme seu email para concluir o login.', 'error');
          return;
        }
        setStatus('Falha no login: ' + (err && err.message ? err.message : String(err)), 'error');
      }
    });

    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(registerForm);
      const payload = {
        full_name: String(fd.get('full_name') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        password: String(fd.get('password') || ''),
        password_confirm: String(fd.get('password_confirm') || ''),
        phone: String(fd.get('phone') || '').trim(),
        document: String(fd.get('document') || '').trim(),
        zip: String(fd.get('zip') || '').trim(),
        state: String(fd.get('state') || '').trim().toUpperCase(),
        street: String(fd.get('street') || '').trim(),
        number: String(fd.get('number') || '').trim(),
        complement: String(fd.get('complement') || '').trim(),
        neighborhood: String(fd.get('neighborhood') || '').trim(),
        city: String(fd.get('city') || '').trim()
      };
      if(!payload.full_name || !payload.email || !payload.password || !payload.password_confirm || !payload.phone || !payload.document || !payload.zip || !payload.state || !payload.street || !payload.number || !payload.neighborhood || !payload.city){
        setStatus('Preencha todos os campos do cadastro.', 'error');
        return;
      }
      if(payload.password !== payload.password_confirm){
        setStatus('A confirmação de senha não confere.', 'error');
        return;
      }

      const address = [
        `${payload.street}, ${payload.number}`,
        payload.complement ? `Compl.: ${payload.complement}` : '',
        `${payload.neighborhood} - ${payload.city}/${payload.state}`,
        `CEP: ${payload.zip}`
      ].filter(Boolean).join(' | ');

      const client = getClient();
      if(!client) { setStatus('Supabase não configurado no site.', 'error'); return; }

      try{
        const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
        const signUpRes = await client.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            emailRedirectTo,
            data: { full_name: payload.full_name, phone: payload.phone, document: payload.document, address: address, zip: payload.zip, state: payload.state, street: payload.street, number: payload.number, complement: payload.complement, neighborhood: payload.neighborhood, city: payload.city }
          }
        });
        if(signUpRes && signUpRes.error) throw signUpRes.error;

        let awaitingEmailConfirmation = false;
        if(window.supa && typeof window.supa.signIn === 'function'){
          try{
            await window.supa.signIn(payload.email, payload.password);
          }catch(signInErr){
            if(isEmailConfirmationError(signInErr)){
              awaitingEmailConfirmation = true;
            } else {
              throw signInErr;
            }
          }
        }

        currentUser = await getUser();
        if(currentUser){
          const profile = {
            id: currentUser.id,
            full_name: payload.full_name,
            email: payload.email,
            phone: payload.phone,
            document: payload.document,
            address: address,
            updated_at: new Date().toISOString()
          };
          try{
            await client.from('customer_profiles').upsert(profile, { onConflict: 'id' });
          }catch(err){ console.warn('Failed to upsert customer profile', err); }
          try{
            await client.from('customer_erp_queue').insert({
              customer_id: currentUser.id,
              full_name: payload.full_name,
              email: payload.email,
              phone: payload.phone,
              document: payload.document,
              address: address,
              status: 'pending',
              source: 'site_signup'
            });
          }catch(err){ console.warn('Failed to enqueue customer ERP sync', err); }
        }

        if(currentUser){
          setStatus('Cadastro concluído! Login ativo.', 'success');
          setTimeout(()=>closeModal(true), 350);
          return;
        }

        if(awaitingEmailConfirmation){
          setStatus('Cadastro criado. Confirme seu email para ativar a conta e depois faça login.', 'success');
          setTimeout(()=>closeModal(false), 1200);
          return;
        }

        setStatus('Cadastro concluído. Faça login para continuar.', 'success');
      }catch(err){
        console.warn('Customer signup failed', err);
        setStatus('Falha no cadastro: ' + (err && err.message ? err.message : String(err)), 'error');
      }
    });

    return modal;
  }

  function openModal(){
    const modal = ensureModal();
    modal.classList.add('visible');
  }

  function closeModal(success){
    const modal = document.getElementById(AUTH_MODAL_ID);
    if(modal) modal.classList.remove('visible');
    if(resolver){
      resolver(!!success);
      resolver = null;
    }
  }

  async function ensureAuthenticated(){
    const user = await getUser();
    if(user) return true;
    openModal();
    return new Promise(resolve=>{ resolver = resolve; });
  }

  function getFavoriteIds(){
    try{
      const raw = localStorage.getItem(FAVORITES_KEY) || '[]';
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed.map(v=>String(v)).filter(Boolean);
    }catch(e){ return []; }
  }

  function upsertAddressInProfile(client, user, data){
    if(!client || !user) return Promise.resolve();
    const address = [
      `${data.street || ''}, ${data.number || ''}`.replace(/^,\s*/, '').trim(),
      data.complement ? `Compl.: ${data.complement}` : '',
      `${data.neighborhood || ''} - ${data.city || ''}/${data.state || ''}`.replace(/^\s*-\s*/, '').trim(),
      data.zip ? `CEP: ${data.zip}` : ''
    ].filter(Boolean).join(' | ');
    return client.from('customer_profiles').upsert({
      id: user.id,
      full_name: (user.user_metadata && user.user_metadata.full_name) || user.email || 'Cliente',
      email: user.email || '',
      phone: data.phone || (user.user_metadata && user.user_metadata.phone) || null,
      document: (user.user_metadata && user.user_metadata.document) || null,
      address,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  }

  function ensureAccountModal(){
    let modal = document.getElementById(ACCOUNT_MODAL_ID);
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = ACCOUNT_MODAL_ID;
    modal.className = 'modal customer-auth-modal';
    modal.innerHTML = `
      <div class="modal-body customer-auth-card">
        <h3 class="customer-auth-title">Minha conta</h3>
        <p id="customer-account-subtitle" class="customer-auth-subtitle"></p>
        <div id="customer-account-status" class="customer-auth-status" style="display:none"></div>

        <div class="customer-auth-tabs">
          <button type="button" class="btn customer-auth-tab active" data-account-tab="address">Endereço</button>
          <button type="button" class="btn customer-auth-tab" data-account-tab="password">Senha</button>
          <button type="button" class="btn customer-auth-tab" data-account-tab="favorites">Favoritos</button>
        </div>

        <form id="customer-account-address" class="customer-auth-form">
          <div class="customer-auth-grid two-cols">
            <label>Telefone
              <input type="text" name="phone" placeholder="(79) 99999-9999">
            </label>
            <label>CEP
              <input type="text" name="zip" placeholder="49000-000">
            </label>
          </div>
          <label>Rua
            <input type="text" name="street" placeholder="Nome da rua/avenida">
          </label>
          <div class="customer-auth-grid two-cols">
            <label>Número
              <input type="text" name="number" placeholder="123">
            </label>
            <label>Complemento
              <input type="text" name="complement" placeholder="Casa, apto, bloco...">
            </label>
          </div>
          <div class="customer-auth-grid two-cols">
            <label>Bairro
              <input type="text" name="neighborhood" placeholder="Seu bairro">
            </label>
            <label>Cidade
              <input type="text" name="city" placeholder="Sua cidade">
            </label>
          </div>
          <div class="customer-auth-grid two-cols">
            <label>UF
              <input type="text" name="state" maxlength="2" placeholder="SE">
            </label>
          </div>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Salvar endereço</button>
          </div>
        </form>

        <form id="customer-account-password" class="customer-auth-form hidden">
          <label>Nova senha
            <input type="password" name="new_password" minlength="6" placeholder="Mínimo 6 caracteres">
          </label>
          <label>Confirmar nova senha
            <input type="password" name="new_password_confirm" minlength="6" placeholder="Repita a nova senha">
          </label>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Atualizar senha</button>
          </div>
        </form>

        <div id="customer-account-favorites" class="customer-auth-form hidden">
          <div id="customer-favorites-list" class="customer-favorites-list"></div>
        </div>

        <div class="customer-auth-actions">
          <button type="button" id="customer-account-logout" class="btn">Sair</button>
          <button type="button" id="customer-account-close" class="btn">Fechar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function openAccountModal(){
    const modal = ensureAccountModal();
    const subtitle = modal.querySelector('#customer-account-subtitle');
    const status = modal.querySelector('#customer-account-status');
    const addressForm = modal.querySelector('#customer-account-address');
    const passwordForm = modal.querySelector('#customer-account-password');
    const favoritesPane = modal.querySelector('#customer-account-favorites');
    const favoritesList = modal.querySelector('#customer-favorites-list');

    function setStatus(msg, type){
      if(!status) return;
      if(!msg){ status.style.display = 'none'; status.textContent = ''; return; }
      status.style.display = 'block';
      status.textContent = msg;
      status.className = 'customer-auth-status ' + (type || 'info');
    }

    const md = (currentUser && currentUser.user_metadata) ? currentUser.user_metadata : {};
    if(subtitle){
      subtitle.textContent = (md.full_name || currentUser?.email || 'Cliente') + (currentUser?.email ? ` (${currentUser.email})` : '');
    }

    const set = (name, val) => {
      const el = addressForm && addressForm.querySelector(`[name="${name}"]`);
      if(el) el.value = val || '';
    };
    set('phone', md.phone);
    set('zip', md.zip);
    set('street', md.street);
    set('number', md.number);
    set('complement', md.complement);
    set('neighborhood', md.neighborhood);
    set('city', md.city);
    set('state', md.state);

    function switchTab(tab){
      modal.querySelectorAll('[data-account-tab]').forEach(btn=>btn.classList.toggle('active', btn.dataset.accountTab === tab));
      addressForm.classList.toggle('hidden', tab !== 'address');
      passwordForm.classList.toggle('hidden', tab !== 'password');
      favoritesPane.classList.toggle('hidden', tab !== 'favorites');
      setStatus('');
      if(tab === 'favorites'){
        const ids = getFavoriteIds();
        let products = [];
        try{ products = JSON.parse(localStorage.getItem('products') || '[]'); }catch(e){ products = []; }
        const map = new Map((Array.isArray(products) ? products : []).map(p=>[String(p.id), p]));
        if(!ids.length){
          favoritesList.innerHTML = '<div class="customer-fav-empty">Nenhum produto favoritado ainda.</div>';
          return;
        }
        const cards = ids.map(id=>{
          const p = map.get(String(id));
          if(!p) return '';
          const image = (Array.isArray(p.images) && p.images.length) ? p.images[0] : (p.image || 'https://via.placeholder.com/200');
          const variants = Array.isArray(p.variants) ? p.variants : [];
          const chips = variants.length
            ? '<div class="customer-fav-chips">' + variants.slice(0,3).map(v=>`<span class="customer-fav-chip">${escapeHtml(v.weight || '')}</span>`).join('') + '</div>'
            : (p.variant ? `<div class="customer-fav-chips"><span class="customer-fav-chip">${escapeHtml(p.variant)}</span></div>` : '');
          const firstPrice = variants.length ? Number(variants[0].price || 0) : Number(p.price || 0);
          return `
            <a class="customer-fav-card" href="product.html?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(p.name || '')}">
              <div class="customer-fav-image-wrap"><img src="${String(image).replace(/"/g,'&quot;')}" alt="${escapeHtml(p.name || 'Produto')}"></div>
              ${chips}
              <div class="customer-fav-name">${escapeHtml(p.name || 'Produto')}</div>
              <div class="customer-fav-price">R$ ${firstPrice.toFixed(2)}</div>
            </a>
          `;
        }).filter(Boolean).join('');
        favoritesList.innerHTML = cards || '<div class="customer-fav-empty">Nenhum favorito disponível no cache atual.</div>';
      }
    }

    if(!modal.dataset.bound){
      modal.dataset.bound = '1';
      modal.querySelectorAll('[data-account-tab]').forEach(btn=>btn.addEventListener('click', ()=>switchTab(btn.dataset.accountTab)));
      modal.querySelector('#customer-account-close')?.addEventListener('click', ()=>modal.classList.remove('visible'));
      modal.querySelector('#customer-account-logout')?.addEventListener('click', async ()=>{
        try{ if(window.supa && typeof window.supa.signOut === 'function') await window.supa.signOut(); }catch(e){}
        currentUser = null;
        modal.classList.remove('visible');
        updateAuthUi();
      });

      addressForm?.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        try{
          const client = getClient();
          if(!client || !currentUser) throw new Error('Usuário não autenticado.');
          const fd = new FormData(addressForm);
          const payload = {
            phone: String(fd.get('phone') || '').trim(),
            zip: String(fd.get('zip') || '').trim(),
            street: String(fd.get('street') || '').trim(),
            number: String(fd.get('number') || '').trim(),
            complement: String(fd.get('complement') || '').trim(),
            neighborhood: String(fd.get('neighborhood') || '').trim(),
            city: String(fd.get('city') || '').trim(),
            state: String(fd.get('state') || '').trim().toUpperCase()
          };
          const userData = { ...(currentUser.user_metadata || {}), ...payload };
          const upd = await client.auth.updateUser({ data: userData });
          if(upd && upd.error) throw upd.error;
          await upsertAddressInProfile(client, currentUser, payload);
          await getUser();
          setStatus('Endereço atualizado com sucesso.', 'success');
        }catch(err){
          setStatus('Falha ao atualizar endereço: ' + (err && err.message ? err.message : String(err)), 'error');
        }
      });

      passwordForm?.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        try{
          const client = getClient();
          if(!client) throw new Error('Supabase indisponível.');
          const fd = new FormData(passwordForm);
          const np = String(fd.get('new_password') || '');
          const npc = String(fd.get('new_password_confirm') || '');
          if(np.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
          if(np !== npc) throw new Error('A confirmação de senha não confere.');
          const upd = await client.auth.updateUser({ password: np });
          if(upd && upd.error) throw upd.error;
          passwordForm.reset();
          setStatus('Senha atualizada com sucesso.', 'success');
        }catch(err){
          setStatus('Falha ao atualizar senha: ' + (err && err.message ? err.message : String(err)), 'error');
        }
      });
    }

    switchTab('address');
    modal.classList.add('visible');
  }

  function ensureAuthHolder(){
    let holder = document.getElementById('customer-auth-holder');
    if(holder) return holder;

    const topRow = document.querySelector('header.top .top-row');
    if(!topRow) return null;

    holder = document.createElement('div');
    holder.id = 'customer-auth-holder';

    const cartBtn = topRow.querySelector('#cart-btn');
    if(cartBtn && cartBtn.parentNode === topRow){
      topRow.insertBefore(holder, cartBtn);
    } else {
      topRow.appendChild(holder);
    }

    return holder;
  }

  function updateAuthUi(){
    const holder = ensureAuthHolder();
    if(!holder) return;
    if(currentUser){
      const name = escapeHtml((currentUser.user_metadata && currentUser.user_metadata.full_name) || 'Minha conta');
      holder.innerHTML = `<button type="button" id="customer-auth-btn" class="customer-auth-trigger" title="Minha conta"><span class="customer-auth-icon" aria-hidden="true">👤</span><span class="customer-auth-label">${name}</span></button>`;
      holder.querySelector('#customer-auth-btn')?.addEventListener('click', ()=>openAccountModal());
    } else {
      holder.innerHTML = '<button type="button" id="customer-auth-btn" class="customer-auth-trigger" title="Entrar"><span class="customer-auth-icon" aria-hidden="true">👤</span><span class="customer-auth-label">Entrar</span></button>';
      holder.querySelector('#customer-auth-btn')?.addEventListener('click', ()=>openModal());
    }
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await getUser();
    updateAuthUi();
    if(window.supa && typeof window.supa.onAuthStateChange === 'function'){
      try{
        window.supa.onAuthStateChange(async ()=>{ await getUser(); updateAuthUi(); });
      }catch(e){ console.warn('Auth state listener failed', e); }
    }
  });

  document.addEventListener('header:loaded', ()=>{ updateAuthUi(); });

  window.customerAuth = {
    ensureAuthenticated,
    getCurrentUser: ()=>currentUser,
    openAuthModal: openModal,
    openAccountModal
  };
})();
