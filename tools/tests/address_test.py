"""Endereço de entrega: resumo, alterar e confirmação a cada pedido. Uso: python3 -I address_test.py <pasta>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8782"
PRODUCTS=[{"id":101,"name":"Ração Teste","group":"caes","brand":"A","image":"/img/logobox.png","price":50}]
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
results=[]
def check(n,ok,d=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ")+n+(" "+str(d) if (d and not ok) else ""))
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1000,"height":900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
    pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
    pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200, content_type="application/javascript", body="window.supabase={createClient:function(){return {from:function(){return {select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getUser:function(){return Promise.resolve({data:{user:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"))
    pg.add_init_script("localStorage.setItem('products', %s);" % json.dumps(json.dumps(PRODUCTS)))
    pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{ window.customerAuth.ensureAuthenticated=async()=>true; window.open=()=>null; window.__ready=[]; document.addEventListener('checkout-ready',e=>window.__ready.push(e.detail)); document.dispatchEvent(new CustomEvent('add-to-cart',{detail:{id:101,variantIndex:null}})); }""")
    pg.wait_for_timeout(500)
    if not pg.is_visible("#cart-panel"): pg.click("#cart-btn"); pg.wait_for_timeout(400)
    pg.select_option("#payment","DINHEIRO")
    check("endereço vazio: campos abertos para preencher", pg.is_visible("#checkout-street"))
    # sem endereço -> diálogo pede o endereço, não finaliza
    pg.click("#checkout"); pg.wait_for_timeout(400)
    check("sem endereço: diálogo 'Falta o endereço' e sem botão confirmar", pg.is_visible(".address-confirm-card") and "Falta" in pg.inner_text(".ac-title") and pg.locator("[data-ac=ok]").count()==0)
    pg.click("[data-ac=edit]"); pg.wait_for_timeout(400)
    check("sem endereço: diálogo fecha e nada foi enviado", pg.locator(".address-confirm-card").count()==0 and pg.evaluate("window.__ready.length")==0)
    pg.fill("#checkout-street","Rua das Flores"); pg.fill("#checkout-number","123"); pg.fill("#checkout-neighborhood","Centro"); pg.fill("#checkout-zip","49000-000")
    pg.select_option("#delivery-window", index=1)
    check("resumo mostra o endereço digitado", "Rua das Flores, 123" in pg.inner_text("#delivery-summary"), pg.inner_text("#delivery-summary"))
    pg.click("#delivery-edit-btn"); pg.wait_for_timeout(100)
    check("'Pronto' recolhe os campos", not pg.is_visible("#checkout-street"))
    pg.click("#delivery-edit-btn"); pg.wait_for_timeout(100)
    check("'Alterar endereço' reabre os campos", pg.is_visible("#checkout-street"))
    pg.click("#checkout"); pg.wait_for_timeout(400)
    check("com endereço: diálogo mostra o endereço e pede confirmação", pg.is_visible(".address-confirm-card") and "Rua das Flores, 123" in pg.inner_text(".ac-address") and "Confirme" in pg.inner_text(".ac-title"))
    check("pedido ainda NÃO foi enviado", pg.evaluate("window.__ready.length")==0)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Esc cancela sem enviar", pg.locator(".address-confirm-card").count()==0 and pg.evaluate("window.__ready.length")==0)
    pg.click("#checkout"); pg.wait_for_timeout(300); pg.click("[data-ac=edit]"); pg.wait_for_timeout(500)
    check("'Alterar endereço' no diálogo leva ao campo Rua", pg.evaluate("document.activeElement && document.activeElement.id")=="checkout-street", pg.evaluate("document.activeElement && document.activeElement.id"))
    pg.fill("#checkout-number","456")
    pg.click("#checkout"); pg.wait_for_timeout(300)
    check("diálogo mostra o endereço alterado", "Rua das Flores, 456" in pg.inner_text(".ac-address"))
    pg.check("#ac-terms-chk"); pg.click("[data-ac=ok]"); pg.wait_for_timeout(500)
    ready=pg.evaluate("window.__ready")
    check("confirmado: pedido enviado com o endereço novo", len(ready)==1 and ready[0]["delivery"]["number"]=="456", ready)
    check("sem erros de JS", not errs, errs)
    b.close()
finally: srv.terminate()
print(f"\n{sum(results)}/{len(results)} passaram")
