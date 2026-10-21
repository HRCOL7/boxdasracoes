# Maintenance Notes

Este documento descreve práticas de manutenção com **risco zero de alteração funcional**.

## Objetivo

Padronizar uma rotina inicial de auditoria sem mexer em layout, lógica de negócio ou UX.

## Escopo ativo

Considere como escopo principal:

- `index.html`
- `products.html`
- `product.html`
- `admin/admin.html`

## Rotina sugerida

1. Rodar `./tools/health-check.ps1`.
2. Rodar `./tools/active-link-check.ps1`.
3. Rodar `./tools/dead-code-scan.ps1`.
4. Confirmar status HTTP 200 das páginas principais.
5. Revisar possíveis warnings, links quebrados e itens potencialmente sem uso.
6. Só depois planejar refactors pontuais.

## Regras de segurança para manutenção

- Não alterar HTML/CSS/JS de produção sem necessidade explícita.
- Toda melhoria deve manter comportamento visual e funcional existente.

## Capacidade: muitos acessos ao mesmo tempo

- **O site em si (HTML/CSS/JS/imagens)** fica no Netlify, que entrega por CDN: aguenta milhares de acessos simultâneos sem ajuste.
- **O gargalo é o Supabase** (catálogo, login, pedidos). Medidas já aplicadas no código:
  - o catálogo fica guardado no aparelho por 5 minutos (antes era baixado a cada página aberta);
  - o catálogo é baixado em páginas de 1000 produtos (antes 200), ou seja, 5x menos chamadas;
  - a busca não vai ao servidor a cada tecla: usa a lista local;
  - a busca só consulta o servidor de novo se não achar nada e a lista tiver mais de 2 minutos.
- **O que você precisa conferir no painel do Supabase (Settings → Billing / Compute):** o plano gratuito é pequeno. Para uma loja com picos de 1000+ pessoas, use o plano Pro e, se notar lentidão, aumente o "Compute" (Small ou Medium). Em Database → Reports, acompanhe CPU e conexões.
- Teste de carga real (k6 ou Artillery) deve ser feito por você contra o seu projeto, de preferência fora do horário de pico, porque depende do plano contratado.
- Próximo passo se crescer mais: servir uma cópia do catálogo como arquivo estático no Netlify (gerada a cada sincronização do ERP), tirando quase toda a carga de leitura do Supabase.
