"""v8: busca precisa, cabeçalho único, descrição legível no modo escuro.
Uso: python3 -I tools/tests/v8_test.py <pasta_do_site>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8791"
P=[
 {"id":1,"name":"Ração Monello Cães Adultos 15kg","group":"caes","brand":"Monello","description":"Alimento completo com frango","image":"img/logobox.png","price":120},
 {"id":2,"name":"Ração Golden Gatos Castrados","group":"gatos","brand":"Golden","description":"Contém salmão e arroz","image":"img/logobox.png","price":90},
 {"id":3,"name":"Ração Premier Cães Filhotes","group":"caes","brand":"Premier","description":"Para filhotes de raças pequenas","image":"img/logobox.png","price":150},
 {"id":4,"name":"Areia Sanitária Gatos","group":"gatos","brand":"Pipicat","image":"img/logobox.png","price":20},
]
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
ok=0; bad=0
def chk(c,m):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print("FALHOU:",m)
def page(b,theme="light",w=1280):
    pg=b.new_page(viewport={"width":w,"height":900})
    pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
    pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200, content_type="application/javascript", body="window.supabase={createClient:function(){return {from:function(){return {select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getSession:function(){return Promise.resolve({data:{session:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"))
    pg.add_init_script("localStorage.setItem('theme_v1','%s');localStorage.setItem('products',%s);"%(theme,json.dumps(json.dumps(P))))
    return pg
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    pg=page(b); pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(1500)
    sig=lambda pg: pg.evaluate("()=>{const h=document.querySelector('header.top');return h?[...h.querySelectorAll('[id]')].map(e=>e.id).sort().join(',')+'|'+h.querySelectorAll('nav a').length:''}")
    s_index=sig(pg)
    chk(pg.evaluate("document.querySelectorAll('header.top').length")==1,"um só cabeçalho na home")
    chk(pg.evaluate("document.querySelector('.skip-link').compareDocumentPosition(document.querySelector('header.top'))&4")>0,"link pular vem antes do cabeçalho")
    def res(q):
        pg.fill('#search',q); pg.wait_for_timeout(600)
        return pg.evaluate("[...document.querySelectorAll('#search-results .search-row:not(.search-all)')].map(a=>a.textContent)")
    r=res('monello'); chk(len(r)==1 and 'Monello' in r[0],f"monello -> só 1 ({r})")
    r=res('salmão'); chk(len(r)==1 and 'Golden' in r[0],f"salmão (descrição) -> Golden ({r})")
    r=res('racao gatos'); chk(len(r)==1 and 'Golden' in r[0],f"todas as palavras ({r})")
    r=res('xyzabc'); chk(r==[],"sem resultado")
    r=res('premer'); chk(len(r)==1 and 'Premier' in r[0],f"erro de digitação leve ({r})")
    pg.fill('#search','monello'); pg.press('#search','Enter'); pg.wait_for_url(re.compile(r".*products\.html\?q=monello")); pg.wait_for_timeout(1500)
    names=pg.evaluate("[...document.querySelectorAll('#product-list .product-name a')].map(a=>a.textContent)")
    chk(len(names)==1 and 'Monello' in names[0],f"lista ?q=monello ({names})")
    chk(pg.input_value('#search')=='monello',"campo de busca preenchido na lista")
    chk(sig(pg)==s_index,f"cabeçalho idêntico home/lista ({s_index} vs {sig(pg)})")
    pg.goto(f"http://localhost:{PORT}/products.html?q=racao"); pg.wait_for_timeout(1500)
    chk(pg.evaluate("document.querySelectorAll('#product-list .item').length")==3,"?q=racao -> 3 rações")
    pg.close()
    pg=page(b); pg.goto(f"http://localhost:{PORT}/product.html?id=1"); pg.wait_for_timeout(2000)
    ld=pg.evaluate("(()=>{const e=document.getElementById('ld-product');return e?JSON.parse(e.textContent):null})()")
    chk(ld and ld.get('@type')=='Product' and ld['name'].startswith('Ração Monello') and ld['offers']['priceCurrency']=='BRL',f"JSON-LD Product ({ld})")
    chk('product.html?id=1' in pg.evaluate("document.querySelector('link[rel=canonical]').href"),"canonical do produto")
    pg.close()
    # descrição legível no escuro
    pg=page(b,"dark",390); pg.goto(f"http://localhost:{PORT}/product.html?id=1"); pg.wait_for_timeout(2000)
    ratio=pg.evaluate("""()=>{const e=document.querySelector('.description');if(!e)return -1;
      const L=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2])};
      const pc=s=>s.match(/[\\d.]+/g).map(Number);
      let n=e,bg=[20,17,13];while(n){const c=pc(getComputedStyle(n).backgroundColor);if(c.length<4||c[3]>0.9){bg=c.slice(0,3);break}n=n.parentElement}
      const fg=pc(getComputedStyle(e).color);const a=L(fg),b=L(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}""")
    chk(ratio>=4.5,f"descrição no escuro contraste {ratio}")
    pg.close(); b.close()
finally: srv.terminate()
print(f"{ok} ok, {bad} falhas"); sys.exit(1 if bad else 0)
