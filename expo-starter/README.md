# Box das Rações — app (React Native + Expo)

Esqueleto para você **construir o app por conta própria**. A parte "encanamento" (conexão com o
Supabase, tipos, cores, busca de dados) já está pronta; as **telas são exercícios** com dicas.
Quando travar, peça ajuda ao Claude: "me dá uma dica do Exercício 2" (ou "faz pra mim").

## 1. Preparar o projeto (uma vez)

No terminal, numa pasta de sua escolha (fora do OneDrive, se puder):

```bash
npx create-expo-app@latest boxdasracoes-app
cd boxdasracoes-app
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

Depois copie **para dentro de `boxdasracoes-app`** o conteúdo desta pasta (`src/`, `app/`, `solutions/`, `.env.example`).
Se o template já trouxe uma pasta `app/`, pode substituir os arquivos (ou apagar os exemplos dele).

```bash
copy .env.example .env      # Windows (PowerShell: Copy-Item .env.example .env)
```
Abra o `.env` e cole a **anon key** (a mesma `anonKey` que está no `config.js` do site). Nunca use a `service_role`.

Rodar: `npx expo start` → abra o app **Expo Go** no celular e leia o QR code.

## 2. Roadmap (faça na ordem)

| # | Exercício | Arquivo | O que você aprende |
|---|-----------|---------|--------------------|
| 1 | Preço real do produto + formatar em reais | `src/lib/price.ts` | funções puras, TypeScript, teste (`npx tsx src/lib/price.test.ts`) |
| 2 | Lista de produtos | `app/index.tsx` | useState, useEffect, FlatList, loading/erro |
| 3 | Cartão de produto acessível | `src/components/ProductCard.tsx` | componentes, props, acessibilidade |
| 4 | Detalhe do produto | `app/product/[id].tsx` | rotas com parâmetro, variantes |
| 5 | Carrinho (Context + AsyncStorage) | crie `src/context/CartContext.tsx` | estado global, persistência |
| 6 | Login (Supabase Auth) | crie `app/login.tsx` | `supabase.auth.signInWithPassword`, sessão |
| 7 | Finalizar pedido | crie `src/services/orders.ts` | `insert` em `customer_orders` |

**Sobre o Exercício 7:** o banco **recalcula o total sozinho** (migração de segurança do site), então o app
só envia `items: [{ productId, variantIndex, qty }]`. Não confie no preço do app — e você não precisa.

### Dicas rápidas dos exercícios 5–7
- **5:** `createContext` + um `Provider` com `items`, `add(product, variantIndex)`, `remove`, `total`. Salve no
  AsyncStorage dentro de um `useEffect` quando `items` mudar; leia ao iniciar.
- **6:** `const { error } = await supabase.auth.signInWithPassword({ email, password })`. Campos com
  `accessibilityLabel`, `secureTextEntry` na senha, `autoComplete="email"`/`"password"` e mensagem de erro
  falada pelo leitor (`accessibilityLiveRegion="polite"` no Android, `AccessibilityInfo.announceForAccessibility` no iOS).
- **7:** `supabase.from('customer_orders').insert({ items, payment: 'PIX' })`. O servidor preenche cliente, total e status.

## 3. Acessibilidade no app (checklist por tela)
- Todo botão/ícone tem `accessibilityLabel` e `accessibilityRole`.
- Alvo de toque ≥ 48 (`MIN_TOUCH` em `src/theme.ts`).
- Não use **só cor** para informar (ex.: "indisponível" também em texto).
- Teste com o leitor de tela ligado: **TalkBack** (Android) ou **VoiceOver** (iOS) e com fonte grande nas configurações do celular
  (use `allowFontScaling`, o padrão; evite alturas fixas em textos).
- Títulos de tela com `accessibilityRole="header"`.

## 4. Segurança
- A chave `anon` é pública por natureza; quem protege os dados são as **políticas RLS** do banco (migração
  `supabase/migrations/20261013000000_security_hardening.sql` do site — aplique antes de publicar o app).
- Nunca coloque senhas, `service_role` ou a chave da Anthropic no app.

## 5. Pasta `solutions/`
Resolução do Exercício 1. Só abra **depois** de tentar.
