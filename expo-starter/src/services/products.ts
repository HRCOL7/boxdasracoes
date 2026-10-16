import { supabase } from '../lib/supabase';
import type { Product } from '../types/product';

const PAGE_SIZE = 20;

// Busca uma "página" de produtos. Quem chama controla qual página quer (0, 1, 2...).
export async function fetchProducts(page = 0, search = ''): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const term = search.trim();
  if (term) query = query.ilike('name', `%${term}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

export async function fetchProduct(id: number): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Product) ?? null;
}
