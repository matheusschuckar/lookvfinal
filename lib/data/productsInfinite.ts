// lib/data/productsInfinite.ts
import type { Product } from "@/lib/data/types";
import { fetchCatalog } from "@/lib/data/catalog";
// Se você quiser trocar para consulta direta no Supabase depois, podemos.
// Por agora, usamos o mesmo caminho aprovado pelo seu app para garantir compat.

const PAGE_SIZE = 24;

// cache em memória para a sessão do browser
let _catalogCache: Product[] | null = null;

async function getCatalogOnce(): Promise<Product[]> {
  if (_catalogCache) return _catalogCache;
  // chama o mesmo fetchCatalog que sua Home sempre usou
  const data = await fetchCatalog();
  _catalogCache = Array.isArray(data) ? data : [];
  return _catalogCache;
}

export type PageResult = {
  items: Product[];
  hasMore: boolean;
  nextPage: number | null;
};

/**
 * Paginação simples por offset em cima do catálogo conhecido.
 * Objetivo: restaurar a Home agora, sem mexer em RLS/joins.
 * Depois migramos para SQL keyset filtrando no servidor.
 */
export async function fetchProductsPageByOffset(page: number): Promise<PageResult> {
  const catalog = await getCatalogOnce();
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = catalog.slice(start, end);

  return {
    items: slice,
    hasMore: end < catalog.length,
    nextPage: end < catalog.length ? page + 1 : null,
  };
}
