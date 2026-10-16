// Teste simples, sem biblioteca: rode com  npx tsx src/lib/price.test.ts
import { getUnitPrice, formatBRL } from './price';
import type { Product } from '../types/product';

let falhas = 0;
function esperar(nome: string, recebido: unknown, esperado: unknown) {
  const ok = recebido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${ok ? '' : ` (recebeu ${recebido}, esperava ${esperado})`}`);
}

const racao: Product = { id: 1, name: 'Ração', variants: [{ weight: '15 kg', price: 200 }, { weight: '1 kg', price: 20 }] };
esperar('variante 0', getUnitPrice(racao, 0), 200);
esperar('variante 1', getUnitPrice(racao, 1), 20);
esperar('sem variantes usa price', getUnitPrice({ id: 2, name: 'x', price: 9.9 }), 9.9);
esperar('sem nada = 0', getUnitPrice({ id: 3, name: 'x' }), 0);
esperar('promo_price vence', getUnitPrice({ ...racao, is_promo: true, promo_price: 150 }, 0), 150);
esperar('promo por peso (10,1 KG == 10.1kg)', getUnitPrice({ id: 4, name: 'x', variants: [{ weight: '10.1kg', price: 120 }], is_promo: true, promo_variants: { '10,1 KG': 99 } }, 0), 99);
esperar('promo sem valor cai no base', getUnitPrice({ ...racao, is_promo: true }, 1), 20);
esperar('formatBRL', formatBRL(1234.5).replace(/ /g, ' '), 'R$ 1.234,50');

console.log(falhas === 0 ? '\nTudo certo!' : `\n${falhas} teste(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
