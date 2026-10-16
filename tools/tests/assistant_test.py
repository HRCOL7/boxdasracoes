"""Testa o assistente. Uso: python3 -I assistant_test.py <pasta_do_site>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8771"
PRODUCTS=[{"id":101,"name":"Ração Premium Cães 15kg","group":"caes","brand":"Marca A","variants":[{"weight":"15kg","price":212}],"price":212}]
res=[]
def check(n,ok): res.append((n,bool(ok))); print(("PASS " if ok else "FAIL ")+n)
SUPA="window.supabase={createClient:function(){return {from:function(){return {select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getUser:function(){return Promise.resolve({data:{user:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}},getSession:function(){return Promise.resolve({data:{session:null}})}},channel:function(){return {on:function(){return this},subscribe:function(){return this}}},removeChannel:function(){}}}};"
CORS={"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"*"}
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
def newpage(b, ai):
    pg=b.new_page(viewport={"width":1280,"height":800})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
    pg.errs=errs; pg.calls=[]
    pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") and "functions/v1/assistant" not in r.request.url and "rest/v1" not in r.request.url and "supabase-js" not in r.request.url else r.fallback())
    pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200, content_type="application/javascript", body=SUPA))
    pg.route("**/rest/v1/products*", lambda r: r.fulfill(status=204, headers=CORS) if r.request.method=="OPTIONS" else r.fulfill(status=200, content_type="application/json", headers=CORS, body=json.dumps(PRODUCTS)))
    def api(route):
        if route.request.method=="OPTIONS": return route.fulfill(status=204, headers=CORS)
        body=json.loads(route.request.post_data); pg.calls.append(body)
        status,payload=ai(body,len(pg.calls))
        route.fulfill(status=status, content_type="application/json", headers=CORS, body=json.dumps(payload))
    pg.route("**/functions/v1/assistant", api)
    pg.add_init_script("localStorage.setItem('products', %s);" % json.dumps(json.dumps(PRODUCTS)))
    return pg
def ask(pg, text):
    pg.fill("#assistant-input", text); pg.keyboard.press("Enter"); pg.wait_for_timeout(900)
def botmsgs(pg): return pg.eval_on_selector_all(".as-msg.bot","els=>els.map(e=>e.textContent)")
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    # 1) abrir/fechar com teclado
    pg=newpage(b, lambda body,n:(404,{}))
    pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(800)
    check("botão do assistente existe e tem nome", pg.locator(".as-launcher").count()==1)
    pg.focus(".as-launcher"); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    check("abre o painel (role=dialog) e foca o campo", pg.evaluate("document.activeElement.id")=="assistant-input" and pg.get_attribute("#assistant-panel","role")=="dialog")
    check("aria-expanded=true no lançador", pg.get_attribute(".as-launcher","aria-expanded")=="true")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Esc fecha e devolve o foco ao lançador", not pg.is_visible("#assistant-panel") and pg.evaluate("document.activeElement.className").startswith("as-launcher"))
    pg.click(".as-launcher"); pg.click("summary"); pg.click("[data-pref=font][data-value=xl]")
    check("botão de preferência aplica fonte maior", pg.evaluate("document.documentElement.dataset.a11yFont")=="xl" and pg.get_attribute("[data-pref=font][data-value=xl]","aria-pressed")=="true")
    # 2) sem IA (servidor 404): regras locais
    ask(pg,"ativar alto contraste")
    check("modo simples: alto contraste aplicado", pg.evaluate("document.documentElement.dataset.a11yContrast")=="high")
    check("avisa que a IA está indisponível", any("modo simples" in m for m in botmsgs(pg)))
    n=len(pg.calls); ask(pg,"abrir carrinho")
    check("não insiste na IA depois de falhar", len(pg.calls)==n and pg.is_visible("#cart-panel"))
    ask(pg,"buscar racao")
    check("busca local lista produto com link", pg.locator(".as-msg.bot a[href*='product.html?id=101']").count()>=1)
    ask(pg,"restaurar padrão")
    check("restaurar volta ao padrão", pg.evaluate("document.documentElement.dataset.a11yFont")=="normal" and pg.evaluate("document.documentElement.dataset.a11yContrast")=="normal")
    check("sem erros de JS (modo simples)", not pg.errs)
    # 3) com IA simulada: ferramenta + resposta; HTML injetado não vira elemento
    def ai(body,n):
        last=body["messages"][-1]
        if n==1: return 200,{"content":[{"type":"text","text":"Vou ajustar."},{"type":"tool_use","id":"tu1","name":"set_preference","input":{"name":"font","value":"lg"}}],"stop_reason":"tool_use"}
        if n==2: return 200,{"content":[{"type":"text","text":"Pronto <img src=x onerror=window.__pwn=1> letra maior."}],"stop_reason":"end_turn"}
        return 200,{"content":[{"type":"text","text":"ok"}]}
    pg2=newpage(b, ai); pg2.goto(f"http://localhost:{PORT}/index.html"); pg2.wait_for_timeout(800)
    pg2.click(".as-launcher"); ask(pg2,"letra maior por favor"); pg2.wait_for_timeout(500)
    check("IA: duas chamadas (ferramenta e resposta)", len(pg2.calls)==2)
    last=pg2.calls[1]["messages"][-1]
    check("IA: tool_result enviado de volta", isinstance(last["content"],list) and last["content"][0]["type"]=="tool_result" and last["content"][0]["tool_use_id"]=="tu1")
    check("IA: preferência aplicada pela ferramenta", pg2.evaluate("document.documentElement.dataset.a11yFont")=="lg")
    check("IA: HTML na resposta é texto (sem <img> injetado)", pg2.locator(".as-msg img").count()==0 and pg2.evaluate("window.__pwn")is None)
    check("IA: não manda page com dados sensíveis (só path/título)", set(pg2.calls[0]["page"].keys())=={"path","title"})
    check("IA: resposta final aparece", any("letra maior" in m for m in botmsgs(pg2)))
    # 4) persistência entre páginas
    pg2.goto(f"http://localhost:{PORT}/products.html"); pg2.wait_for_timeout(1200)
    check("conversa e painel persistem ao mudar de página", pg2.is_visible("#assistant-panel") and any("letra maior" in m for m in botmsgs(pg2)))
    check("preferência persiste ao mudar de página", pg2.evaluate("document.documentElement.dataset.a11yFont")=="lg")
    # 5) navegação por ferramenta só para destinos permitidos
    def ai3(body,n):
        if n==1: return 200,{"content":[{"type":"tool_use","id":"t9","name":"navigate","input":{"destination":"https://evil.example"}}]}
        return 200,{"content":[{"type":"text","text":"não deu"}]}
    pg3=newpage(b, ai3); pg3.goto(f"http://localhost:{PORT}/index.html"); pg3.wait_for_timeout(800)
    pg3.click(".as-launcher"); ask(pg3,"vai pra lá"); pg3.wait_for_timeout(800)
    check("navegação para URL externa é recusada", pg3.url.startswith(f"http://localhost:{PORT}/index.html"))
    # 6) mobile: painel cabe na tela
    pm=b.new_page(viewport={"width":360,"height":640}); pm.route("**/*", lambda r: r.abort() if "localhost" not in r.request.url else r.continue_())
    pm.goto(f"http://localhost:{PORT}/index.html"); pm.wait_for_timeout(800); pm.click(".as-launcher")
    bb=pm.eval_on_selector("#assistant-panel","e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.top,r.bottom]}")
    check("mobile: painel dentro da tela (360x640)", bb[0]>=0 and bb[1]<=360 and bb[2]>=0 and bb[3]<=640)
    b.close()
finally: srv.terminate()
f=[n for n,o in res if not o]; print(f"\n{len(res)-len(f)}/{len(res)} passaram"); sys.exit(1 if f else 0)
