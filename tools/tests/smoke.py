import sys, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1]; PORT = "8766"
srv = subprocess.Popen(["python3","-m","http.server",PORT,"--directory",ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
bad = 0
try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    for path in ["index.html","products.html","product.html?id=1","admin/admin.html","admin/reports.html"]:
      page = b.new_page(viewport={"width":390,"height":800})
      errs, miss = [], []
      page.on("pageerror", lambda e: errs.append(str(e)[:120]))
      page.on("response", lambda r: miss.append(f"{r.status} {r.url}") if r.url.startswith(f"http://localhost:{PORT}") and r.status >= 400 else None)
      # bloqueia rede externa (CDN/fontes): o container não tem internet aberta
      page.route("**/*", lambda r: r.abort() if not r.request.url.startswith(f"http://localhost:{PORT}") else r.continue_())
      page.goto(f"http://localhost:{PORT}/{path}"); page.wait_for_timeout(1200)
      miss = [m for m in miss if "produtos.json" not in m and "config.js" not in m]  # esperados sem Supabase
      imgs = page.evaluate("[...document.images].filter(i=>i.complete && i.naturalWidth===0 && i.src.startsWith('http://localhost')).map(i=>i.src)")
      ok = not errs and not miss and not imgs
      bad += 0 if ok else 1
      print(("OK  " if ok else "ERRO"), path, errs[:2], miss[:3], imgs[:3])
      page.close()
    b.close()
finally:
  srv.terminate()
sys.exit(1 if bad else 0)
