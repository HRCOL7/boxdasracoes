import sys, subprocess, time
from playwright.sync_api import sync_playwright
ROOT=sys.argv[1]
srv=subprocess.Popen(["python3","-m","http.server","8767","--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
bad=0
def check(n,ok,extra=""):
    global bad; bad += 0 if ok else 1; print(("PASS" if ok else "FAIL"),n,extra)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":800})
    pg.route("**/*", lambda r: r.abort() if not r.request.url.startswith("http://localhost:8767") else r.continue_())
    pg.goto("http://localhost:8767/index.html"); pg.wait_for_timeout(900)
    pg.click("#cart-btn"); pg.wait_for_timeout(300)
    check("desktop: carrinho role=dialog aria-modal=false", pg.get_attribute("#cart-panel","role")=="dialog" and pg.get_attribute("#cart-panel","aria-modal")=="false")
    check("desktop: botão do carrinho aria-expanded=true", pg.get_attribute("#cart-btn","aria-expanded")=="true")
    check("desktop: foco foi para dentro do carrinho", pg.evaluate("document.getElementById('cart-panel').contains(document.activeElement)"))
    check("desktop: página atrás NÃO fica inert", pg.evaluate("!document.querySelector('main').inert"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("desktop: Esc fecha o carrinho", pg.evaluate("document.getElementById('cart-panel').classList.contains('hidden')"))
    check("desktop: foco volta ao botão do carrinho", pg.evaluate("document.activeElement.id==='cart-btn'"))
    check("desktop: aria-expanded=false depois", pg.get_attribute("#cart-btn","aria-expanded")=="false")
    b.close()
finally: srv.terminate()
sys.exit(1 if bad else 0)
