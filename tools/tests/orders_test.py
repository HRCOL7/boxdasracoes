"""Admin > Pedidos: lista, KPIs, detalhe com endereço confirmado, troca de status, falha fechada.
Uso: python3 -I orders_test.py <pasta_do_site>"""
import sys, subprocess, time, re, json
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8782"
STUB = """
window.__updates=[];
var now=new Date().toISOString();
var yest=new Date(Date.now()-86400000).toISOString();
window.__orders=[
 {id:2,order_number:129952,customer_name:'Maria S.',customer_phone:'(79) 99999-1111',customer_email:'m@x.com',total:231.7,status:'pending',created_at:now,
  items:[{name:'Ração Premium • 15kg',qty:1,price:199.9},{name:'Petisco Promo Gatos • 500g',qty:2,price:15.9}],
  note:'Checkout no site\\nPagamento escolhido: PIX\\nAgendamento: 2026-10-18 13:00-15:00\\nEndereco: Rua das Flores, 10 - Centro\\nCEP: 49000000\\nReferencia: casa azul\\nEndereco confirmado pelo cliente: sim'},
 {id:1,order_number:129951,customer_name:'João P.',total:89.9,status:'delivered',created_at:yest,items:[{name:'Areia',qty:1,price:89.9}],note:''},
 {id:3,order_number:129953,customer_name:'Cancelado X',total:500,status:'cancelled',created_at:now,items:[],note:''}
];
window.supabase={createClient:function(){return {
  rpc:function(n){return Promise.resolve({data: window.__admin!==false, error:null})},
  from:function(t){var q={_t:t};
    q.select=function(){return q}; q.order=function(){return q}; q.limit=function(){return Promise.resolve({data:window.__orders,error:null})};
    q.update=function(v){q._v=v;return q}; q.eq=function(c,id){q._id=id;return q};
    q.single=function(){window.__updates.push([q._id,q._v]); var o=window.__orders.find(function(x){return x.id==q._id}); if(window.__failUpdate) return Promise.resolve({data:null,error:{message:'permission denied'}}); Object.assign(o,q._v); return Promise.resolve({data:o,error:null})};
    return q},
  auth:{getUser:function(){return Promise.resolve({data:{user: window.__admin===null?null:{id:'a1',email:'admin@x.com'}}})},
        getSession:function(){return Promise.resolve({data:{session:null}})},
        onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}},
        signInWithPassword:function(){return Promise.resolve({data:{},error:null})}}}}};
"""
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
results=[]
def check(n,ok,d=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ")+n+(" "+str(d) if (d and not ok) else ""))
def new_page(b, init=""):
    pg=b.new_page(viewport={"width":1280,"height":900}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)[:150]))
    pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
    pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200, content_type="application/javascript", body=STUB))
    if init: pg.add_init_script(init)
    return pg, errs
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    pg,errs=new_page(b)
    pg.goto(f"http://localhost:{PORT}/admin/orders.html"); pg.wait_for_timeout(1500)
    check("login some para admin", not pg.is_visible("#admin-login"))
    check("3 pedidos na tabela", pg.locator("#orders-table tbody tr").count()==3)
    check("KPI pedidos hoje = 1 (cancelado não conta)", pg.inner_text("#kpi-count").strip()=="1")
    check("KPI faturamento hoje = R$ 231,70", "231,70" in pg.inner_text("#kpi-revenue"))
    check("KPI ticket médio = R$ 231,70", "231,70" in pg.inner_text("#kpi-avg"))
    check("KPI aguardando = 1", pg.inner_text("#kpi-new").strip()=="1")
    check("gráfico tem 7 barras e rótulo Hoje", pg.locator(".ord-bar-col").count()==7 and "Hoje" in pg.inner_text("#orders-chart"))
    pg.click(".ord-pick[data-id='2']"); pg.wait_for_timeout(200)
    d=pg.inner_text("#order-detail")
    check("detalhe: itens, total e endereço", "Ração Premium" in d and "231,70" in d and "Rua das Flores" in d)
    check("detalhe: selo Endereço confirmado pelo cliente", "Endereço confirmado pelo cliente" in d)
    check("detalhe: link do WhatsApp do cliente", (pg.get_attribute("#order-detail a[href^='https://wa.me/']","href") or "").startswith("https://wa.me/5579999991111"))
    pg.click("#ord-advance"); pg.wait_for_timeout(300)
    check("avançar: envia update status=preparing", pg.evaluate("window.__updates")==[[2,{"status":"preparing"}]], pg.evaluate("window.__updates"))
    check("avançar: badge vira Em preparo e botão muda", "Em preparo" in pg.inner_text("#order-detail") and "Marcar como a caminho" in pg.inner_text("#order-detail"))
    pg.once("dialog", lambda dlg: dlg.accept()); pg.click("#ord-cancel"); pg.wait_for_timeout(300)
    check("cancelar: status cancelled", pg.evaluate("window.__updates")[-1]==[2,{"status":"cancelled"}])
    pg.select_option("#orders-filter","cancelled"); pg.wait_for_timeout(200)
    check("filtro Cancelados mostra 2", pg.locator("#orders-table tbody tr").count()==2)
    check("sem erros de JS", not errs, errs)
    pg.close()
    # erro ao salvar (migração não aplicada / sem permissão)
    pg,errs=new_page(b,"window.__failUpdate=true;")
    pg.goto(f"http://localhost:{PORT}/admin/orders.html"); pg.wait_for_timeout(1200)
    pg.click(".ord-pick[data-id='2']"); pg.click("#ord-advance"); pg.wait_for_timeout(300)
    check("falha ao salvar: mostra aviso e não muda status", "Não foi possível alterar" in pg.inner_text("#orders-status") and "Novo" in pg.inner_text("#order-detail"))
    pg.close()
    # não-admin: falha fechada
    pg,errs=new_page(b,"window.__admin=false;")
    pg.goto(f"http://localhost:{PORT}/admin/orders.html"); pg.wait_for_timeout(1200)
    check("não-admin: login visível e nada carregado", pg.is_visible("#admin-login") and pg.locator("#orders-table tbody tr").count()<=1)
    pg.close()
    # nav + tema
    pg,errs=new_page(b)
    pg.goto(f"http://localhost:{PORT}/admin/orders.html"); pg.wait_for_timeout(1000)
    check("abas Pedidos/Produtos/Relatórios", pg.locator(".admin-nav a").count()==3 and pg.get_attribute(".admin-nav a[aria-current]","href")=="./orders.html")
    check("botão de tema no cabeçalho", pg.locator("#theme-toggle").count()==1)
    b.close()
finally: srv.terminate()
print(f"\n{sum(results)}/{len(results)} OK"); sys.exit(0 if all(results) else 1)
