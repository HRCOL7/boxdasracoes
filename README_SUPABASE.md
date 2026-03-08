Supabase Integration - Quickstart
================================

1) Criar tabela `products` (SQL)

Abra o SQL Editor no dashboard do Supabase e rode:

```sql
create table if not exists public.products (
  id bigint primary key,
  name text not null,
  description text,
  price numeric,
  "group" text,
  subgroup text,
  brand text,
  internal text,
  garantia_raw text,
  garantia text,
  variants jsonb,
  images jsonb,
  image text,
  image_illustrative boolean default false,
  video text,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- index for text search on name and group
create index if not exists idx_products_name_group on public.products using gin (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce("group",'')));
```

2) Criar bucket de Storage (por exemplo `product-media`) no painel Storage do Supabase

3) Chaves
- Para leitura pública em clientes: use a `anon` key (cuidado com permissões de escrita).
- Para importação em massa (script server-side) use `service_role` (mantenha seguro, não commitá-lo).

4) Políticas (RLS)
- Habilite RLS na tabela `products` e crie políticas específicas para permitir que apenas usuários autenticados com a role `admin` escrevam/editem/excluam. (Veja docs Supabase RLS)

5) Migrar dados (exemplo de script Node.js está em `scripts/import_to_supabase.js`).

6) Front-end
- Incluir o cliente supabase (CDN) e o arquivo `js/supabase-client.js` (criado aqui). Configure `window.SUPABASE_CONFIG = { url:'...', anonKey: '...' }` antes de carregar o script (não coloque `service_role` no cliente).

7) Segurança
- Não coloque `service_role` no front-end. Use funções serverless (Edge/Netlify/Fn) se precisar de operações seguras.

8) Observações
- Recomendo migrar imagens para Storage e salvar apenas URLs (evitar data:URLs no DB).

9) Projeto já existente com schema diferente
- Se sua tabela `products` já existe com `id` em UUID ou sem colunas como `brand/group/subgroup`, rode a migração pronta em `supabase-migration-align-products.sql` no SQL Editor.
- Essa migração preserva UUID antigo em `legacy_uuid`, converte o PK para `bigint` (compatível com o admin atual), adiciona colunas faltantes e ajusta RLS/publication.

10) Sincronizar banners/marcas entre dispositivos
- Rode o script `supabase-site-settings-setup.sql` no SQL Editor.
- Esse script cria a tabela `public.site_settings` (linha única `id=1`) com payload JSON para:
  - `banners`
  - `brands`
  - `categories`
  - `whatsappIncludeCustomerData`
- O site continua com fallback local, mas quando a tabela existe, desktop e celular passam a compartilhar as mesmas configurações do painel admin.
