"""Gera o sitemap.xml com TODOS os produtos (para o Google achar cada um).
Uso (na pasta do site, com a internet liberada):
  set SUPABASE_URL=https://SEU-PROJETO.supabase.co
  set SUPABASE_ANON_KEY=sua_chave_anon_publica
  python tools/gen_sitemap.py
Depois publique o sitemap.xml gerado. Refaça de vez em quando (ex.: toda semana)."""
import os, sys, json, urllib.request
url=os.environ.get("SUPABASE_URL","").rstrip("/"); key=os.environ.get("SUPABASE_ANON_KEY","")
if not url or not key: sys.exit("Defina SUPABASE_URL e SUPABASE_ANON_KEY")
SITE="https://boxdasracoes.com.br"; ids=[]; off=0
while True:
    req=urllib.request.Request(f"{url}/rest/v1/products?select=id&order=id.asc&offset={off}&limit=1000",headers={"apikey":key,"Authorization":"Bearer "+key})
    rows=json.load(urllib.request.urlopen(req))
    ids+= [r["id"] for r in rows]
    if len(rows)<1000: break
    off+=1000
base=["/","/products.html","/products.html?animal=caes","/products.html?animal=gatos","/products.html?animal=medicamentos","/products.html?promo=1"]
out=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in base: out.append(f"  <url><loc>{SITE}{u.replace('&','&amp;')}</loc></url>")
for i in ids: out.append(f"  <url><loc>{SITE}/product.html?id={i}</loc></url>")
out.append("</urlset>")
open("sitemap.xml","w",encoding="utf-8").write("\n".join(out)+"\n")
print(len(ids),"produtos no sitemap.xml")
