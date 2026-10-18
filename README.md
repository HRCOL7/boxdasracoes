# Box das Rações

Loja online de rações e produtos para pets. HTML/CSS/JavaScript puro (sem framework), banco e login no
**Supabase**, hospedagem no **Netlify**, integração com o ERP em Python (`erp_connector/`).
Acessibilidade alvo: **WCAG 2.2 AA**. Leia também `CHANGELOG.md` (o que mudou) e `PASSO-A-PASSO.md` (como publicar).

## Rodar no seu computador

Precisa só de Python 3 (ou qualquer servidor de arquivos estáticos).

```bash
python dev_server.py 8000        # Windows também: ./start-server.ps1
# abra http://localhost:8000
```

O site lê `config.js` (URL e chave **anon/pública** do Supabase). No Netlify esse arquivo é gerado no build por
`build-config.js` a partir das variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Nunca coloque a chave
`service_role` nem a chave da Anthropic em arquivos do site.

## Estrutura de pastas

| Pasta / arquivo | Para que serve |
|---|---|
| `index.html`, `products.html`, `product.html` | Páginas da loja |
| `admin/` | Painel do administrador e relatórios |
| `includes/header.html` | Cabeçalho, busca e carrinho compartilhados |
| `css/` | `base` (visual), `mobile`/`desktop` (responsivo), `a11y` (acessibilidade), `assistant` (widget), `admin` |
| `js/a11y.js` | Base de acessibilidade: avisos falados, diálogos com foco preso, preferências do usuário |
| `js/assistant.js` | Assistente "Ajuda e acessibilidade" (chat, voz, ajustes de exibição) |
| `js/supabase-client.js` | Acesso ao Supabase (produtos, configurações, `isAdmin()`) |
| `js/cart.js`, `site-checkout.js`, `products.js`, `product-page.js`, `search.js`, `menu.js`, `carousel.js` | Funcionalidades da loja |
| `config.js` | Configuração pública do Supabase (gerada no build); carregada por `<script src="/config.js">` antes dos demais scripts |
| `supabase/migrations/` | Migrações **novas e atuais** do banco (aplicar em ordem de data) |
| `supabase/tests/` | Testes SQL das migrações |
| `supabase/functions/assistant/` | Função de servidor (Edge Function) que guarda a chave da IA |
| `supabase-*.sql` (raiz) | Scripts antigos de instalação do banco; veja a nota abaixo |
| `erp_connector/` | Conector Python com o ERP (clientes e alerta de preços) |
| `tools/tests/` | Testes de navegador (Playwright) |
| `expo-starter/` | Esqueleto do app mobile (React Native + Expo) |
| `netlify.toml` | Cabeçalhos de segurança, cache e a CSP |

## Banco de dados (Supabase)

Ordem para um banco **novo**: scripts antigos `supabase-*.sql` conforme necessidade, depois
**todas** as migrações de `supabase/migrations/` por ordem de data:

1. `20261013000000_security_hardening.sql` — quem pode alterar o quê, admins (`admin_users` + `is_admin()`),
   total do pedido recalculado no servidor.
2. `20261015000000_site_events_limits.sql` — limites de tamanho e de frequência para as estatísticas do site.

Detalhes e conferências em `supabase/README.md`. Quem é administrador é decidido **só** pelo banco: para
adicionar/remover, use `insert/delete` na tabela `admin_users` (o e-mail precisa estar confirmado).

## Testes

**Banco (PostgreSQL de teste, nunca produção):**

```bash
psql -d SEU_BANCO_DE_TESTE -f supabase/tests/security_test.sql      # esperado: 28 passaram
psql -d SEU_BANCO_DE_TESTE -f supabase/tests/site_events_test.sql   # esperado: 22 passaram
```

**Navegador (Python + Playwright):**

```bash
pip install playwright && playwright install chromium
python tools/tests/a11y_test.py .          # 29 checagens de acessibilidade
python tools/tests/desktop_cart_test.py .  # carrinho no desktop
python tools/tests/assistant_test.py .     # assistente (32 checagens, inclui ocultar/mostrar o botão)
python tools/tests/audit.py .              # auditoria: contraste, nomes, rótulos, alvos de toque (esperado: 0 problemas)
python tools/tests/csp_test.py . tools/tests/csp.txt   # carrega as páginas COM a CSP e conta violações (esperado: 0)
```

Estes testes substituem o axe-core onde a rede não alcança; no seu PC rode também o **Lighthouse**
(Chrome → F12 → Lighthouse → Accessibility) e a extensão **axe DevTools**, e teste só com o teclado (Tab, Enter, Esc).
Sintaxe do JavaScript: `for f in js/*.js; do node --check $f; done`.

## Assistente "Ajuda e acessibilidade"

Botão no canto da tela (todas as páginas da loja). Abre um painel com:

- **Ajuste de exibição:** tamanho do texto, contraste, espaçamento, letra mais legível, links sublinhados, menos movimento
  (guardado no navegador; também respeita `prefers-reduced-motion` e `prefers-contrast` do sistema).
- **Chat:** busca produtos, abre o carrinho, lê a página e muda os ajustes de exibição. Aceita voz (botão "Falar")
  e pode ler as respostas em voz alta.
- **Dois modos.** *Sem IA:* entende comandos simples por regras locais. *Com IA:* se a função `assistant` estiver
  publicada (`supabase/README.md`, seção "Assistente de IA"), as mensagens vão para ela; a **chave da Anthropic fica só
  no servidor**. Se a função falhar, o assistente volta sozinho ao modo simples.
- **Limites de segurança:** o assistente só tem 5 ferramentas fixas (buscar, navegar, ajustar exibição, ler página,
  abrir carrinho); não finaliza compra nem acessa dados pessoais. Respostas são mostradas como texto, nunca como HTML.

Um assistente **não substitui** o código acessível do site; ele complementa.

## Segurança (resumo)

- Políticas RLS: só administrador confirmado altera produtos; cliente só vê os próprios pedidos.
- Preço e total do pedido são recalculados no banco; tentativas de adulteração são anotadas no pedido.
- `netlify.toml` define cabeçalhos de segurança e uma **CSP em modo relatório** (não bloqueia). Para ativar de verdade:
  navegue por todas as páginas com o console aberto (F12); se não aparecer nenhum aviso "[Report Only]", troque
  `Content-Security-Policy-Report-Only` por `Content-Security-Policy` em `netlify.toml` e publique.
- `erp_connector/backups/` não deve ir para o Git (veja `.gitignore`).

## Observações

- Nada neste repositório é publicado automaticamente; o deploy no Netlify e as migrações no Supabase são passos manuais.
- Os scripts `.ps1` em `tools/` são verificações básicas para Windows (sintaxe JS e links locais).
