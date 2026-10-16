import type { Product } from '../types/product';

/**
 * EXERCÍCIO 1 — preço que o cliente realmente paga.
 *
 * Regras (são as mesmas do site e do banco de dados):
 *  1. base = preço da variante escolhida (variants[variantIndex].price);
 *     se o produto não tem variantes, base = product.price (ou 0).
 *  2. Se NÃO é promoção (is_promo falso) → devolve base.
 *  3. Se é promoção e promo_price > 0 → devolve promo_price.
 *  4. Se é promoção e existe promo_variants[peso] > 0 para o peso da variante → devolve esse valor.
 *     (compare pesos sem espaços/maiúsculas e com vírgula = ponto: "10,1 KG" == "10.1kg")
 *  5. Caso contrário → base.
 *
 * Dica: comece pelo caso mais simples (regras 1 e 2) e rode o teste: `npx tsx src/lib/price.test.ts`.
 * Travou? Compare com solutions/price.ts DEPOIS de tentar.
 */
export function getUnitPrice(product: Product, variantIndex = 0): number {
  // TODO: implemente aqui
  return 0;
}

export function formatBRL(value: number): string {
  // Dica: Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  // TODO: implemente aqui
  return String(value);
}
