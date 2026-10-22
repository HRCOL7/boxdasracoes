"""Páginas legais, rodapé e consentimento. Uso: python3 -I legal_test.py <pasta>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8851"
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
res=[]
def check(n,ok,d=""):
    res.append(bool(ok)); print(("PASS " if ok else "FAIL ")+n+(" "+str(d) if (d and not ok) else ""))
STUB="window.supabase={createClient:function(){return {from:function(){return {select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getUser:function(){return Promise.resolve({data:{user:null}})},getSession:function(){return Promise.resolve({data:{session:null}})},signUp:function(){window.__signup=1;return Promise.resolve({data:{},error:null})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def page(w=1200):
        pg=b.new_page(viewport={"width":w,"height":900}); pg._e=[]; pg.on('pageerror',lambda e:pg._e.append(str(e)[:150]))
        pg.route("**/*",lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
        pg.route(re.compile(r".*supabase-js.*"),lambda r:r.fulfill(status=200,content_type="application/javascript",body=STUB))
        pg.add_init_script("localStorage.setItem('consent_v1',JSON.stringify({v:1,necessary:true}));")
        return pg
    for f,h in [("privacidade.html","Política de Privacidade"),("termos.html","Termos de Uso"),("cookies.html","Política de Cookies"),("trocas-e-reembolso.html","Política de Trocas e Reembolso")]:
        pg=page(); pg.goto(f"http://localhost:{PORT}/{f}",wait_until="domcontentloaded"); pg.wait_for_timeout(1200)
        check(f"{f}: título e conteúdo", h in pg.inner_text("h1") and len(pg.inner_text("article"))>800)
        check(f"{f}: rodapé com os 4 links legais", pg.locator(".ft-legal a").count()==4)
        check(f"{f}: campos vazios viram aviso 'a preencher'", pg.locator("mark.pending").count()>0)
        check(f"{f}: sem erros de JS", not pg._e, pg._e)
        pg.close()
    for f in ["index.html","products.html","product.html"]:
        pg=page(); pg.goto(f"http://localhost:{PORT}/{f}",wait_until="domcontentloaded"); pg.wait_for_timeout(1500)
        check(f"{f}: rodapé legal presente", pg.locator(".site-footer .ft-legal a").count()==4)
        check(f"{f}: sem placeholders no rodapé", "[endereço" not in pg.inner_text(".site-footer"))
        pg.close()
    pg=page(); pg.goto(f"http://localhost:{PORT}/index.html",wait_until="domcontentloaded"); pg.wait_for_timeout(1500)
    pg.evaluate("void window.customerAuth.ensureAuthenticated()"); pg.wait_for_timeout(300)
    pg.click('[data-tab=register]'); pg.wait_for_timeout(200)
    check("cadastro: caixa de consentimento obrigatória com links", pg.locator("#customer-register-form .auth-consent input[required]").count()==1 and pg.locator("#customer-register-form .auth-consent a[href='/privacidade.html']").count()==1)
    check("cadastro: CPF não é mais obrigatório", pg.locator("#customer-register-form [name=document][required]").count()==0)
    pg.close(); b.close()
finally: srv.terminate()
print(f"\n{sum(res)}/{len(res)} passaram")
