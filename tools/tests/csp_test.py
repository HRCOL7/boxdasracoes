"""Serve o site COM a CSP (modo bloqueante) e conta violações. Uso: python3 -I csp_test.py <pasta> <arquivo_csp>"""
import sys, threading, json, re, http.server, functools
from playwright.sync_api import sync_playwright
ROOT, CSPF = sys.argv[1], sys.argv[2]; CSP=open(CSPF).read().strip(); PORT=8774
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self): self.send_header("Content-Security-Policy", CSP); super().end_headers()
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",PORT), functools.partial(H, directory=ROOT)); threading.Thread(target=srv.serve_forever,daemon=True).start()
P=[{"id":101,"name":"Ração","group":"caes","brand":"A","image":"/img/logobox.png","variants":[{"weight":"15kg","price":212}],"price":212}]
SUPA="window.supabase={createClient:function(){return {from:function(){return {select:function(){return Promise.resolve({data:[],error:null})}}},auth:{getUser:function(){return Promise.resolve({data:{user:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe(){}}}}},getSession:function(){return Promise.resolve({data:{session:null}})}},channel:function(){return {on:function(){return this},subscribe:function(){return this}}},removeChannel:function(){}}}};"
CORS={"access-control-allow-origin":"*","access-control-allow-headers":"*"}
bad=0
with sync_playwright() as p:
    b=p.chromium.launch()
    for path in ["index.html","products.html","product.html?id=101","admin/admin.html","admin/reports.html"]:
        pg=b.new_page(viewport={"width":1280,"height":800}); v=[]
        pg.on("console", lambda m: v.append(m.text[:160]) if "Content Security Policy" in m.text else None)
        pg.on("response", lambda r: v.append(f"HTTP {r.status} {r.url[-60:]}") if r.status>=400 and f"127.0.0.1:{PORT}" in r.url and not r.url.endswith("favicon.ico") else None)
        pg.on("pageerror", lambda e: v.append("pageerror "+str(e)[:120]))
        pg.route(re.compile(r".*supabase-js.*"), lambda r: r.fulfill(status=200,content_type="application/javascript",body=SUPA))
        pg.route("**/rest/v1/**", lambda r: r.fulfill(status=200,content_type="application/json",headers=CORS,body=json.dumps(P)))
        pg.route(re.compile(r"https://(fonts\.|via\.|img\.).*"), lambda r: r.abort())
        pg.add_init_script("localStorage.setItem('products', %s);" % json.dumps(json.dumps(P)))
        pg.goto(f"http://127.0.0.1:{PORT}/{path}"); pg.wait_for_timeout(2500)
        if path=="index.html":
            pg.click(".as-launcher"); pg.wait_for_timeout(300); pg.click("#hamburger"); pg.wait_for_timeout(300)
        print(("OK   " if not v else "VIOL ")+path, v[:3]); bad+=len(v); pg.close()
    b.close()
print("violações:",bad); sys.exit(1 if bad else 0)
