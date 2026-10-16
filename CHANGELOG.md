# Relatório de mudanças — Box das Rações

## A. Segurança e boas práticas
- **Banco (RLS):** só administrador confirmado altera produtos (antes, qualquer usuário logado alterava);
  alertas de preço do ERP só para admin; fila do ERP só com o próprio cadastro.
- **Total do pedido calculado no servidor** (trigger): o navegador não consegue mais pagar menos; tentativas
  são registradas na observação do pedido.
- **Admin:** fonte única (`admin_users` + `is_admin()`), exige e-mail confirmado; o front só espelha isso.
- `safeImageUrl` bloqueia `javascript:` em imagens; cabeçalhos de segurança no Netlify; supabase-js fixado em `@2`.
- Limpeza: arquivos duplicados/de teste removidos, `.gitignore` (`.env`, `erp_connector/backups/`).
- Testes: `supabase/tests/security_test.sql` (28/28; no estado antigo 18 falhavam).

## B. Acessibilidade (WCAG 2.2 AA)
- Contraste: laranja da marca `#ff7a00` (2,6:1) → `#bf5600` (4,6:1); original guardado em `--orange-brand`.
- Pular para o conteúdo, landmarks (`header/nav/main/search`), títulos em ordem, foco sempre visível.
- Menu, carrinho, busca, modais e carrossel navegáveis por teclado e leitor de tela; foco preso/devolvido em diálogos.
- Carrossel com botão de pausa; respeita `prefers-reduced-motion`; `alert()` trocado por avisos falados.
- Alvos de toque ≥ 24–44 px; preferências do usuário (letra, contraste, espaçamento, links, movimento).
- Verificação: auditoria própria 0 problemas (celular/desktop, 7 telas), `a11y_test` 29/29, `desktop_cart_test` 7/7.

## C. Assistente de IA
- Widget "Ajuda e acessibilidade" (`js/assistant.js`): chat, voz (falar/ouvir), preferências, busca de produtos,
  abrir carrinho, ler a página. Funciona **sem IA** com regras locais e passa a usar IA quando a função for publicada.
- `supabase/functions/assistant`: a chave da Anthropic fica no servidor; prompt, ferramentas e modelo são fixos;
  limites de tamanho e de pedidos; 14/14 testes. Teste do widget: 21/21.
- Honestidade: um assistente **não substitui** código acessível — por isso a Parte B veio primeiro.

## D. App React Native + Expo
- `expo-starter/`: Supabase, tipos, tema acessível, serviços prontos; telas como exercícios guiados (README).

## E. Segunda rodada (pedido do usuário)
- Fonte Nunito agora vem por `<link>` no HTML (o `@import` antigo nunca funcionava).
- Banners padrão criados em `img/banner1-3.jpg`; preview do admin usa `../img/...` (acabou o 404).
- **CSP em modo relatório** no `netlify.toml`; todos os scripts inline foram movidos para arquivos
  (`js/config-loader.js`, `js/product-page.js`, `js/admin-init.js`). Com a política ativa de verdade: 0 violações (`tools/tests/csp_test.py`).
- Admins: o site não tem mais lista de e-mails (`config.js` limpo, plano B removido de `admin.js` e `admin-reports.js`; falha = "não é admin").
  Scripts SQL antigos agora usam `is_admin()`; `is_current_user_admin()` delega para ela.
- `site_events`: migração `20261015000000_site_events_limits.sql` (limites de tamanho, 60 eventos/min por sessão,
  3000/min total, `actor_user_id` só o próprio). Testes `supabase/tests/site_events_test.sql`: 22/22.
- README reescrito.

## Pendências / observações
- CSP ainda em modo relatório: troque para bloqueante só depois de navegar por todas as páginas sem avisos. `style-src` mantém `'unsafe-inline'` (o JS monta `style="..."`).
- Admins: enquanto a migração de segurança não for aplicada, a interface do admin não reconhece ninguém (falha fechada, de propósito).
- axe-core/Lighthouse não rodaram aqui (rede bloqueada): rode no seu PC (veja PASSO-A-PASSO.md).
- Nada foi aplicado no seu Supabase nem publicado no Netlify.
