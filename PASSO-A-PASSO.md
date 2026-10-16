# Passo a passo para colocar tudo no ar (faça na ordem, com calma)

1. **Backup:** no Supabase, Project Settings → Database → Backups (ou exporte as tabelas products e customer_orders).
2. **Migração de segurança:** Supabase → SQL Editor → New query → cole `supabase/migrations/20261013000000_security_hardening.sql` → Run.
   Conferência: rode a consulta que está no final do arquivo.
2b. **Segunda migração:** cole e rode `supabase/migrations/20261015000000_site_events_limits.sql` (limites das estatísticas).
3. **Authentication → Providers → Email → "Confirm email" = ligado.**
4. **Teste:** entre no admin com o seu e-mail (confirmado) e edite um produto; entre com uma conta de cliente e confira que não edita.
5. **Git:** `git rm -r --cached erp_connector/backups` e depois commit (os backups não devem ir para o repositório).
6. **Netlify:** confira as variáveis de ambiente do `build-config.js`; faça o deploy da pasta.
7. **Assistente com IA (opcional):** siga "Assistente de IA" em `supabase/README.md` (precisa de chave da Anthropic e limite de gasto).
   Sem isso o widget continua funcionando no modo simples.
7b. **CSP:** no site publicado, abra o console (F12) navegando por todas as páginas (inclusive admin e checkout). Sem avisos "[Report Only]"? Troque `Content-Security-Policy-Report-Only` por `Content-Security-Policy` no `netlify.toml`.
8. **Teste no PC:** Chrome → F12 → Lighthouse → Accessibility; e a extensão axe DevTools. Teste só com teclado (Tab/Enter/Esc).
9. **App:** siga `expo-starter/README.md`.
