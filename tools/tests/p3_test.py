"""Auditoria de acessibilidade no navegador (substitui o axe-core quando a rede não o alcança).
Uso: python3 -I audit.py <pasta_do_site>"""
import sys, subprocess, time, json, re
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]; PORT="8779"
PRODUCTS=[
 {"id":101,"name":"Ração Premium Cães Adultos 15kg","group":"caes","subgroup":"racao-seca","brand":"Marca A","image":"img/logobox.png","variants":[{"weight":"15kg","price":212},{"weight":"1kg","price":18.5}],"price":212,"is_promo":False},
 {"id":102,"name":"Petisco Promo Gatos","group":"gatos","brand":"Marca B","image":"img/logobox.png","variants":[{"weight":"500g","price":20}],"price":20,"is_promo":True,"promo_price":15.9},
 {"id":103,"name":"Brinquedo Indisponível","group":"caes","brand":"Marca A","image":"img/logobox.png","price":10,"is_unavailable":True},
]
JS_AUDIT = r"""
() => {
  const out = {contrast:[], names:[], labels:[], dupIds:[], headings:[], small:[], landmarks:{}};
  const lum = c => { const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p=m[1].split(',').map(x=>parseFloat(x)); return [p[0],p[1],p[2], p.length>3?p[3]:1]; };
  const over = (fg,bg) => [fg[0]*fg[3]+bg[0]*(1-fg[3]), fg[1]*fg[3]+bg[1]*(1-fg[3]), fg[2]*fg[3]+bg[2]*(1-fg[3]), 1];
  const visible = el => { const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&parseFloat(cs.opacity)>0.05 && !el.closest('[inert]') && !el.closest('.sr-only'); };
  const bgOf = el => { let layers=[]; let n=el; while(n&&n.nodeType===1){ const cs=getComputedStyle(n); if(cs.backgroundImage!=='none') return null; const c=parse(cs.backgroundColor); if(c&&c[3]>0){ layers.push(c); if(c[3]>=1) break; } n=n.parentElement; } let base=[255,255,255,1]; for(let i=layers.length-1;i>=0;i--) base=over(layers[i],base); return base; };
  const sel = el => el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'');
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let t; while((t=walker.nextNode())){
    const txt=t.nodeValue.trim(); if(!txt) continue; const el=t.parentElement; if(!el||!visible(el)||['SCRIPT','STYLE'].includes(el.tagName)) continue;
    const cs=getComputedStyle(el); let fg=parse(cs.color); const bg=bgOf(el); if(!fg||!bg) continue; fg=over(fg,bg);
    const L1=lum(fg), L2=lum(bg); const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const size=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight)>=700; const large=size>=24||(size>=18.66&&bold); const need=large?3:4.5;
    if(ratio<need){ const k=sel(el)+'|'+cs.color+'|'+cs.backgroundColor; if(!seen.has(k)){ seen.add(k); out.contrast.push(sel(el)+' "'+txt.slice(0,28)+'" '+ratio.toFixed(2)+' (precisa '+need+')'); } }
  }
  document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]').forEach(el=>{
    if(!visible(el) || el.getAttribute('aria-hidden')==='true') return;
    const labelled = el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.title||(el.id&&document.querySelector('label[for="'+el.id+'"]'))||el.closest('label');
    const text=(el.textContent||'').trim(); const imgAlt = el.querySelector('img[alt]:not([alt=""])');
    const isInput = ['INPUT','SELECT','TEXTAREA'].includes(el.tagName);
    if(!labelled && !(!isInput && (text||imgAlt))) out.names.push(sel(el));
    if(isInput && !labelled && !el.getAttribute('aria-label')) out.labels.push(sel(el));
    const r=el.getBoundingClientRect(); const inline = el.tagName==='A' && getComputedStyle(el).display==='inline';
    if(!inline && (r.width<24||r.height<24)) out.small.push(sel(el)+' '+Math.round(r.width)+'x'+Math.round(r.height));
  });
  const ids={}; document.querySelectorAll('[id]').forEach(e=>{ids[e.id]=(ids[e.id]||0)+1}); Object.keys(ids).forEach(k=>{ if(ids[k]>1) out.dupIds.push(k+' x'+ids[k]); });
  let prev=0; document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h=>{ if(!visible(h)&&!h.closest('.sr-only')) return; const lv=+h.tagName[1]; if(prev && lv>prev+1) out.headings.push(h.tagName+' depois de H'+prev+' "'+h.textContent.trim().slice(0,25)+'"'); prev=lv; });
  out.landmarks = {main:document.querySelectorAll('main').length, nav:document.querySelectorAll('nav').length, banner:document.querySelectorAll('header').length, search:document.querySelectorAll('[role=search]').length};
  return out;
}
"""
srv=subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)

results=[]
def check(n,ok,d=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ")+n+(" "+d if (d and not ok) else ""))
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def mk(path, init=""):
        pg=b.new_page(viewport={"width":1280,"height":800})
        pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
        pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200, content_type="application/javascript", body="window.supabase={createClient:function(){return {from:function(){return {select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getSession:function(){return Promise.resolve({data:{session:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}}}}}};"))
        pg.add_init_script("localStorage.setItem('products', %s);" % json.dumps(json.dumps(PRODUCTS)) + init)
        pg.goto(f"http://localhost:{PORT}/{path}"); pg.wait_for_timeout(2500); return pg
    # compartilhar
    pg=mk("product.html?id=101")
    href=pg.evaluate("(document.getElementById('share-wa')||{}).href")
    check("compartilhar: link wa.me com nome e preço", href and href.startswith("https://wa.me/?text=") and "212" in href, str(href)); pg.close()
    # comprar de novo
    last='localStorage.setItem("last_order_items_v1", JSON.stringify([{productId:101,variantIndex:0,qty:2}]));'
    pg=mk("index.html", last)
    pg.click("#cart-btn"); pg.wait_for_timeout(400)
    check("comprar de novo: botão aparece com carrinho vazio", pg.locator("#reorder-btn").count()==1)
    pg.click("#reorder-btn"); pg.wait_for_timeout(500)
    q=pg.evaluate("JSON.parse(localStorage.getItem('cart')||'[]').map(i=>i.qty)")
    check("comprar de novo: repõe 2 unidades no carrinho", q==[2], str(q))
    check("comprar de novo: botão some depois", pg.locator("#reorder-btn").count()==0); pg.close()
    # PWA
    pg=mk("index.html")
    check("pwa: manifest ligado", pg.evaluate("!!document.querySelector('link[rel=manifest]')"))
    pg.close()
    import urllib.request, json as J
    m=J.load(urllib.request.urlopen(f"http://localhost:{PORT}/manifest.webmanifest"))
    check("pwa: manifest com nome, ícones e start_url", m["name"] and len(m["icons"])>=2 and m["start_url"])
    for ic in m["icons"]:
        check("pwa: "+ic["src"]+" existe", urllib.request.urlopen(f"http://localhost:{PORT}{ic['src']}").status==200)
    check("pwa: sw.js existe", urllib.request.urlopen(f"http://localhost:{PORT}/sw.js").status==200)
    b.close()
finally: srv.terminate()
print(f"\n{sum(results)}/{len(results)} passaram")
