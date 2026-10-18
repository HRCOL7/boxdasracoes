"""Login/cadastro: olho da senha, recuperação de senha e nova senha. Uso: python3 -I auth_test.py <pasta_do_site>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8781"
STUB = """
window.__calls=[];
window.supabase={createClient:function(){return {
  from:function(){return {select:function(){return Promise.resolve({data:[],error:null})},upsert:function(){return Promise.resolve({})},insert:function(){return Promise.resolve({})}}},
  auth:{
    getUser:function(){return Promise.resolve({data:{user:window.__user||null}})},
    getSession:function(){return Promise.resolve({data:{session:null}})},
    onAuthStateChange:function(cb){window.__authCb=cb;return {data:{subscription:{unsubscribe:function(){}}}}},
    resetPasswordForEmail:function(e,o){window.__calls.push(['reset',e,o&&o.redirectTo]);return Promise.resolve({data:{},error:null})},
    updateUser:function(a){window.__calls.push(['update',a]);return Promise.resolve({data:{user:{id:'u1'}},error:null})},
    signInWithPassword:function(a){return Promise.resolve({data:{},error:null})}
  }}}};
"""
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
results=[]
def check(n,ok,d=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ")+n+(" "+str(d) if (d and not ok) else ""))
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1000,"height":900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
    pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
    pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200, content_type="application/javascript", body=STUB))
    pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(1500)
    pg.evaluate("window.customerAuth.openAuthModal()"); pg.wait_for_timeout(300)
    check("login: campo de senha tem botão do olho", pg.locator("#customer-login-form .pw-toggle").count()==1)
    check("cadastro: 2 campos de senha com olho", pg.locator("#customer-register-form .pw-toggle").count()==2)
    t=pg.locator("#customer-login-form .pw-toggle")
    check("olho: começa oculto (aria-label Mostrar senha)", t.get_attribute("aria-label")=="Mostrar senha")
    t.click()
    check("olho: clique mostra a senha (type=text)", pg.get_attribute("#customer-login-form input[name=password]","type")=="text")
    check("olho: aria-label vira Ocultar senha e aria-pressed true", t.get_attribute("aria-label")=="Ocultar senha" and t.get_attribute("aria-pressed")=="true")
    t.click()
    check("olho: segundo clique oculta de novo", pg.get_attribute("#customer-login-form input[name=password]","type")=="password")
    pg.click("text=Esqueci minha senha"); pg.wait_for_timeout(200)
    check("esqueci: formulário aparece e abas somem", pg.is_visible("#customer-forgot-form") and not pg.is_visible(".customer-auth-tabs"))
    pg.fill("#customer-forgot-form input[name=email]","cliente@exemplo.com"); pg.click("#customer-forgot-form button[type=submit]"); pg.wait_for_timeout(300)
    calls=pg.evaluate("window.__calls")
    check("esqueci: chamou resetPasswordForEmail com o e-mail e retorno ao site", calls and calls[0][0]=="reset" and calls[0][1]=="cliente@exemplo.com" and str(calls[0][2]).endswith("/index.html"), calls)
    msg=pg.inner_text("#customer-auth-status")
    check("esqueci: mensagem genérica de sucesso", "enviamos um link" in msg, msg)
    pg.click("#customer-forgot-form [data-view=login]"); pg.wait_for_timeout(150)
    check("voltar: login visível de novo", pg.is_visible("#customer-login-form") and pg.is_visible(".customer-auth-tabs"))
    # recuperação (link do e-mail)
    pg.evaluate("window.__authCb('PASSWORD_RECOVERY',{})"); pg.wait_for_timeout(300)
    check("recuperação: abre direto em 'Criar nova senha'", pg.is_visible("#customer-reset-form") and "nova senha" in pg.inner_text("#customer-auth-title").lower())
    check("recuperação: 2 campos com olho", pg.locator("#customer-reset-form .pw-toggle").count()==2)
    pg.fill("#customer-reset-form input[name=password]","abcdef1"); pg.fill("#customer-reset-form input[name=password_confirm]","diferente")
    pg.click("#customer-reset-form button[type=submit]"); pg.wait_for_timeout(200)
    check("recuperação: confirmação diferente é recusada", "não confere" in pg.inner_text("#customer-auth-status") and not [c for c in pg.evaluate("window.__calls") if c[0]=="update"])
    pg.fill("#customer-reset-form input[name=password_confirm]","abcdef1"); pg.click("#customer-reset-form button[type=submit]"); pg.wait_for_timeout(400)
    up=[c for c in pg.evaluate("window.__calls") if c[0]=="update"]
    check("recuperação: chama updateUser com a nova senha", up and up[0][1].get("password")=="abcdef1", up)
    check("sem erros de JS", not errs, errs)
    b.close()
finally: srv.terminate()
print(f"\n{sum(results)}/{len(results)} passaram")
