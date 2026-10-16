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
