"""Cookies: faixa, preferências, bloqueio da análise sem permissão. Uso: python3 -I tools/tests/consent_test.py <site>"""
import sys, subprocess, time, re, json
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8792"
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
ok=bad=0
def chk(c,m):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print("FALHOU:",m)
STUB="window.supabase={createClient:function(){return {from:function(t){window.__ins=(window.__ins||[]);return {insert:function(r){window.__ins.push(t);return Promise.resolve({error:null})},select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getSession:function(){return Promise.resolve({data:{session:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def new(w=390):
        pg=b.new_page(viewport={"width":w,"height":800})
        pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
        pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200,content_type="application/javascript",body=STUB))
        errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.errs=errs
        return pg
    U=f"http://localhost:{PORT}/index.html"
    pg=new(); pg.goto(U); pg.wait_for_timeout(1500)
    chk(pg.is_visible('.ck-banner'),"faixa aparece na 1ª visita")
    chk(not pg.evaluate("window.cookieConsent.allowed('analytics')"),"análise bloqueada por padrão")
    chk(not pg.evaluate("(window.__ins||[]).length"),"nada enviado antes de aceitar")
    chk(pg.evaluate("document.querySelector('.as-launcher').getBoundingClientRect().width")<=52,"botão de ajuda compacto no celular")
    chk(pg.evaluate("document.querySelector('.as-launcher').getBoundingClientRect().bottom")<=pg.evaluate("document.querySelector('.ck-banner').getBoundingClientRect().top")+1,"botão de ajuda não cobre a faixa")
    pg.click('.ck-banner .ck-linkbtn'); pg.wait_for_timeout(300)
    chk(pg.is_visible('.ck-modal'),"centro de preferências abre")
    chk(pg.evaluate("document.activeElement===document.querySelector('.ck-modal')"),"foco entra no diálogo")
    pg.check('#ck-sw-analytics'); pg.click('text=Salvar minhas escolhas'); pg.wait_for_timeout(800)
    chk(pg.evaluate("window.cookieConsent.allowed('analytics')"),"aceitou análise")
    chk(not pg.is_visible('.ck-banner'),"faixa some depois de escolher")
    chk(pg.evaluate("(window.__ins||[]).includes('site_events')"),"visita contada após aceitar")
    pg.reload(); pg.wait_for_timeout(1200)
    chk(not pg.is_visible('.ck-banner'),"escolha lembrada")
    pg.click('.ck-open-prefs'); pg.wait_for_timeout(300)
    chk(pg.evaluate("document.getElementById('ck-sw-analytics').checked"),"preferência salva aparece marcada")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    chk(not pg.is_visible('.ck-modal'),"Esc fecha")
    pg.click('.ck-open-prefs'); pg.click('text=Rejeitar não essenciais'); pg.wait_for_timeout(300)
    chk(not pg.evaluate("window.cookieConsent.allowed('analytics')") and pg.evaluate("localStorage.getItem('site_session_id')")is None,"rejeitar apaga os dados de análise")
    chk(not pg.errs,f"sem erros de JS {pg.errs}")
    pg.close()
    pg=new(); pg.goto(U); pg.wait_for_timeout(1200); pg.click('text=Só necessários'); pg.wait_for_timeout(500)
    chk(not pg.evaluate("(window.__ins||[]).length"),"só necessários: nada enviado")
    pg.close(); b.close()
finally: srv.terminate()
print(f"{ok} ok, {bad} falhas"); sys.exit(1 if bad else 0)
