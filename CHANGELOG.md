## v10 (parte 4)
- Relatório: nova seção "Vendas confirmadas" (só pedidos Entregues contam como venda; ticket médio, andamento, cancelados, top produtos). Rótulos antigos renomeados para "mensagens de pedido enviadas".
- Botão de modo escuro do painel admin dentro do cabeçalho.

## v10 (parte 3)
- Transição ao trocar Entrar/Cadastrar e as abas da conta; discos de kg em "Você também pode gostar" (com + e peso salvo).

## v10 (parte 2)
- Páginas legais, rodapé, consentimento, CPF opcional, alt dos banners (ver CHECKLIST-LEGAL.md).

## v10 (parte 1)
- Comanda por link: o texto do WhatsApp leva um link para `comanda.html` (pedido completo com fotos); o cliente não baixa nem anexa nada. Precisa da migração `supabase/migrations/20261021000000_comanda_link.sql` (sem ela, o pedido continua funcionando, só sem o link).
- Corações de favorito nos cards; favoritos ficam na conta (valem em qualquer aparelho).
- Minha conta: até 5 endereços (com padrão), aba "Meus pedidos" (histórico + comprar de novo + ver comanda).
- Carrinho: "Alterar endereço" mostra os endereços salvos para escolher; opção de salvar o endereço usado.
- Kg escolhido fica salvo por produto em todas as páginas.
- Texto do modal "Qual você gostaria?" legível no modo escuro.
- Botão de pausar do banner quase transparente (aparece ao passar o mouse/foco; continua acessível por teclado).
- Galeria do produto (computador): miniaturas em botões, painel cinza, setas, bolinhas, vídeo na galeria e na tela cheia (YouTube via youtube-nocookie).

## v9
- Lista de produtos: cards do mesmo tamanho (4 por linha no PC, 3 no tablet, 2 no celular), nome em 2 linhas e preço alinhado embaixo; sem rolagem horizontal.
- Filtros no celular: barra fixa "Filtros (n) + Ordenar" e gaveta de baixo para cima com botão "Ver N produtos"; não precisa mais descer a página.
- Menu lateral: mesmos ícones da home.
- Produto: imagem em tela cheia (botão e clique na foto), com zoom, setas, deslizar e Esc.
- Painel admin: botão Relatórios duplicado removido, caixas de configurações dentro do layout, botão de tema visível nos dois modos.
- Pedido por WhatsApp: gera a COMANDA em imagem (cliente, entrega, pagamento, itens com foto, total) com botões Enviar pelo WhatsApp / Copiar / Baixar; o endereço confirmado e o agendamento agora vão no texto e no pedido salvo. No painel de pedidos há "Gerar comanda (imagem)".
- Novo teste `tools/tests/v9_test.py`.

## v8
- Busca corrigida: só aparecem produtos que contêm TODAS as palavras digitadas (nome, marca, grupo; descrição com peso menor); erro de digitação leve aceito. Enter/lupa abre `products.html?q=...` com a lista completa e filtro "Busca: ..." removível; a lista suspensa tem "Ver todos os resultados".
- Cabeçalho único (`js/header.js`) igual em todas as páginas e nunca mais trocado durante o carregamento (acabou o "pulo" da barra de busca); resultados da busca flutuam sem empurrar a página.
- Modo escuro: descrição e textos cinza do produto agora legíveis.
- Home no padrão Petz: cabeçalho com busca em pílula (mobile) / busca larga + menu de categorias (PC), faixa de aviso, blocos de categoria (3x2 no celular, 6 em linha no PC) e banner grande.
- Nova logo (círculo cão e gato) no site, painel admin e ícones do app (a original foi guardada em `img/logobox-antigo.png`).
- Botão de ajuda e acessibilidade compacto no celular (só o ícone) e que sobe quando a faixa de cookies está aberta.
- Cookies/LGPD: faixa na primeira visita + centro de preferências (necessários, funcionalidade, analíticos, desempenho, publicidade), link "Preferências de cookies" em todas as páginas; a análise de visitas só roda se o cliente aceitar.
- Cabeçalho do celular: menu + entrar à esquerda, logo no centro, tema + carrinho à direita; blocos de categoria só no celular (no PC o menu do topo já os traz) e faixa repetida removida.
- PC: blocos de categoria voltam e o menu duplicado do topo sai. Menu lateral modernizado (cabeçalho com logo, atalhos, categorias em cartões, fundo escurecido).
- Google: dados estruturados Product em cada produto, canonical, título/descrição por produto, dados da loja e caixa de busca na home, robots.txt, sitemap.xml e `tools/gen_sitemap.py` (lista todos os produtos). Páginas de busca interna ficam fora do Google.
& e `consent_test.py`.

