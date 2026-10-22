"""v10: kg salvo, modal, favoritos, endereços, histórico, comanda por link, galeria. Uso: python3 -I v10_test.py <pasta>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8831"
VARS=[{"weight":"1kg","price":25},{"weight":"10kg","price":110},{"weight":"15kg","price":140}]
PRODUCTS=[{"id":7,"name":"Ração Monello Teste","group":"caes","brand":"Monello","image":"/img/banner1.jpg","images":["/img/banner1.jpg","/img/banner2.jpg","/img/banner3.jpg"],"video":"/tools/tests/test.mp4","variants":VARS,"price":25},
          {"id":8,"name":"Ração Outra","group":"caes","brand":"Monello","image":"/img/banner2.jpg","variants":VARS,"price":25}]
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
results=[]
def check(n,ok,d=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ")+n+(" "+str(d) if (d and not ok) else ""))
USER={"id":"u1","email":"a@b.com","user_metadata":{"full_name":"Maria","phone":"79999","street":"Rua A","number":"1","neighborhood":"Centro","zip":"49000-000"}}
SUPA="""
window.__orders=[{order_number:130001,created_at:'2026-10-20T12:00:00Z',status:'pending',total:50,payment:'PIX',public_token:'11111111-1111-1111-1111-111111111111',items:[{productId:7,variantIndex:1,name:'Ração Monello Teste',qty:2,price:25}]}];
window.__updates=[];window.__inserts=[];
window.supabase={createClient:function(){
 var user=%s;
 function q(table){var o={select:function(){return o},eq:function(){return o},order:function(){return o},limit:function(){return Promise.resolve({data:table==='customer_orders'?window.__orders:[],error:null})},insert:function(p){window.__inserts.push(p);return {select:function(){return {single:function(){return Promise.resolve({data:{order_number:130002,public_token:'22222222-2222-2222-2222-222222222222'},error:null})}}}}},upsert:function(){return Promise.resolve({error:null})},then:function(r){r({data:[],error:null})}};return o}
 return {from:q,rpc:function(n,a){ if(n==='get_order_comanda'){return Promise.resolve({data:{order_number:130002,created_at:'2026-10-21T10:00:00Z',status:'pending',payment:'PIX',total:50,note:'Pagamento escolhido: PIX\\nEndereco: Rua A, 1, Centro\\nCEP: 49000-000\\nReferencia: Casa azul',customer_name:'Maria',customer_phone:'79999',items:[{name:'Ração Teste',qty:2,price:25,image:'https://x/y.png'}]},error:null})} return Promise.resolve({data:true,error:null})},
  auth:{getUser:function(){return Promise.resolve({data:{user:user}})},getSession:function(){return Promise.resolve({data:{session:user?{user:user}:null}})},updateUser:function(p){window.__updates.push(p);user.user_metadata=Object.assign({},p.data);return Promise.resolve({data:{user:user},error:null})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}}}}}};
