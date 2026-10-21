"""v9: cards uniformes, filtro mobile em gaveta, tela cheia, ícones do menu, admin, comanda.
Uso: python3 -I tools/tests/v9_test.py <pasta_do_site>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8793"
P=[{"id":i,"name":n,"group":"caes","brand":"Monello","image":"img/logobox.png","images":["img/logobox.png","img/icon-192.png"],"variants":v,"price":v[0]["price"],"description":"Alimento completo"} for i,(n,v) in enumerate([
 ("Ração Monello Dog Tradicional para Cães Adultos Sabor Frango",[{"weight":"1kg","price":25},{"weight":"7kg","price":80},{"weight":"15kg","price":140}]),
 ("Ração Seven Dogs",[{"weight":"1kg","price":30}]),
 ("Ração Monello",[{"weight":"15kg","price":130}]),
 ("Ração Birbo Senior Sabor Carne e Vegetais",[{"weight":"25kg","price":170},{"weight":"10kg","price":90}]),
],1)]
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
ok=bad=0
def chk(c,m):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print("FALHOU:",m)
STUB="window.supabase={createClient:function(){return {from:function(){return {select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getSession:function(){return Promise.resolve({data:{session:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def new(w):
        pg=b.new_page(viewport={"width":w,"height":850}); pg.errs=[]
        pg.on("pageerror",lambda e:pg.errs.append(str(e)))
        pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
        pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200,content_type="application/javascript",body=STUB))
        pg.add_init_script("localStorage.setItem('consent_v1',JSON.stringify({v:1,necessary:true}));localStorage.setItem('products',%s);"%json.dumps(json.dumps(P)))
        return pg
    U=f"http://localhost:{PORT}"
    # cards uniformes (PC)
    pg=new(1400); pg.goto(U+"/products.html?animal=caes"); pg.wait_for_timeout(3000)
    w=pg.evaluate("[...document.querySelectorAll('#product-list .item')].map(e=>Math.round(e.getBoundingClientRect().width))")
    chk(len(w)==4 and max(w)-min(w)<=1,f"cards com a mesma largura {w}")
    chk(pg.evaluate("document.documentElement.scrollWidth<=innerWidth"),"sem rolagem horizontal no PC")
    pg.close()
    # filtro mobile
    pg=new(390); pg.goto(U+"/products.html?animal=caes"); pg.wait_for_timeout(3000)
    chk(pg.is_visible('#filters-open-btn'),"barra de filtros no celular")
    chk(not pg.evaluate("document.getElementById('product-filters').classList.contains('fd-open')"),"gaveta fechada no início")
    pg.click('#filters-open-btn'); pg.wait_for_timeout(500)
    chk(pg.evaluate("document.getElementById('product-filters').classList.contains('fd-open')"),"gaveta abre")
    pg.click('#product-filters input[data-group], #product-filters input[type=checkbox] >> nth=1'); pg.wait_for_timeout(600)
    chk(pg.evaluate("document.getElementById('product-filters').classList.contains('fd-open')"),"gaveta continua aberta ao filtrar")
    chk('Ver' in pg.inner_text('.fd-done'),"botão Ver N produtos")
    pg.press('#product-filters','Escape'); pg.wait_for_timeout(400)
    chk(not pg.evaluate("document.getElementById('product-filters').classList.contains('fd-open')"),"Esc fecha a gaveta")
    pg.close()
    # menu + tela cheia + comanda
    pg=new(390); pg.goto(U+"/index.html"); pg.wait_for_timeout(1500)
    pg.click('#hamburger'); pg.wait_for_timeout(500)
    chk(pg.evaluate("document.querySelector('.side-icon svg').outerHTML.includes('M12 14c-3 0-5 2-5 4')"),"menu usa o ícone da home (cães)")
    pg.close()
    pg=new(1200); pg.goto(U+"/product.html?id=1"); pg.wait_for_timeout(3000)
    pg.click('.zoom-btn'); pg.wait_for_timeout(300)
    chk(pg.is_visible('.lb .lb-img'),"tela cheia abre")
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(200)
    chk('1 / 2' not in pg.inner_text('.lb-count'),"seta troca a imagem")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    chk(pg.evaluate("!document.querySelector('.lb')"),"Esc fecha a tela cheia")
    size=pg.evaluate("""async()=>{const b=await window.comanda.build({code:'123',items:[{name:'Ração Monello Dog Tradicional para Cães Adultos Sabor Frango',qty:2,price:25,productId:1,internal:'RACAO1'},{name:'Ração Seven Dogs',qty:1,price:30,productId:2}],total:80,payment:'PIX',paymentLabel:'PIX',delivery:{street:'Rua A',number:'10',neighborhood:'Centro',zip:'49000-000',reference:'Perto da praça',date:'2026-10-22',window:'09:00-11:00'},customer:{name:'Maria',phone:'79999999999',email:'m@x.com'}});window.comanda.showDialog({code:'123'},b);return [b.size,b.type]}""")
    chk(size[1]=='image/png' and size[0]>8000,f"comanda PNG gerada {size}")
    chk(pg.is_visible('#comanda-dialog .cmd-btn'),"janela da comanda com botões")
    chk(not pg.errs,f"sem erros de JS {pg.errs}")
    pg.close()
    # admin
    pg=new(1400); pg.goto(U+"/admin/admin.html"); pg.wait_for_timeout(2000)
    chk(pg.evaluate("![...document.querySelectorAll('.admin-tools a')].some(a=>/relat/i.test(a.textContent))"),"sem botão Relatórios na direita")
    chk(pg.evaluate("document.documentElement.scrollWidth<=innerWidth"),"admin sem rolagem horizontal")
    pg.close(); b.close()
finally: srv.terminate()
print(f"{ok} ok, {bad} falhas"); sys.exit(1 if bad else 0)