## v7
- Home nova: faixa de destaque mais curta com ilustração de cão e gato, ícones em SVG, faixa de confiança logo abaixo e **banners de oferta** (as 3 primeiras promoções, com preço "de/por" e preço por kg) no lugar do carrossel de imagens; o carrossel só aparece se o admin cadastrar banners próprios.
- "Quer repetir o seu último pedido?" na home (usa o último pedido guardado neste aparelho).
- Lista de produtos: contagem, filtros ativos que podem ser removidos, "Limpar filtros", Porte e Idade (detectados pelo nome do produto), faixa de preço, "Só promoções", "Só disponíveis" e ordenação por menor preço por kg.
- Admin: abas Pedidos / Produtos / Relatórios; nova página `admin/orders.html` (resumo do dia, lista, detalhe com endereço e selo "Endereço confirmado pelo cliente", mudança de status, gráfico de 7 dias, link do WhatsApp do cliente).
- Admin no modo escuro corrigido (cartões, campos e botões legíveis).
- Pedido do site passa a registrar "Endereco confirmado pelo cliente: sim" na observação.
- **Banco:** `supabase/migrations/20261017000000_admin_orders.sql` (admin lê/atualiza pedidos; só `status` e `note` podem mudar). Aplicar para a página de pedidos funcionar.
- Novo teste `orders_test.py` (19); `a11y_test.py` agora cobre o carrossel escondido e o botão de pausar quando há banners.

## v6
- Modo escuro no estilo da opção B (preto, marrom e laranja), com botão sol/lua no cabeçalho; segue o sistema se o cliente não escolher (`js/theme.js`).
- Login/cadastro redesenhados: olho para mostrar/ocultar a senha, "Esqueci minha senha" (e-mail com link) e tela "Criar nova senha" ao voltar pelo link.
- Endereço de entrega: resumo no carrinho com "Alterar endereço", diálogo "Confirme o endereço" a cada pedido (WhatsApp e site) e opção "Salvar como meu endereço padrão".
- Correção: `config.js` agora é carregado por `<script src="/config.js">` (antes era injetado de forma assíncrona e podia chegar depois dos outros scripts); `js/config-loader.js` removido.
- Novos testes: `auth_test.py` (15), `address_test.py` (13); a auditoria passa a cobrir modo escuro e login.

## v5
- Cores da marca (laranja `#FF7A00`, marrom `#5C2E0A`, preto `#1F1B16`) no site e no admin; faixa de destaque (hero) laranja na home; cabeçalho preto; banners de exemplo regenerados.
- Foco do teclado: contorno azul de 2px (antes 3px + halo); em campos fica por dentro, sem ser cortado no carrinho.

## Novo visual (v4)
- Tema novo (`css/theme.css`): fundo creme, cartões arredondados, laranja só em preços/botões, verde só no WhatsApp, cabeçalho enxuto, busca grande, carrinho renovado.
- Home: chips de categoria (Cães, Gatos, Medicamentos, Promoções), faixa de confiança e rodapé (com campos `[...]` para preencher).
- Produto: pesos em botões grandes, preço por kg, aviso de peso indisponível, botão "Compartilhar no WhatsApp".
- Carregamento: esqueleto cinza e imagens com lazy loading.
- "Comprar de novo" no carrinho vazio (guarda o último pedido só neste aparelho).
- PWA: `manifest.webmanifest`, `sw.js`, `offline.html`, ícones; Open Graph genérico nas páginas.
- Admin: `css/admin-theme.css` (mesma identidade visual).
- Assistente: opção de ocultar/mostrar o botão.

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
