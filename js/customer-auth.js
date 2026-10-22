(function(){
  const AUTH_MODAL_ID = 'customer-auth-modal';
  const ACCOUNT_MODAL_ID = 'customer-account-modal';
  const FAVORITES_KEY_PREFIX = 'favorite_product_ids:';
  let currentUser = null;
  let resolver = null;

  function escapeHtml(s){
    if(window.appUtils && typeof window.appUtils.escapeHtml === 'function') return window.appUtils.escapeHtml(s);
    return String(s===null||s===undefined?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function userIconSvg(){
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="#ff6a00"></circle><circle cx="12" cy="8.7" r="3.6" fill="#ffffff"></circle><path d="M5.6 18.2c0-2.9 2.9-5.2 6.4-5.2s6.4 2.3 6.4 5.2v0.6H5.6z" fill="#ffffff"></path></svg>';
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
        pullFavoritesFromProfile();
      }
    }catch(e){ currentUser = null; }
    return currentUser;
  }

  function emitAuthChanged(){
    try{ document.dispatchEvent(new CustomEvent('customer-auth:changed', { detail: { user: currentUser || null } })); }catch(e){}
  }

  function favoriteStorageKeyForUser(user){
    const uid = String(user && user.id ? user.id : '').trim();
    if(!uid) return null;
    return FAVORITES_KEY_PREFIX + uid;
  }

  function readFavoriteIdsByKey(key){
    if(!key) return [];
    try{
      const raw = localStorage.getItem(key) || '[]';
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed.map(v=>String(v)).filter(Boolean);
    }catch(e){ return []; }
  }

  function writeFavoriteIdsByKey(key, ids){
    if(!key) return false;
    try{ localStorage.setItem(key, JSON.stringify(Array.isArray(ids) ? ids : [])); return true; }catch(e){ return false; }
  }

  function enhancePasswordFields(root){
    if(!root) return;
    root.querySelectorAll('input[type="password"]').forEach(function(inp){
      if(inp.dataset.pwEnhanced) return;
      inp.dataset.pwEnhanced = '1';
      var wrap = document.createElement('span');
      wrap.className = 'pw-wrap';
      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'pw-toggle';
      btn.setAttribute('aria-label', 'Mostrar senha'); btn.setAttribute('aria-pressed', 'false');
      var eye = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
      var eyeOff = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
      btn.innerHTML = eye;
      btn.addEventListener('click', function(){
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.innerHTML = show ? eyeOff : eye;
        btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
        btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      });
      wrap.appendChild(btn);
    });
  }

  function ensureModal(){
    let modal = document.getElementById(AUTH_MODAL_ID);
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = AUTH_MODAL_ID;
    modal.className = 'modal customer-auth-modal';
    modal.innerHTML = `
      <div class="modal-body customer-auth-card">
        <div class="auth-brand">
          <img src="/img/logobox.png" alt="" class="auth-logo" width="44" height="44">
          <div>
            <h2 class="customer-auth-title" id="customer-auth-title">Entrar para finalizar a compra</h2>
            <p class="customer-auth-subtitle" id="customer-auth-subtitle">Cadastre-se uma vez e, nas próximas compras, é só entrar.</p>
          </div>
        </div>

        <div class="customer-auth-tabs" role="group" aria-label="Escolha entrar ou cadastrar">
          <button type="button" class="btn customer-auth-tab active" data-tab="login" aria-pressed="true">Entrar</button>
          <button type="button" class="btn customer-auth-tab" data-tab="register" aria-pressed="false">Cadastrar</button>
        </div>

        <div id="customer-auth-status" class="customer-auth-status" role="status" aria-live="polite" style="display:none"></div>

        <form id="customer-login-form" class="customer-auth-form">
          <label>E-mail
            <input type="email" name="email" required autocomplete="email" placeholder="seuemail@dominio.com">
          </label>
          <label>Senha
            <input type="password" name="password" required autocomplete="current-password" placeholder="Sua senha">
          </label>
          <button type="button" class="auth-link" data-view="forgot">Esqueci minha senha</button>
          <p class="auth-legal">Ao entrar você concorda com os <a href="/termos.html" target="_blank" rel="noopener noreferrer">Termos de Uso<span class="sr-only"> (abre em nova aba)</span></a> e a <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade<span class="sr-only"> (abre em nova aba)</span></a>.</p>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Entrar</button>
            <button type="button" class="btn customer-auth-cancel">Cancelar</button>
          </div>
        </form>

        <form id="customer-forgot-form" class="customer-auth-form hidden">
          <p class="auth-help">Informe o e-mail do seu cadastro. Enviaremos um link para você criar uma nova senha.</p>
          <label>E-mail
            <input type="email" name="email" required autocomplete="email" placeholder="seuemail@dominio.com">
          </label>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Enviar link</button>
            <button type="button" class="btn" data-view="login">Voltar</button>
          </div>
        </form>

        <form id="customer-reset-form" class="customer-auth-form hidden">
          <p class="auth-help">Crie uma nova senha para a sua conta.</p>
          <label>Nova senha
            <input type="password" name="password" required autocomplete="new-password" minlength="6" placeholder="Pelo menos 6 caracteres">
          </label>
          <label>Confirmar nova senha
            <input type="password" name="password_confirm" required autocomplete="new-password" minlength="6" placeholder="Digite novamente">
          </label>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Salvar nova senha</button>
            <button type="button" class="btn customer-auth-cancel">Cancelar</button>
          </div>
        </form>

        <form id="customer-register-form" class="customer-auth-form hidden">
          <fieldset class="auth-group">
            <legend>Seus dados</legend>
            <label>Nome completo
              <input type="text" name="full_name" required autocomplete="name" placeholder="Nome e sobrenome">
            </label>
            <label>E-mail
              <input type="email" name="email" required autocomplete="email" placeholder="seuemail@dominio.com">
            </label>
            <div class="customer-auth-grid two-cols">
              <label>Senha
                <input type="password" name="password" required autocomplete="new-password" placeholder="Crie uma senha" minlength="6">
              </label>
              <label>Confirmar senha
                <input type="password" name="password_confirm" required autocomplete="new-password" placeholder="Digite novamente" minlength="6">
              </label>
            </div>
            <div class="customer-auth-grid two-cols">
              <label>Telefone / WhatsApp
                <input type="tel" name="phone" required autocomplete="tel" placeholder="(79) 99999-9999">
              </label>
              <label>CPF/CNPJ (opcional)
                <input type="text" name="document" inputmode="numeric" placeholder="Só se quiser nota com CPF/CNPJ">
              </label>
            </div>
          </fieldset>
          <fieldset class="auth-group">
            <legend>Endereço de entrega</legend>
            <div class="customer-auth-grid two-cols">
              <label>CEP
                <input type="text" name="zip" required autocomplete="postal-code" inputmode="numeric" placeholder="49000-000">
              </label>
              <label>UF
                <input type="text" name="state" required autocomplete="address-level1" placeholder="SE" maxlength="2">
              </label>
            </div>
            <label>Rua
              <input type="text" name="street" required autocomplete="address-line1" placeholder="Nome da rua/avenida">
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
                <input type="text" name="city" required autocomplete="address-level2" placeholder="Sua cidade">
              </label>
            </div>
            <p class="auth-help">Você poderá confirmar ou alterar o endereço a cada pedido.</p>
          </fieldset>
          <label class="auth-consent"><input type="checkbox" name="accept_terms" required>
            <span>Li e concordo com a <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade<span class="sr-only"> (abre em nova aba)</span></a> e os <a href="/termos.html" target="_blank" rel="noopener noreferrer">Termos de Uso<span class="sr-only"> (abre em nova aba)</span></a>.</span></label>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Criar conta</button>
            <button type="button" class="btn customer-auth-cancel">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    enhancePasswordFields(modal);

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

    const forgotForm = modal.querySelector('#customer-forgot-form');
    const resetForm = modal.querySelector('#customer-reset-form');
    const titleEl = modal.querySelector('#customer-auth-title');
    const subEl = modal.querySelector('#customer-auth-subtitle');
    const tabsEl = modal.querySelector('.customer-auth-tabs');
    const VIEWS = {
      login:    { form: loginForm,    title: 'Entrar para finalizar a compra', sub: 'Cadastre-se uma vez e, nas próximas compras, é só entrar.', tabs: true },
      register: { form: registerForm, title: 'Criar sua conta',                sub: 'Leva um minuto. Seus dados ficam salvos para as próximas compras.', tabs: true },
      forgot:   { form: forgotForm,   title: 'Esqueci minha senha',            sub: 'Vamos enviar um link para o seu e-mail.', tabs: false },
      reset:    { form: resetForm,     title: 'Criar nova senha',               sub: 'Escolha uma senha nova para entrar.', tabs: false }
    };
    let curView = 'login';
    const ORDER = ['login', 'register', 'forgot', 'reset'];
    function showView(name){
      const v = VIEWS[name] || VIEWS.login;
      const dir = ORDER.indexOf(name) >= ORDER.indexOf(curView) ? 1 : -1;
      curView = name;
      Object.keys(VIEWS).forEach(k=>VIEWS[k].form.classList.toggle('hidden', k !== name));
      titleEl.textContent = v.title; subEl.textContent = v.sub;
      tabsEl.classList.toggle('hidden', !v.tabs);
      modal.querySelectorAll('.customer-auth-tab').forEach(b=>{
        const on = b.dataset.tab === name;
        b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      setStatus('');
      if(modal.classList.contains('visible')){ animateIn(v.form, dir); animateIn(titleEl, dir); animateIn(subEl, dir); }
      const first = v.form.querySelector('input'); if(first && modal.classList.contains('visible')) first.focus();
    }
    modal._showView = showView;
    modal.querySelectorAll('.customer-auth-tab').forEach(btn=>btn.addEventListener('click', ()=>showView(btn.dataset.tab)));
    modal.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click', ()=>showView(btn.dataset.view)));

    forgotForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = String(new FormData(forgotForm).get('email') || '').trim();
      if(!email){ setStatus('Informe o seu e-mail.', 'error'); return; }
      try{
        if(!window.supa || typeof window.supa.resetPassword !== 'function') throw new Error('Supabase Auth não configurado.');
        await window.supa.resetPassword(email);
      }catch(err){
        console.warn('Password reset request failed', err);
        const m = String((err && err.message) || '').toLowerCase();
        if(m.includes('rate') || m.includes('seconds')){ setStatus('Aguarde um minuto antes de pedir outro link.', 'error'); return; }
      }
      // mesma mensagem exista ou não o e-mail (não revela quem tem cadastro)
      setStatus('Se esse e-mail tiver cadastro, enviamos um link para criar a nova senha. Veja também a caixa de spam.', 'success');
    });

    resetForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(resetForm);
      const np = String(fd.get('password') || ''), npc = String(fd.get('password_confirm') || '');
      if(np.length < 6){ setStatus('A senha deve ter pelo menos 6 caracteres.', 'error'); return; }
      if(np !== npc){ setStatus('A confirmação de senha não confere.', 'error'); return; }
      try{
        await window.supa.updatePassword(np);
        resetForm.reset();
        currentUser = await getUser();
        setStatus('Senha alterada! Você já está conectado.', 'success');
        try{ history.replaceState(null, '', location.pathname + location.search); }catch(x){}
        setTimeout(()=>closeModal(true), 900);
      }catch(err){
        setStatus('Não foi possível alterar a senha: ' + (err && err.message ? err.message : String(err)), 'error');
      }
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
      if(!fd.get('accept_terms')){
        setStatus('Para criar a conta, marque que leu e concorda com a Política de Privacidade e os Termos de Uso.', 'error');
        return;
      }
      if(!payload.full_name || !payload.email || !payload.password || !payload.password_confirm || !payload.phone || !payload.zip || !payload.state || !payload.street || !payload.number || !payload.neighborhood || !payload.city){
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
        try{
          const signedUser = signUpRes && signUpRes.data ? signUpRes.data.user : null;
          const hasSession = !!(signUpRes && signUpRes.data && signUpRes.data.session);
          // Supabase usually returns no active session when email confirmation is required.
          if(signedUser && !signedUser.email_confirmed_at) awaitingEmailConfirmation = !hasSession;
        }catch(e){}

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
          if(awaitingEmailConfirmation){
            setStatus('Cadastro criado! Verifique seu email para confirmar a conta. Depois, faça login.', 'success');
            setTimeout(()=>closeModal(false), 1400);
            return;
          }
          setStatus('Cadastro concluído! Login ativo.', 'success');
          setTimeout(()=>closeModal(true), 350);
          return;
        }

        if(awaitingEmailConfirmation){
          setStatus('Cadastro criado! Verifique seu email para ativar a conta e depois faça login.', 'success');
          setTimeout(()=>closeModal(false), 1200);
          return;
        }

        setStatus('Cadastro concluído. Se o sistema pedir, verifique seu email antes de fazer login.', 'success');
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

  function openRecovery(){
    const modal = ensureModal();
    modal.classList.add('visible');
    if(modal._showView) modal._showView('reset');
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
    return readFavoriteIdsByKey(favoriteStorageKeyForUser(currentUser));
  }

  function isFavorite(productId){
    const pid = String(productId || '').trim();
    if(!pid) return false;
    return getFavoriteIds().includes(pid);
  }

  function setFavorite(productId, active){
    const key = favoriteStorageKeyForUser(currentUser);
    if(!key) return false;
    const pid = String(productId || '').trim();
    if(!pid) return false;
    const ids = readFavoriteIdsByKey(key);
    const next = active ? Array.from(new Set(ids.concat(pid))) : ids.filter(id=>id !== pid);
    const ok = writeFavoriteIdsByKey(key, next);
    if(ok) pushFavoritesToProfile(next);
    return ok;
  }

  // Favoritos também ficam na conta (user_metadata): aparecem em qualquer aparelho em que o cliente entrar.
  function pullFavoritesFromProfile(){
    try{
      const md = (currentUser && currentUser.user_metadata) || {};
      const key = favoriteStorageKeyForUser(currentUser);
      if(key && Array.isArray(md.favorites)) writeFavoriteIdsByKey(key, md.favorites.map(String).slice(0, 200));
    }catch(e){}
  }
  let favPushTimer = null;
  function pushFavoritesToProfile(ids){
    clearTimeout(favPushTimer);
    favPushTimer = setTimeout(async function(){
      try{
        const client = getClient();
        if(!client || !currentUser) return;
        const md = currentUser.user_metadata || {};
        const upd = await client.auth.updateUser({ data: { ...md, favorites: ids.slice(0, 200) } });
        if(upd && upd.data && upd.data.user) currentUser = upd.data.user;
      }catch(e){}
    }, 800);
  }

  function toggleFavorite(productId){
    const next = !isFavorite(productId);
    const ok = setFavorite(productId, next);
    return ok ? next : null;
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

  async function saveAddress(addr){
    const client = getClient();
    if(!client || !currentUser) throw new Error('Usuário não autenticado.');
    const md = currentUser.user_metadata || {};
    const payload = {
      street: String(addr.street || '').trim(), number: String(addr.number || '').trim(),
      neighborhood: String(addr.neighborhood || '').trim(), zip: String(addr.zip || '').trim(),
      complement: md.complement || '', city: md.city || '', state: md.state || ''
    };
    const upd = await client.auth.updateUser({ data: { ...md, ...payload } });
    if(upd && upd.error) throw upd.error;
    await upsertAddressInProfile(client, currentUser, payload);
    await getUser();
    emitAuthChanged();
  }

  // ---------- Livro de endereços (até 5), guardado na conta do cliente ----------
  const MAX_ADDRESSES = 5;
  function cleanAddr(a){
    const t = (v, n)=> String(v == null ? '' : v).trim().slice(0, n || 120);
    return {
      id: t(a.id, 40) || ('a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
      label: t(a.label, 30) || 'Endereço',
      street: t(a.street), number: t(a.number, 20), complement: t(a.complement, 60),
      neighborhood: t(a.neighborhood, 80), city: t(a.city, 80), state: t(a.state, 2).toUpperCase(),
      zip: t(a.zip, 12), reference: t(a.reference, 120)
    };
  }
  function getAddresses(){
    const md = (currentUser && currentUser.user_metadata) || {};
    let list = Array.isArray(md.addresses) ? md.addresses.map(cleanAddr) : [];
    if(!list.length && md.street){
      list = [cleanAddr({ id: 'principal', label: 'Principal', street: md.street, number: md.number, complement: md.complement, neighborhood: md.neighborhood, city: md.city, state: md.state, zip: md.zip })];
    }
    return list;
  }
  function getDefaultAddressId(){
    const md = (currentUser && currentUser.user_metadata) || {};
    const list = getAddresses();
    if(md.default_address_id && list.some(a=>a.id === md.default_address_id)) return md.default_address_id;
    return list.length ? list[0].id : '';
  }
  async function saveAddressBook(list, defaultId){
    const client = getClient();
    if(!client || !currentUser) throw new Error('Usuário não autenticado.');
    const clean = list.map(cleanAddr).slice(0, MAX_ADDRESSES);
    const def = clean.find(a=>a.id === defaultId) || clean[0] || null;
    const md = currentUser.user_metadata || {};
    const data = { ...md, addresses: clean, default_address_id: def ? def.id : '' };
    // mantém os campos antigos com o endereço padrão (o texto do WhatsApp e o perfil usam eles)
    ['street','number','complement','neighborhood','city','state','zip'].forEach(k=>{ data[k] = def ? def[k] : ''; });
    const upd = await client.auth.updateUser({ data });
    if(upd && upd.error) throw upd.error;
    if(def) await upsertAddressInProfile(client, currentUser, def);
    await getUser();
    emitAuthChanged();
    return clean;
  }
  async function addOrUpdateAddress(addr, makeDefault){
    const list = getAddresses();
    const a = cleanAddr(addr);
    const same = list.findIndex(x=>x.id === a.id || (x.street.toLowerCase() === a.street.toLowerCase() && x.number === a.number && x.zip === a.zip));
    if(same >= 0){ a.id = list[same].id; list[same] = { ...list[same], ...a }; }
    else {
      if(list.length >= MAX_ADDRESSES) throw new Error('Você já tem ' + MAX_ADDRESSES + ' endereços salvos. Exclua um para salvar outro.');
      list.push(a);
    }
    const defId = (makeDefault || !list.length || list.length === 1) ? a.id : getDefaultAddressId();
    return saveAddressBook(list, defId);
  }
  async function removeAddress(id){
    const list = getAddresses().filter(a=>a.id !== id);
    return saveAddressBook(list, getDefaultAddressId() === id ? '' : getDefaultAddressId());
  }

  // ---------- Histórico de compras ----------
  async function fetchOrders(limit){
    const client = getClient();
    if(!client || !currentUser) return [];
    const cols = 'order_number,created_at,status,total,payment,items,public_token';
    let r = await client.from('customer_orders').select(cols).eq('customer_id', currentUser.id).order('created_at', { ascending: false }).limit(limit || 20);
    if(r && r.error){
      r = await client.from('customer_orders').select('order_number,created_at,status,total,payment,items').eq('customer_id', currentUser.id).order('created_at', { ascending: false }).limit(limit || 20);
    }
    if(r && r.error) throw r.error;
    return (r && r.data) || [];
  }

  // transição suave ao trocar de aba/tela (respeita "reduzir movimento")
  function animateIn(el, dir){
    if(!el) return;
    try{
      if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.classList.remove('view-in'); void el.offsetWidth;
      el.style.setProperty('--dx', ((dir || 1) * 22) + 'px');
      el.classList.add('view-in');
    }catch(e){}
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
          <button type="button" class="btn customer-auth-tab active" data-account-tab="address">Endereços</button>
          <button type="button" class="btn customer-auth-tab" data-account-tab="orders">Meus pedidos</button>
          <button type="button" class="btn customer-auth-tab" data-account-tab="favorites">Favoritos</button>
          <button type="button" class="btn customer-auth-tab" data-account-tab="password">Senha</button>
        </div>

        <div id="customer-address-list" class="addr-list" aria-live="polite"></div>

        <form id="customer-account-address" class="customer-auth-form">
          <h4 id="addr-form-title" class="addr-form-title">Novo endereço</h4>
          <input type="hidden" name="id" value="">
          <label>Nome do endereço
            <input type="text" name="label" maxlength="30" placeholder="Ex.: Casa, Trabalho, Mãe">
          </label>
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
          <label class="addr-default-row"><input type="checkbox" name="make_default"> Usar como endereço padrão</label>
          <div class="customer-auth-actions">
            <button type="submit" class="btn btn-orange">Salvar endereço</button>
            <button type="button" id="addr-cancel" class="btn hidden">Cancelar edição</button>
          </div>
        </form>

        <div id="customer-account-orders" class="customer-auth-form hidden">
          <div id="customer-orders-list" class="orders-list"></div>
        </div>

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
    const ordersPane = modal.querySelector('#customer-account-orders');
    const ordersList = modal.querySelector('#customer-orders-list');
    const addrList = modal.querySelector('#customer-address-list');
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
    function fillForm(a){
      a = a || {};
      set('id', a.id); set('label', a.label); set('phone', md.phone);
      set('zip', a.zip); set('street', a.street); set('number', a.number); set('complement', a.complement);
      set('neighborhood', a.neighborhood); set('city', a.city); set('state', a.state);
      const cb = addressForm.querySelector('[name="make_default"]'); if(cb) cb.checked = false;
      const t = modal.querySelector('#addr-form-title'); if(t) t.textContent = a.id ? 'Editar endereço' : 'Novo endereço';
      const c = modal.querySelector('#addr-cancel'); if(c) c.classList.toggle('hidden', !a.id);
    }
    function renderAddrList(){
      const list = getAddresses(); const def = getDefaultAddressId();
      if(!list.length){ addrList.innerHTML = '<p class="addr-empty">Você ainda não salvou nenhum endereço. Preencha abaixo.</p>'; return; }
      addrList.innerHTML = list.map(a=>`
        <div class="addr-card${a.id === def ? ' is-default' : ''}" data-addr="${escapeHtml(a.id)}">
          <div class="addr-card-main">
            <strong>${escapeHtml(a.label)}</strong>${a.id === def ? '<span class="addr-badge">Padrão</span>' : ''}
            <p>${escapeHtml([a.street + (a.number ? ', ' + a.number : ''), a.complement, a.neighborhood, [a.city, a.state].filter(Boolean).join('/'), a.zip ? 'CEP ' + a.zip : ''].filter(Boolean).join(' - '))}</p>
          </div>
          <div class="addr-card-actions">
            ${a.id === def ? '' : `<button type="button" class="btn" data-addr-act="default" data-id="${escapeHtml(a.id)}">Usar como padrão</button>`}
            <button type="button" class="btn" data-addr-act="edit" data-id="${escapeHtml(a.id)}">Editar</button>
            <button type="button" class="btn" data-addr-act="remove" data-id="${escapeHtml(a.id)}">Excluir</button>
          </div>
        </div>`).join('');
    }
    fillForm({});
    renderAddrList();

    const TAB_ORDER = ['address', 'orders', 'favorites', 'password'];
    let curTab = '';
    function switchTab(tab){
      const dir = (curTab && TAB_ORDER.indexOf(tab) < TAB_ORDER.indexOf(curTab)) ? -1 : 1;
      const first = !curTab; curTab = tab;
      modal.querySelectorAll('[data-account-tab]').forEach(btn=>btn.classList.toggle('active', btn.dataset.accountTab === tab));
      addressForm.classList.toggle('hidden', tab !== 'address');
      passwordForm.classList.toggle('hidden', tab !== 'password');
      favoritesPane.classList.toggle('hidden', tab !== 'favorites');
      ordersPane.classList.toggle('hidden', tab !== 'orders');
      addrList.classList.toggle('hidden', tab !== 'address');
      setStatus('');
      if(tab === 'orders') loadOrders();
      if(!first){
        if(tab === 'address'){ animateIn(addrList, dir); animateIn(addressForm, dir); }
        else animateIn(tab === 'orders' ? ordersPane : tab === 'favorites' ? favoritesPane : passwordForm, dir);
      }
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
              <div class="customer-fav-image-wrap"><img src="${window.appUtils.safeImageUrl(image)}" alt="${escapeHtml(p.name || 'Produto')}"></div>
              ${chips}
              <div class="customer-fav-name">${escapeHtml(p.name || 'Produto')}</div>
              <div class="customer-fav-price">R$ ${firstPrice.toFixed(2)}</div>
            </a>
          `;
        }).filter(Boolean).join('');
        favoritesList.innerHTML = cards || '<div class="customer-fav-empty">Nenhum favorito disponível no cache atual.</div>';
      }
    }

    const STATUS_LABEL = { pending: 'Recebido', preparing: 'Em preparo', delivering: 'A caminho', delivered: 'Entregue', processed: 'Processado', cancelled: 'Cancelado', canceled: 'Cancelado' };
    async function loadOrders(){
      ordersList.innerHTML = '<p class="addr-empty">Carregando seus pedidos...</p>';
      try{
        const rows = await fetchOrders(20);
        if(!rows.length){ ordersList.innerHTML = '<p class="addr-empty">Você ainda não fez nenhum pedido por aqui.</p>'; return; }
        ordersList.innerHTML = rows.map((o, idx)=>{
          const items = Array.isArray(o.items) ? o.items : [];
          const dt = o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '';
          const link = o.public_token ? `<a class="btn" target="_blank" rel="noopener noreferrer" href="/comanda.html?c=${encodeURIComponent(o.public_token)}">Ver comanda<span class="sr-only"> do pedido ${escapeHtml(String(o.order_number))} (abre em nova aba)</span></a>` : '';
          return `<article class="order-card">
            <header><strong>Pedido ${escapeHtml(String(o.order_number))}</strong><span>${escapeHtml(dt)}</span><span class="order-status">${escapeHtml(STATUS_LABEL[o.status] || o.status || '')}</span></header>
            <ul>${items.slice(0, 8).map(i=>`<li>${escapeHtml(String(i.qty || 1))}x ${escapeHtml(String(i.name || 'Produto'))}</li>`).join('')}${items.length > 8 ? `<li>+ ${items.length - 8} itens</li>` : ''}</ul>
            <footer><strong>R$ ${Number(o.total || 0).toFixed(2).replace('.', ',')}</strong>
              <button type="button" class="btn btn-orange" data-reorder="${idx}">Comprar de novo<span class="sr-only"> o pedido ${escapeHtml(String(o.order_number))}</span></button>${link}</footer>
          </article>`;
        }).join('');
        ordersList._rows = rows;
      }catch(err){
        ordersList.innerHTML = '<p class="addr-empty">Não consegui carregar seus pedidos agora. Tente de novo em instantes.</p>';
      }
    }
    if(!modal.dataset.bound2){
      modal.dataset.bound2 = '1';
      ordersList.addEventListener('click', function(e){
        const b = e.target.closest && e.target.closest('[data-reorder]'); if(!b) return;
        const o = (ordersList._rows || [])[Number(b.dataset.reorder)]; if(!o) return;
        (o.items || []).forEach(i=>{
          if(i.productId == null) return;
          for(let k = 0; k < Math.min(99, Number(i.qty) || 1); k++) document.dispatchEvent(new CustomEvent('add-to-cart', { detail: { id: i.productId, variantIndex: i.variantIndex == null ? null : i.variantIndex } }));
        });
        modal.classList.remove('visible');
        if(window.appA11y) window.appA11y.announce('Itens do pedido adicionados ao carrinho.');
        const cb = document.getElementById('cart-btn'); if(cb) cb.click();
      });
      addrList.addEventListener('click', async function(e){
        const b = e.target.closest && e.target.closest('[data-addr-act]'); if(!b) return;
        const id = b.dataset.id, act = b.dataset.addrAct;
        try{
          if(act === 'edit'){ fillForm(getAddresses().find(a=>a.id === id) || {}); addressForm.scrollIntoView({ block: 'nearest' }); const f = addressForm.querySelector('[name="label"]'); if(f) f.focus(); }
          else if(act === 'default'){ await saveAddressBook(getAddresses(), id); renderAddrList(); setStatus('Endereço padrão atualizado.', 'success'); }
          else if(act === 'remove'){ if(!window.confirm('Excluir este endereço?')) return; await removeAddress(id); fillForm({}); renderAddrList(); setStatus('Endereço excluído.', 'success'); }
        }catch(err){ setStatus('Não foi possível concluir: ' + (err && err.message ? err.message : String(err)), 'error'); }
      });
      modal.querySelector('#addr-cancel')?.addEventListener('click', function(){ fillForm({}); });
    }
    modal._refreshAddr = function(){ fillForm({}); renderAddrList(); };

    if(!modal.dataset.bound){
      modal.dataset.bound = '1';
      modal.querySelectorAll('[data-account-tab]').forEach(btn=>btn.addEventListener('click', ()=>switchTab(btn.dataset.accountTab)));
      modal.querySelector('#customer-account-close')?.addEventListener('click', ()=>modal.classList.remove('visible'));
      modal.querySelector('#customer-account-logout')?.addEventListener('click', async ()=>{
        try{ if(window.supa && typeof window.supa.signOut === 'function') await window.supa.signOut(); }catch(e){}
        currentUser = null;
        emitAuthChanged();
        modal.classList.remove('visible');
        updateAuthUi();
      });

      addressForm?.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        try{
          const client = getClient();
          if(!client || !currentUser) throw new Error('Usuário não autenticado.');
          const fd = new FormData(addressForm);
          const g = (k)=> String(fd.get(k) || '').trim();
          if(!g('street') || !g('number') || !g('neighborhood')) throw new Error('Informe rua, número e bairro.');
          const phone = g('phone');
          const curMd = currentUser.user_metadata || {};
          if(phone && phone !== (curMd.phone || '')){
            const u1 = await client.auth.updateUser({ data: { ...curMd, phone } });
            if(u1 && u1.error) throw u1.error;
            await getUser();
          }
          const hadAny = getAddresses().length > 0;
          await addOrUpdateAddress({
            id: g('id'), label: g('label') || (hadAny ? 'Endereço ' + (getAddresses().length + 1) : 'Casa'),
            street: g('street'), number: g('number'), complement: g('complement'), neighborhood: g('neighborhood'),
            city: g('city'), state: g('state'), zip: g('zip')
          }, !!fd.get('make_default'));
          const m2 = (currentUser && currentUser.user_metadata) || {};
          if(modal._refreshAddr) modal._refreshAddr();
          setStatus('Endereço salvo com sucesso.', 'success');
        }catch(err){
          setStatus('Falha ao salvar endereço: ' + (err && err.message ? err.message : String(err)), 'error');
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

    enhancePasswordFields(modal);
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
      holder.innerHTML = `<button type="button" id="customer-auth-btn" class="customer-auth-trigger" title="Minha conta"><span class="customer-auth-icon" aria-hidden="true">${userIconSvg()}</span><span class="customer-auth-label">${name}</span></button>`;
      holder.querySelector('#customer-auth-btn')?.addEventListener('click', ()=>openAccountModal());
    } else {
      holder.innerHTML = `<button type="button" id="customer-auth-btn" class="customer-auth-trigger" title="Entrar"><span class="customer-auth-icon" aria-hidden="true">${userIconSvg()}</span><span class="customer-auth-label">Entrar</span></button>`;
      holder.querySelector('#customer-auth-btn')?.addEventListener('click', ()=>openModal());
    }
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await getUser();
    emitAuthChanged();
    updateAuthUi();
    if(window.supa && typeof window.supa.onAuthStateChange === 'function'){
      try{
        window.supa.onAuthStateChange(async (event)=>{
          await getUser(); emitAuthChanged(); updateAuthUi();
          if(event === 'PASSWORD_RECOVERY') openRecovery();
        });
      }catch(e){ console.warn('Auth state listener failed', e); }
    }
  });

  document.addEventListener('header:loaded', ()=>{ updateAuthUi(); });

  window.customerAuth = {
    ensureAuthenticated,
    getCurrentUser: ()=>currentUser,
    openAuthModal: openModal,
    openAccountModal,
    saveAddress,
    getAddresses,
    getDefaultAddressId,
    addOrUpdateAddress,
    removeAddress,
    saveAddressBook,
    fetchOrders,
    getFavoriteIds,
    isFavorite,
    setFavorite,
    toggleFavorite
  };
})();
