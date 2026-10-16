import type { Product } from '../src/types/product';

const normalizeWeight = (w: string) => w.toLowerCase().replace(/\s+/g, '').replace(',', '.');

export function getUnitPrice(product: Product, variantIndex = 0): number {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variant = variants[variantIndex];
  const base = variant ? Number(variant.price) || 0 : Number(product.price) || 0;

  if (!product.is_promo) return base;
  if (product.promo_price && product.promo_price > 0) return product.promo_price;

  if (variant && product.promo_variants) {
    const wanted = normalizeWeight(variant.weight);
    for (const [weight, value] of Object.entries(product.promo_variants)) {
      if (normalizeWeight(weight) === wanted && Number(value) > 0) return Number(value);
    }
  }
  return base;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