""" % json.dumps(USER)
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def page(w=1300,h=900,logged=True):
        pg=b.new_page(viewport={"width":w,"height":h}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:160])); pg._errs=errs
        pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
        body=SUPA if logged else SUPA.replace("var user="+json.dumps(USER),"var user=null")
        pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200, content_type="application/javascript", body=body))
        pg.add_init_script("localStorage.setItem('consent_v1',JSON.stringify({v:1,necessary:true}));localStorage.setItem('products',%s);"%json.dumps(json.dumps(PRODUCTS)))
        return pg
    pg=page(); pg.goto(f"http://localhost:{PORT}/products.html"); pg.wait_for_timeout(1800)
    pg.click('.item:has-text("Monello Teste") .weight-chip[data-vi="2"]'); pg.wait_for_timeout(200)
    pg.goto(f"http://localhost:{PORT}/product.html?id=7"); pg.wait_for_timeout(1500)
    check("página do produto abre com o kg escolhido na lista", "15kg" in pg.inner_text("#variant-chips .variant-chip.active"), pg.inner_text("#variant-chips .variant-chip.active"))
    pg.click('#variant-chips .variant-chip:nth-child(2)'); pg.wait_for_timeout(100)
    pg.goto(f"http://localhost:{PORT}/products.html"); pg.wait_for_timeout(1800)
    check("lista volta com o kg escolhido na página do produto", "10kg" in pg.inner_text('.item:has-text("Monello Teste") .weight-chip.active'))
    check("outro produto continua no padrão", pg.locator('.item:has-text("Outra") .weight-chip.active').count()==0 or "1kg" in pg.inner_text('.item:has-text("Outra") .weight-chip.active'))
    check("coração aparece nos cards", pg.locator(".item .fav-heart").count()>=2)
    h=pg.locator('.item:has-text("Monello Teste") .fav-heart'); h.click(); pg.wait_for_timeout(400)
    check("coração marca favorito", h.get_attribute("aria-pressed")=="true")
    pg.wait_for_timeout(1200)
    check("favorito enviado ao perfil", pg.evaluate("window.__updates.some(u=>u.data&&Array.isArray(u.data.favorites)&&u.data.favorites.includes('7'))"), pg.evaluate("JSON.stringify(window.__updates)"))
    pg.reload(); pg.wait_for_timeout(1800)
    check("favorito continua marcado depois de recarregar", pg.locator('.item:has-text("Monello Teste") .fav-heart').get_attribute("aria-pressed")=="true")
    pg.evaluate("document.documentElement.setAttribute('data-theme','dark')")
    pg.evaluate("document.querySelectorAll('.weight-chip.active').forEach(c=>c.click())")
    pg.click('.item:has-text("Outra") .add-circle'); pg.wait_for_timeout(300)
    col=pg.evaluate("(()=>{const m=document.querySelector('.modal .modal-body h3'); if(!m) return null; const c=getComputedStyle(m).color, bg=getComputedStyle(m.closest('.modal-body')).backgroundColor; return [c,bg]})()")
    def lum(c):
        v=[int(x) for x in re.findall(r"\d+",c)[:3]]; f=lambda x:(x/255/12.92 if x/255<=.03928 else ((x/255+.055)/1.055)**2.4)
        return .2126*f(v[0])+.7152*f(v[1])+.0722*f(v[2])
    if col:
        l1,l2=sorted([lum(col[0]),lum(col[1])],reverse=True); ratio=(l1+.05)/(l2+.05)
        check("modal 'Qual você gostaria?' legível no escuro (contraste>=4.5)", ratio>=4.5, (col,ratio))
        pg.screenshot(path="v10-modal-dark.png")
    else: check("modal abriu", False)
    pg2=page(); pg2.goto(f"http://localhost:{PORT}/index.html"); pg2.wait_for_timeout(1800)
    pg2.evaluate("window.customerAuth.openAccountModal && window.customerAuth.openAccountModal()"); pg2.wait_for_timeout(400)
    if not pg2.is_visible("#customer-account-address"):
        pg2.evaluate("(document.querySelector('#customer-auth-holder button, #customer-auth-holder a')||{click(){}}).click()"); pg2.wait_for_timeout(500)
    check("conta abre com lista de endereços (1 migrado do cadastro)", pg2.locator(".addr-card").count()==1, pg2.locator(".addr-card").count())
    pg2.fill('#customer-account-address [name=label]',"Trabalho"); pg2.fill('#customer-account-address [name=street]',"Av. B"); pg2.fill('#customer-account-address [name=number]',"200"); pg2.fill('#customer-account-address [name=neighborhood]',"Industrial"); pg2.fill('#customer-account-address [name=zip]',"49100-000")
    pg2.click('#customer-account-address button[type=submit]'); pg2.wait_for_timeout(600)
    check("segundo endereço salvo", pg2.locator(".addr-card").count()==2, pg2.locator(".addr-card").count())
    last=pg2.evaluate("window.__updates[window.__updates.length-1].data.addresses.length")
    check("endereços gravados na conta (2)", last==2, last)
    check("padrão continua o primeiro", "Padrão" in pg2.inner_text(".addr-card.is-default"))
    pg2.click('.addr-card:nth-child(2) [data-addr-act=default]'); pg2.wait_for_timeout(500)
    check("trocar endereço padrão", "Trabalho" in pg2.inner_text(".addr-card.is-default"))
    pg2.click('[data-account-tab=orders]'); pg2.wait_for_timeout(600)
    check("histórico mostra o pedido", pg2.locator(".order-card").count()==1 and "130001" in pg2.inner_text(".order-card"))
    check("histórico tem link da comanda", pg2.locator(".order-card a[href*='comanda.html?c=']").count()==1)
    pg2.screenshot(path="v10-orders.png")
    pg2.click('[data-reorder="0"]'); pg2.wait_for_timeout(500)
    check("comprar de novo coloca itens no carrinho", pg2.evaluate("(JSON.parse(localStorage.getItem('cart')||'[]')).reduce((s,i)=>s+i.qty,0)")==2, pg2.evaluate("localStorage.getItem('cart')"))
    pg2.evaluate("document.querySelectorAll('.customer-auth-modal').forEach(m=>m.classList.remove('visible'))"); pg2.wait_for_timeout(200)
    if not pg2.is_visible("#cart-panel"): pg2.click("#cart-btn"); pg2.wait_for_timeout(400)
    pg2.click("#delivery-edit-btn"); pg2.wait_for_timeout(300)
    check("'Alterar endereço' abre campos e lista de endereços", pg2.is_visible("#checkout-street") and pg2.locator("#delivery-picker .dp-opt").count()==3, pg2.locator("#delivery-picker .dp-opt").count())
    pg2.screenshot(path="v10-cart.png")
    pg2.locator('#delivery-picker input[name=delivery-addr]').nth(0).check(); pg2.wait_for_timeout(200); v0=pg2.input_value("#checkout-street")
    pg2.locator('#delivery-picker input[name=delivery-addr]').nth(1).check(); pg2.wait_for_timeout(200); v1=pg2.input_value("#checkout-street")
    check("escolher outro endereço troca os campos", v0!=v1 and {v0,v1}=={"Av. B","Rua A"}, (v0,v1))
    check("sem erros de JS (conta)", not pg2._errs, pg2._errs)
    pg3=page(); pg3.goto(f"http://localhost:{PORT}/comanda.html?c=22222222-2222-2222-2222-222222222222"); pg3.wait_for_timeout(1200)
    txt=pg3.inner_text("#cp-body") if pg3.is_visible("#cp-body") else ""
    check("página da comanda mostra pedido, cliente, endereço e itens", all(x in txt for x in ["Maria","Rua A, 1","Casa azul","Ração Teste","R$ 50,00"]), txt[:200])
    pg3.screenshot(path="v10-comanda.png")
    pg4=page(); pg4.goto(f"http://localhost:{PORT}/comanda.html?c=abc"); pg4.wait_for_timeout(500)
    check("link inválido mostra aviso", "inválido" in pg4.inner_text("#cp-status"))
    check("comanda sem erros de JS", not pg3._errs, pg3._errs)
    pg5=page(); pg5.goto(f"http://localhost:{PORT}/index.html"); pg5.wait_for_timeout(1500)
    pg5.evaluate("window.__urls=[];window.open=(u)=>{if(u)window.__urls.push(u);return {closed:false,location:{set href(v){window.__urls.push(v)}}}};")
    pg5.evaluate("document.dispatchEvent(new CustomEvent('checkout-ready',{detail:{items:[{productId:7,name:'Ração',qty:1,price:25}],total:25,payment:'PIX',delivery:{street:'Rua A',number:'1',neighborhood:'Centro'}}}))"); pg5.wait_for_timeout(1200)
    import urllib.parse
    dec=urllib.parse.unquote(pg5.evaluate("window.__urls.join(' ')"))
    check("mensagem do WhatsApp leva o link da comanda", "/comanda.html?c=22222222-2222-2222-2222-222222222222" in dec, dec[:300])
    check("sem janela de comanda para baixar", pg5.locator(".cmd-back").count()==0)
    pg6=page(); pg6.goto(f"http://localhost:{PORT}/product.html?id=7"); pg6.wait_for_timeout(1800)
    check("miniaturas são botões (teclado)", pg6.locator("#thumbs button.thumb").count()==4)
    pg6.click("#thumbs button.thumb:nth-child(2)"); pg6.wait_for_timeout(200)
    check("clicar na miniatura troca a imagem", "banner2" in pg6.get_attribute("#main-img","src"))
    pg6.hover(".main-image"); pg6.click(".gal-next"); pg6.wait_for_timeout(200)
    check("seta avança", "banner3" in pg6.get_attribute("#main-img","src"))
    pg6.click(".zoom-btn"); pg6.wait_for_timeout(300)
    check("tela cheia abre com miniaturas", pg6.is_visible(".lb") and pg6.locator(".lb-thumb").count()==4)
    pg6.screenshot(path="v10-lb.png")
    pg6.click(".lb-thumb:nth-child(4)"); pg6.wait_for_timeout(300)
    check("vídeo abre na tela cheia", pg6.locator(".lb video.lb-video, .lb iframe.lb-video").count()==1)
    pg6.keyboard.press("Escape"); pg6.wait_for_timeout(200)
    check("Esc fecha", pg6.locator(".lb").count()==0)
    pg6.close(); pg7=page(); pg7.goto(f"http://localhost:{PORT}/product.html?id=7"); pg7.wait_for_timeout(1800)
    check("'Você também pode gostar' tem discos de kg", pg7.locator("#products-carousel .item .weight-chip").count()>=3, pg7.locator("#products-carousel .item").count())
    pg7.click('#products-carousel .item:has-text("Outra") .weight-chip[data-vi="2"]'); pg7.wait_for_timeout(200)
    check("disco troca o preço e salva o kg", "140.00" in pg7.inner_text('#products-carousel .item:has-text("Outra") .price') and '"8":"15kg"' in pg7.evaluate("localStorage.getItem('weight_pref_v1')"), pg7.evaluate("localStorage.getItem('weight_pref_v1')"))
    check("clicar no disco não muda de página", "product.html?id=7" in pg7.url)
    pg7.click('#products-carousel .item:has-text("Outra") .add-circle'); pg7.wait_for_timeout(300)
    check("+ adiciona o kg escolhido", pg7.evaluate("JSON.parse(localStorage.getItem('cart')||'[]').some(i=>i.productId==8&&i.variantIndex==2)"), pg7.evaluate("localStorage.getItem('cart')"))
    check("sem erros (relacionados)", not pg7._errs, pg7._errs)
    pg8=page(logged=False); pg8.goto(f"http://localhost:{PORT}/index.html"); pg8.wait_for_timeout(1500)
    pg8.evaluate("void window.customerAuth.ensureAuthenticated()"); pg8.wait_for_timeout(400)
    pg8.click('[data-tab=register]'); pg8.wait_for_timeout(60)
    check("Entrar -> Cadastrar tem transição", pg8.evaluate("document.querySelector('#customer-register-form').classList.contains('view-in')") and pg8.is_visible('#customer-register-form'))
    pg2.evaluate("window.customerAuth.openAccountModal()"); pg2.wait_for_timeout(300); pg2.click('[data-account-tab=favorites]'); pg2.wait_for_timeout(60)
    check("abas da conta têm transição", pg2.evaluate("document.querySelector('#customer-account-favorites').classList.contains('view-in')"))
    check("galeria sem erros de JS", not pg6._errs, pg6._errs)
    b.close()
finally: srv.terminate()
print(f"\n{sum(results)}/{len(results)} passaram")
