# BOXDASRACOES

Projeto exportado localmente.

## Fluxo ativo (produção/desenvolvimento)

Páginas principais em uso:

- `index.html`
- `products.html`
- `product.html`
- `admin/admin.html`

Servidor local:

- `./start-server.ps1`

## Arquivos legados

Os arquivos abaixo são legados e não fazem parte do fluxo ativo atual:

- `_root.html`
- `_root127.html`

Eles foram mantidos apenas para referência histórica e podem conter referências antigas de scripts/estilos.

## Verificação segura (sem alterar lógica/layout)

Para rodar uma varredura básica de saúde do projeto:

- `./tools/health-check.ps1`

Para validar links/assets locais das páginas ativas:

- `./tools/active-link-check.ps1`

Para mapear código potencialmente não utilizado (diagnóstico estático):

- `./tools/dead-code-scan.ps1`

Esse script só valida sintaxe JS, páginas principais e assets locais essenciais.
