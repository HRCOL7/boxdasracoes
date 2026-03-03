README — Upload & Test (product-media)
=====================================

Objetivo
-------
Instruções passo-a-passo para criar o bucket `product-media`, aplicar as policies SQL e testar uploads end‑to‑end usando o Admin UI do site.

Pré-requisitos
--------------
- Ter acesso de admin ao projeto Supabase.
- Ter o site rodando (local ou deploy no Netlify) com `config.js` apontando para seu projeto Supabase.

1) Criar bucket `product-media` (UI)
-------------------------------------------------
- Acesse Supabase → Storage → New bucket.
- Nome: `product-media` (exatamente este nome).
- Toggle: marque **Public** (recomendado para simplificar o uso no frontend).
- Clique **Create**.

2) Aplicar SQL de suporte (tables + policies)
-------------------------------------------------
- Abra Supabase → SQL Editor → New query.
- Cole e execute os conteúdos de:
  - `supabase-setup.sql` (cria tabela `public.products`, índices, publica para realtime e configura RLS básicas)
  - `supabase-storage-setup.sql` (policies para `storage.objects`)
- Confirme que as queries executaram sem erros.

3) Teste rápido via painel Storage
-------------------------------------------------
- Storage → Buckets → `product-media` → Upload files → selecione 1 imagem → Upload.
- Clique no item recém enviado → **Copy Public URL** → Cole em nova aba do navegador. A imagem deve abrir.

4) Teste end-to-end pelo Admin UI do site
-------------------------------------------------
- Abra o Admin UI do seu site.
- Faça login com o usuário admin (via Supabase Auth).
- No formulário de produto: escolha um arquivo de imagem (input de arquivo), preencha `name` e `price` e clique **Salvar**.
- Abra DevTools (F12):
  - Console: verifique mensagens sobre `supa.uploadFile` e `Supabase upsert`.
  - Network: verifique requisições para Storage (upload) e para a tabela `products` (upsert/insert).
- Verifique no Supabase → Table Editor → `public.products` se o produto foi criado.
- Verifique em Storage → `product-media` se o objeto foi criado.

5) Se o upsert for bloqueado (erros comuns)
-------------------------------------------------
- Certifique-se de ter feito login via Supabase (usuário autenticado): políticas RLS padrão permitem escrita apenas para `auth.role() = 'authenticated'`.
- Se preferir permitir escrita anônima (não recomendado), adapte as policies em `public.products` para aceitar `auth.role() = 'anon'` — atenção: risco de abuso.

6) Logs e dados úteis para depuração
-------------------------------------------------
Se algo falhar, copie e envie:
- Erro exato do Console (mensagem e stack) no DevTools.
- Response/Body da requisição de upsert (Network → clicar request → Response).
- Se upload criou arquivo em Storage mas o produto não foi criado, cole a Public URL do objeto e a resposta do upsert.

7) Redeploy após editar frontend
-------------------------------------------------
Se você fizer alterações no código do frontend e quiser publicar no Netlify:
```bash
netlify deploy --prod --dir .
```

8) Observações de segurança
-------------------------------------------------
- Não exponha `service_role` no frontend.
- Para uploads privados (bucket privado), implemente geração de signed URLs em um backend seguro e atualize o frontend para usar `createSignedUrl` / `getSignedUrl` conforme necessário.

9) Próximos passos sugeridos
-------------------------------------------------
- Se quiser, posso:
  - Atualizar o frontend para mostrar status/erros mais claros durante upload/upsert.
  - Implementar flow com bucket privado + endpoint serverless para assinar uploads.

Fim
