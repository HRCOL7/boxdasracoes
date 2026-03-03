(function(){
  const AUTH_MODAL_ID = 'customer-auth-modal';
  let currentUser = null;
  let resolver = null;

  function escapeHtml(s){
    if(window.appUtils && typeof window.appUtils.escapeHtml === 'function') return window.appUtils.escapeHtml(s);
    return String(s===null||s===undefined?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
        const signUpRes = await client.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: { data: { full_name: payload.full_name, phone: payload.phone, document: payload.document, address: address, zip: payload.zip, state: payload.state, street: payload.street, number: payload.number, complement: payload.complement, neighborhood: payload.neighborhood, city: payload.city } }
        });
        if(signUpRes && signUpRes.error) throw signUpRes.error;

        if(window.supa && typeof window.supa.signIn === 'function'){
          await window.supa.signIn(payload.email, payload.password);
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

        setStatus('Cadastro concluído! Login ativo.', 'success');
        setTimeout(()=>closeModal(true), 350);
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

  function updateAuthUi(){
    const holder = document.getElementById('customer-auth-holder');
    if(!holder) return;
    if(currentUser){
      const name = escapeHtml((currentUser.user_metadata && currentUser.user_metadata.full_name) || currentUser.email || 'Cliente');
      holder.innerHTML = `<button type="button" id="customer-auth-btn" class="btn">${name}</button>`;
      holder.querySelector('#customer-auth-btn')?.addEventListener('click', async ()=>{
        try{ if(window.supa && typeof window.supa.signOut === 'function') await window.supa.signOut(); }catch(e){}
        currentUser = null;
        updateAuthUi();
      });
    } else {
      holder.innerHTML = '<button type="button" id="customer-auth-btn" class="btn">Entrar</button>';
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

  window.customerAuth = {
    ensureAuthenticated,
    getCurrentUser: ()=>currentUser,
    openAuthModal: openModal
  };
})();
