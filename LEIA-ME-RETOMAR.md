# PROGRESSO — Box das Rações (LEIA ANTES DE QUALQUER AÇÃO)

REGRAS (pedido do usuário, 13/10/2026):
- NUNCA recomeçar. NUNCA apagar/recriar a pasta de trabalho. Sempre continuar do último "FEITO" abaixo.
- NUNCA criar nova lista de tarefas: usar as tarefas #23–#28 (TaskUpdate).
- Trabalhar por partes (economizar tokens). Ao fim de cada parte: git commit + atualizar este arquivo.
- Não aplicar nada no Supabase/Netlify do usuário: só gerar arquivos SQL/código.
- NÃO rodar npm no container (rede bloqueia). Testes: Python Playwright (tests/a11y_test.py já existe) + node --check.

PASTAS (scratchpad = /tmp/claude-0/-home-claude/73723f6f-33a1-59f6-b065-a69debcac1c3/scratchpad)
- proj/boxdasracoes-main  = zip original, INTOCADO
- work/site               = cópia de trabalho (repo git; 1 commit por parte)
- tests/a11y_test.py      = teste Playwright de tentativas antigas (spec: skip-link .skip-link, #main-content, menu inert/aria-expanded, links <a> no menu, carrinho como diálogo)
- (sandbox tem /usr/bin/psql; pgdata de tentativa antiga)

PARTES
- [x] A  Segurança + limpeza (SQL migration, trigger total, policies, .gitignore, duplicados, escapes)
- [ ] B  Acessibilidade HTML/CSS/JS (skip link, landmarks, menu/carrinho/dialogs, carousel pausável, contraste, foco)
- [ ] C  Assistente de IA acessível (widget + Edge Function + preferências)
- [ ] D  Starter React Native + Expo (plano C do usuário)
- [ ] E  Verificação (Playwright, node --check) + zip + relatório

LOG
- A.1 FEITO: supabase/migrations/20261013000000_security_hardening.sql + supabase/tests/security_test.sql. Testado em PG16 local (stub auth): 28/28 PASS; controle negativo (estado antigo) = 18 FAIL. Banco de teste: scratchpad/pgtest (porta 54329, socket no dir; iniciar com runuser -u postgres pg_ctl).
- A.2 FAZER: admin gate no JS via rpc('is_admin'); .gitignore (backups ERP); remover _root*.html, server_test_abrir.txt, imagens duplicadas na raiz (cuidado: img/Cart-L2.png -> minúsculo); safeImageUrl; netlify.toml (cache/headers); supabase-js @2.
- A.2 FEITO (commit): admin gate via rpc is_admin (supa.isAdmin) com plano B; .gitignore; removidos _root*.html/server_test/imagens duplicadas (img/cart-l2.png minúsculo); safeImageUrl; supabase-js@2; netlify.toml (headers, cache no-cache, Permissions-Policy microphone=(self)); supabase/README.md.
- PARTE A COMPLETA. PRÓXIMO: Parte B (acessibilidade). Spec de testes antigos em tests/a11y_test.py (skip-link .skip-link -> #main-content; menu #hamburger aria-expanded, #side-menu inert quando fechado, links <a>; carrinho como diálogo).
- SMOKE (tests/smoke.py <site_dir>): páginas sem erro de JS. Achados p/ Parte B: (1) img/banner1-3.jpg padrão NÃO existem -> 404 (usar onerror -> fallbackBanner em carousel.js + alt); (2) admin/admin.html resolve 'img/bannerN.jpg' relativo a /admin/ -> 404 (usar caminho absoluto /img/).
- Último commit: "Parte A.2". Tarefa #24 concluída. Próxima ação: TaskUpdate #25 in_progress e começar Parte B.
- B.1 FEITO (commit): css/a11y.css, js/a11y.js (appA11y: announce/notify/openDialog{modal:false suportado? NÃO AINDA - adicionar}/trapFocus/prefs), cores (--orange #bf5600, --green #1e8449, --muted), index.html + includes/header.html (skip link só no index; labels; aria no carrinho).
- B.2 FAZER (nesta ordem): (a) a11y.js: opts.modal===false (sem inert/trap, só Esc) p/ carrinho; (b) header.js placeholder + products.html + product.html + admin/*.html (link a11y.css, script a11y.js, skip-link, main#main-content); (c) cart.js openCart/closeCart/aria-label contagem/alert->notify/qty labels; (d) menu.js nav/inert/links/esc; (e) search.js links + #search-status; (f) carousel.js pausa/reduced motion/dots aria/onerror banner; (g) products.js aria-label Adicionar + notify; (h) customer-auth modal dialog; (i) .brands h2 no CSS; (j) tests/a11y_test.py rodar.

## Parte B concluída (B.2)
- Auditoria própria: 0 problemas (celular 390px / desktop 1280px) em index (normal/menu/carrinho), products, product.
- a11y_test 29/29, desktop_cart_test 7/7.
- Correção: safeImageUrl movido para a11y.js (carrega no <head>) — evita erro de ordem de scripts.
- Próximo: Parte C (assistente de IA acessível + Edge Function).

## Parte C concluída
- supabase/functions/assistant/index.ts (+test.mjs 14/14), css/assistant.css, js/assistant.js ligados em index/products/product.
- tests/assistant_test.py 21/21; audit com painel aberto: 0 problemas; a11y_test 29/29.
- Nada publicado no Supabase. Próximo: Parte D (starter Expo).

## Rodada 2 (prompt do Copilot) concluída
- Tarefas 1-6 feitas e commitadas. Bug próprio corrigido: js/config-loader.js não tinha sido criado (pegou o assistant_test); csp_test agora acusa 404 local.
- Testes finais: a11y 29/29, audit 0, desktop_cart 0 falhas, assistant 21/21, csp 0 violações, SQL security 28/28, site_events 22/22, edge function 14/14.
- Zip: scratchpad/boxdasracoes-corrigido-v2.zip
