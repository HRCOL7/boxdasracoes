# Como aplicar a correção de segurança no Supabase

> Faça isto **uma vez**. Não apaga dados. Pode rodar de novo sem problemas (é idempotente).

1. Abra o painel do Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `migrations/20261013000000_security_hardening.sql` e clique **Run**.
3. Rode a conferência (comentário no fim do arquivo). Em `products` devem existir só
   **"Public read"** e **"Admin write"**.
4. **Authentication → Providers → Email → "Confirm email" = LIGADO.**
5. Entre no `/admin/admin.html` e confirme que você ainda consegue editar um produto.
   (Se não conseguir, seu e-mail precisa estar CONFIRMADO e constar em `admin_users`.)
6. O site não tem mais lista de e-mails de admin: quem manda é a função `is_admin()`. Para incluir/remover
   um admin: `insert into public.admin_users(email) values ('novo@email.com');` / `delete ... where email = ...`.
7. Depois aplique também `migrations/20261015000000_site_events_limits.sql` (limites da tabela de eventos).

## O que muda para os clientes
Nada visível. O total do pedido passa a ser calculado pelo banco. Se alguém adulterar o preço
no navegador, o pedido é gravado com o valor correto e a nota ganha um `[AVISO]` para você ver no ERP.

## Testar antes (recomendado)
`tests/security_test.sql` simula cliente, admin e falso admin num banco **de teste**
(Supabase branch ou PostgreSQL local). Esperado: 28 PASS, 0 FAIL.

## Se algo der errado
Cada parte da migração é independente. Para reverter só o gatilho do total:
`drop trigger trg_customer_orders_server_totals on public.customer_orders;`

## Assistente de IA (função `assistant`)

O widget "Ajuda e acessibilidade" (`js/assistant.js`) funciona **sem IA** (comandos simples locais).
Para ligar a IA, publique a função que guarda a chave no servidor — **a chave nunca vai para o site**:

```bash
# 1) instalar e entrar (uma vez)
npm i -g supabase          # ou: npx supabase ...
supabase login
supabase link --project-ref oynglhcquvylyddovyas

# 2) guardar os segredos (a chave vem de console.anthropic.com)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGINS=https://SEU-SITE.netlify.app
supabase secrets set ANTHROPIC_MODEL=claude-haiku-5-5     # opcional

# 3) publicar
supabase functions deploy assistant
```

- Defina um **limite de gasto** no console da Anthropic antes de publicar.
- Limites embutidos: 20 pedidos/min por IP (por instância), corpo ≤ 40 KB, resposta ≤ 600 tokens.
- Teste local da função: `node --experimental-strip-types supabase/functions/assistant/test.mjs`.
- Se a função não existir/falhar, o widget cai sozinho para o modo simples.
