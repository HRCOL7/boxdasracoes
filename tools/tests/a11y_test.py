import sys, subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1]
srv = subprocess.Popen(["python3","-m","http.server","8765","--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
res=[]; 
def check(name, ok, extra=""):
    res.append((name, bool(ok), extra)); print(("PASS" if ok else "FAIL"), name, extra)
try:
  with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome") if False else p.chromium.launch()
    ctx = b.new_context(viewport={"width":390,"height":800})
    page = ctx.new_page()
    errors=[]
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/*", lambda r: r.abort() if ("jsdelivr" in r.request.url or "googleapis" in r.request.url or "gstatic" in r.request.url or "placeholder.com" in r.request.url) else r.continue_())
    page.goto("http://localhost:8765/index.html"); page.wait_for_timeout(1500)

    # 1 skip link
    page.keyboard.press("Tab")
    check("skip-link é o 1º foco", page.evaluate("document.activeElement.classList.contains('skip-link')"))
    page.keyboard.press("Enter"); page.wait_for_timeout(100)
    check("skip-link leva ao <main>", page.evaluate("document.activeElement.id==='main-content'"))

    # 2 menu por teclado
    page.focus("#hamburger"); page.keyboard.press("Enter"); page.wait_for_timeout(400)
    check("menu: aria-expanded=true", page.get_attribute("#hamburger","aria-expanded")=="true")
    check("menu: foco entra no painel", page.evaluate("document.getElementById('side-menu').contains(document.activeElement)"))
    check("menu: painel não está inert aberto", page.evaluate("!document.getElementById('side-menu').inert"))
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("menu: Esc fecha e devolve foco ao botão", page.evaluate("document.activeElement.id==='hamburger'") and page.get_attribute("#hamburger","aria-expanded")=="false")
    check("menu: fechado fica inert (fora do Tab)", page.evaluate("document.getElementById('side-menu').inert"))
    # links reais no menu
    page.click("#hamburger"); page.wait_for_timeout(300)
    n_links = page.evaluate("document.querySelectorAll('#side-menu a[href]').length")
    n_div_click = page.evaluate("document.querySelectorAll('#side-menu .side-sub:not(a)').length")
    check("menu: sub-itens são <a href>", n_links>0 and n_div_click==0, f"{n_links} links")
    page.keyboard.press("Escape"); page.wait_for_timeout(200)

    # 3 carrinho como diálogo
    page.click("#cart-btn"); page.wait_for_timeout(400)
    check("carrinho: role=dialog + aria-modal", page.get_attribute("#cart-panel","role")=="dialog" and page.get_attribute("#cart-panel","aria-modal")=="true")
    check("carrinho: foco dentro do diálogo", page.evaluate("document.getElementById('cart-panel').contains(document.activeElement)"))
    inside=True
    for i in range(40):
        page.keyboard.press("Tab")
        if not page.evaluate("document.getElementById('cart-panel').contains(document.activeElement)"): inside=False; break
    check("carrinho: Tab não escapa do diálogo (40 Tabs)", inside)
    check("carrinho: resto da página inert", page.evaluate("document.querySelector('main').hasAttribute('inert')"))
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("carrinho: Esc fecha", page.evaluate("document.getElementById('cart-panel').classList.contains('hidden')"))
    check("carrinho: foco volta ao botão do carrinho", page.evaluate("document.activeElement.id==='cart-btn'"))
    check("carrinho: página sem inert depois", page.evaluate("!document.querySelector('main').hasAttribute('inert')"))

    # 4 nomes acessíveis
    missing = page.evaluate("""()=>{
      const out=[];
      document.querySelectorAll('input:not([type=hidden]),select,textarea,button,a[href]').forEach(el=>{
        const t=(el.textContent||'').trim();
        const named = el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')||el.title||
          (el.id&&document.querySelector('label[for="'+el.id+'"]'))||el.closest('label')||(el.tagName.match(/^(A|BUTTON)$/)&&t)||
          (el.tagName==='BUTTON' && el.querySelector('img[alt]:not([alt=""])'));
        if(!named && el.getAttribute('aria-hidden')!=='true') out.push(el.tagName+'#'+el.id+'.'+el.className);
      });
      return out;}""")
    check("todos os controles têm nome acessível", len(missing)==0, ", ".join(missing[:6]))
    check("imagens têm atributo alt", page.evaluate("[...document.images].every(i=>i.hasAttribute('alt'))"))
    check("há exatamente 1 <h1>", page.evaluate("document.querySelectorAll('h1').length")==1)
    check("html tem lang", page.evaluate("document.documentElement.lang")=="pt-BR")
    # sem banners cadastrados no admin o carrossel não existe (as ofertas ocupam o lugar)
    check("sem banners do admin: carrossel escondido", page.evaluate("document.getElementById('top-carousel').hidden===true"))
    # com banners cadastrados: o botão de pausar (WCAG 2.2.2) tem que existir
    pc = b.new_context(viewport={"width":1000,"height":800}); pb = pc.new_page()
    pb.route("**/*", lambda r: r.abort() if ("jsdelivr" in r.request.url or "googleapis" in r.request.url) else r.continue_())
    pb.add_init_script("window.BANNERS=['img/banner1.jpg','img/banner2.jpg'];")
    pb.goto("http://localhost:8765/index.html"); pb.wait_for_timeout(1500)
    check("com banners do admin: botão de pausar carrossel presente", pb.evaluate("!!document.querySelector('.carousel-pause') && !document.getElementById('top-carousel').hidden"), "")
    pc.close()
    # 5 reduce motion
    ctx2 = b.new_context(viewport={"width":390,"height":800}, reduced_motion="reduce")
    p2 = ctx2.new_page(); p2.route("**/*", lambda r: r.abort() if ("jsdelivr" in r.request.url or "googleapis" in r.request.url) else r.continue_())
    p2.goto("http://localhost:8765/index.html"); p2.wait_for_timeout(800)
    check("reduced-motion: sem botão de pausa/autoplay", p2.evaluate("!document.querySelector('.carousel-pause')"))
    # 6 contraste calculado
    def lum(c):
        c=[x/255 for x in c]; f=lambda v: v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
        return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])
    cc = page.evaluate("""()=>{const cs=getComputedStyle(document.documentElement);return [cs.getPropertyValue('--orange').trim(),cs.getPropertyValue('--green').trim()]}""")
    check("cores do tema atualizadas (--orange/--green)", [cc[0].lower(),cc[1].lower()]==["#a84800","#1e8449"], str(cc))
    check("sem erros JS na página", len(errors)==0, "; ".join(errors[:3]))
    page.screenshot(path=ROOT+"/../shot_index.png")

    # products + product pages
    for path in ["products.html","product.html?id=1"]:
        pg = ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("**/*", lambda r: r.abort() if ("jsdelivr" in r.request.url or "googleapis" in r.request.url or "placeholder.com" in r.request.url) else r.continue_())
        pg.goto("http://localhost:8765/"+path); pg.wait_for_timeout(1500)
        check(f"{path}: carrega sem erro JS", len(errs)==0, "; ".join(errs[:3]))
        check(f"{path}: skip-link e main", pg.evaluate("!!document.querySelector('.skip-link') && !!document.getElementById('main-content')"))
        check(f"{path}: cabeçalho com botão de menu rotulado", pg.get_attribute("#hamburger","aria-label")=="Abrir menu de categorias")
    b.close()
finally:
    srv.terminate()
print("\nRESUMO:", sum(1 for r in res if r[1]), "/", len(res), "passaram")
