(function(){
  const LOG_PREFIX = '[admin-reports]';
  const logWarn = (message, ...args) => console.warn(`${LOG_PREFIX} ${message}`, ...args);

  function normalizeEmail(email){ return String(email || '').trim().toLowerCase(); }
  function getAllowedAdminEmails(){
    const fromWindow = Array.isArray(window.ADMIN_ALLOWED_EMAILS) ? window.ADMIN_ALLOWED_EMAILS : [];
    const fromStorage = String(localStorage.getItem('admin_allowed_emails') || '')
      .split(',')
      .map(s=>normalizeEmail(s))
      .filter(Boolean);
    return Array.from(new Set(fromWindow.concat(fromStorage).map(normalizeEmail).filter(Boolean)));
  }
  function isAllowedAdminUser(user){
    const email = normalizeEmail(user && user.email ? user.email : '');
    if(!email) return false;
    return getAllowedAdminEmails().includes(email);
  }

  function setStatus(msg, type){
    const el = document.getElementById('reports-status');
    if(!el) return;
    if(!msg){ el.style.display = 'none'; el.textContent = ''; el.className = 'reports-status'; return; }
    el.style.display = 'block';
    el.textContent = msg;
    el.className = 'reports-status ' + (type || 'info');
  }

  function fmtNumber(value){ return Number(value || 0).toLocaleString('pt-BR'); }
  function fmtMoney(value){ return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDate(value, granularity){
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return String(value || '');
    if(granularity === 'month') return d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
    if(granularity === 'week'){
      const end = new Date(d.getTime());
      end.setDate(d.getDate() + 6);
      return d.toLocaleDateString('pt-BR') + ' - ' + end.toLocaleDateString('pt-BR');
    }
    return d.toLocaleDateString('pt-BR');
  }

  function parsePreset(preset){
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start;
    if(preset === '7d') start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    else if(preset === '30d') start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    else if(preset === '90d') start = new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000);
    else if(preset === 'this_month') start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    else return null;
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  function dateInputValue(date){
    if(!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getRange(){
    const preset = document.getElementById('reports-preset')?.value || '30d';
    if(preset !== 'custom'){
      return parsePreset(preset);
    }
    const startRaw = document.getElementById('reports-start')?.value || '';
    const endRaw = document.getElementById('reports-end')?.value || '';
    if(!startRaw || !endRaw) return null;
    const start = new Date(startRaw + 'T00:00:00');
    const end = new Date(endRaw + 'T23:59:59.999');
    if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }

  function setKpis(rows){
    const totals = rows.reduce((acc, row)=>{
      acc.sessions += Number(row.sessions || 0);
      acc.page_views += Number(row.page_views || 0);
      acc.product_views += Number(row.product_views || 0);
      acc.checkout_started += Number(row.checkout_started || 0);
      acc.whatsapp_opened += Number(row.whatsapp_opened || 0);
      acc.stock_whatsapp_opened += Number(row.stock_whatsapp_opened || 0);
      acc.preorders += Number(row.preorders || 0);
      acc.preorder_total += Number(row.preorder_total || 0);
      return acc;
    }, { sessions: 0, page_views: 0, product_views: 0, checkout_started: 0, whatsapp_opened: 0, stock_whatsapp_opened: 0, preorders: 0, preorder_total: 0 });

    const set = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
    set('kpi-sessions', fmtNumber(totals.sessions));
    set('kpi-pageviews', fmtNumber(totals.page_views));
    set('kpi-productviews', fmtNumber(totals.product_views));
    set('kpi-checkouts', fmtNumber(totals.checkout_started));
    set('kpi-whatsapp', fmtNumber(totals.whatsapp_opened));
    set('kpi-stock-whatsapp', fmtNumber(totals.stock_whatsapp_opened));
    set('kpi-preorders', fmtNumber(totals.preorders));
    set('kpi-value', fmtMoney(totals.preorder_total));
  }

  function renderTable(rows, granularity){
    const tbody = document.querySelector('#reports-table tbody');
    if(!tbody) return;
    if(!rows.length){
      tbody.innerHTML = '<tr><td colspan="9">Sem dados para o periodo selecionado.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(row=>`
      <tr>
        <td>${fmtDate(row.bucket, granularity)}</td>
        <td>${fmtNumber(row.sessions)}</td>
        <td>${fmtNumber(row.page_views)}</td>
        <td>${fmtNumber(row.product_views)}</td>
        <td>${fmtNumber(row.checkout_started)}</td>
        <td>${fmtNumber(row.whatsapp_opened)}</td>
        <td>${fmtNumber(row.stock_whatsapp_opened)}</td>
        <td>${fmtNumber(row.preorders)}</td>
        <td>${fmtMoney(row.preorder_total)}</td>
      </tr>
    `).join('');
  }

  function renderBars(rows, granularity){
    const root = document.getElementById('reports-timeseries');
    if(!root) return;
    if(!rows.length){ root.innerHTML = '<p>Sem dados para montar grafico.</p>'; return; }

    const max = rows.reduce((m, row)=> Math.max(m, Number(row.whatsapp_opened || 0), Number(row.preorders || 0), Number(row.checkout_started || 0)), 1);
    root.innerHTML = rows.map(row=>{
      const c = Number(row.checkout_started || 0);
      const w = Number(row.whatsapp_opened || 0);
      const p = Number(row.preorders || 0);
      const cPct = Math.max(4, Math.round((c / max) * 100));
      const wPct = Math.max(4, Math.round((w / max) * 100));
      const pPct = Math.max(4, Math.round((p / max) * 100));
      return `
        <div class="reports-bar-row">
          <div class="reports-bar-label">${fmtDate(row.bucket, granularity)}</div>
          <div class="reports-bar-group">
            <div class="reports-bar checkout" style="width:${cPct}%" title="Checkout: ${c}">Checkout ${c}</div>
            <div class="reports-bar whatsapp" style="width:${wPct}%" title="WhatsApp: ${w}">WhatsApp ${w}</div>
            <div class="reports-bar preorder" style="width:${pPct}%" title="Pre-venda: ${p}">Pre-venda ${p}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function fetchRows(){
    const granularity = document.getElementById('reports-granularity')?.value || 'day';
    const range = getRange();
    if(!range){
      setStatus('Defina um periodo valido para carregar os relatorios.', 'error');
      return [];
    }

    const client = window.supa && typeof window.supa.init === 'function' ? window.supa.init() : null;
    if(!client || !client.rpc){
      setStatus('Supabase nao inicializado.', 'error');
      return [];
    }

    setStatus('Carregando relatorios...', 'info');

    const { data, error } = await client.rpc('admin_reports_timeseries', {
      p_granularity: granularity,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString()
    });

    if(error){
      setStatus('Falha ao carregar relatorios: ' + (error.message || String(error)), 'error');
      return [];
    }

    setStatus(`Dados atualizados (${new Date().toLocaleTimeString('pt-BR')}).`, 'success');
    return Array.isArray(data) ? data : [];
  }

  async function renderReports(){
    const granularity = document.getElementById('reports-granularity')?.value || 'day';
    const rows = await fetchRows();
    setKpis(rows);
    renderBars(rows, granularity);
    renderTable(rows, granularity);
  }

  async function ensureAdminAuthenticated(showWarning){
    try{
      const user = (window.supa && typeof window.supa.getUser === 'function') ? await window.supa.getUser() : null;
      const modal = document.getElementById('admin-login');
      const allowed = !!(user && isAllowedAdminUser(user));
      if(modal){
        if(allowed) modal.classList.remove('visible');
        else modal.classList.add('visible');
      }
      if(!allowed && showWarning){
        alert('Acesso negado. Entre com um email autorizado.');
      }
      return allowed;
    }catch(e){
      logWarn('ensureAdminAuthenticated failed', e);
      return false;
    }
  }

  function bindFilters(){
    const preset = document.getElementById('reports-preset');
    const startEl = document.getElementById('reports-start');
    const endEl = document.getElementById('reports-end');

    function syncDateInputs(){
      if(!preset || !startEl || !endEl) return;
      const p = preset.value;
      const disabled = p !== 'custom';
      startEl.disabled = disabled;
      endEl.disabled = disabled;
      const range = parsePreset(p);
      if(range){
        startEl.value = dateInputValue(range.start);
        endEl.value = dateInputValue(range.end);
      }
    }

    preset?.addEventListener('change', ()=>{ syncDateInputs(); renderReports(); });
    startEl?.addEventListener('change', ()=>{ if(preset && preset.value === 'custom') renderReports(); });
    endEl?.addEventListener('change', ()=>{ if(preset && preset.value === 'custom') renderReports(); });
    document.getElementById('reports-granularity')?.addEventListener('change', renderReports);
    document.getElementById('reports-refresh')?.addEventListener('click', renderReports);

    syncDateInputs();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const close = document.getElementById('admin-close');
    close?.addEventListener('click', ()=>{ window.location.href = '../index.html'; });

    const enter = document.getElementById('admin-enter');
    enter?.addEventListener('click', async ()=>{
      const email = String(document.getElementById('admin-email')?.value || '').trim();
      const pass = String(document.getElementById('admin-pass')?.value || '');
      if(!email || !pass){
        alert('Informe email e senha.');
        return;
      }
      try{
        if(!(window.supa && typeof window.supa.signIn === 'function')) throw new Error('Supabase indisponivel.');
        await window.supa.signIn(email, pass);
        const ok = await ensureAdminAuthenticated(true);
        if(ok) await renderReports();
      }catch(err){
        alert('Falha no login: ' + (err && err.message ? err.message : String(err)));
      }
    });

    document.getElementById('reports-logout')?.addEventListener('click', async ()=>{
      try{ if(window.supa && typeof window.supa.signOut === 'function') await window.supa.signOut(); }catch(e){}
      location.reload();
    });

    if(window.supa && typeof window.supa.onAuthStateChange === 'function'){
      try{ window.supa.onAuthStateChange(async ()=>{ if(await ensureAdminAuthenticated(false)) await renderReports(); }); }catch(e){}
    }

    bindFilters();
    ensureAdminAuthenticated(false).then(ok=>{ if(ok) renderReports(); });
  });
})();
