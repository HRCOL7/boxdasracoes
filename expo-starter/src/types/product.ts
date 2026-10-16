// Formato da tabela "products" do Supabase (o mesmo usado pelo site).
export type Variant = {
  weight: string;          // ex.: "15 kg"
  price: number;
  is_unavailable?: boolean;
};

export type Product = {
  id: number;
  name: string;
  group?: string | null;       // ex.: "Rações"
  subgroup?: string | null;    // ex.: "Cães"
  brand?: string | null;
  price?: number | null;       // preço simples (quando não há variantes)
  variants?: Variant[] | null;
  is_promo?: boolean | null;
  promo_price?: number | null;
  promo_variants?: Record<string, number> | null; // { "15 kg": 99.9 }
  is_unavailable?: boolean | null;
  image?: string | null;
  images?: string[] | null;
};
