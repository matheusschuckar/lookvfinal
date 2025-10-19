// lib/data/catalog.ts
import { supabase } from "@/lib/supabaseClient";
import type { Product } from "./types";

/**
 * Estrutura de linha esperada da view `products_with_store_eta`
 */
type CatalogRow = {
  id: number;
  name: string;
  store_name: string;
  photo_url: string[] | string | null;
  price_tag: number;
  category?: string | null;
  gender?: string | null;
  sizes?: string[] | string | null;
  categories?: string[] | string | null;
  store_id?: number | null;
  store_slug?: string | null;
  eta_text?: string | null;
  eta_text_runtime?: string | null;
  eta_display?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  eta_text_default?: string | null;
  eta_text_before_open?: string | null;
  eta_text_after_close?: string | null;
  view_count?: number | null;
  stores?: string[] | null;
};

/**
 * Busca o catálogo na view `products_with_store_eta`.
 * Quando `storeIds` é fornecido, filtra pelos IDs das lojas informadas
 * (usado para exibir apenas a unidade mais próxima por marca).
 */
export async function fetchCatalog(opts?: {
  storeIds?: number[];
  limit?: number;
}): Promise<Product[]> {
  const storeIds = opts?.storeIds ?? [];
  const limit = Math.max(1, Math.min(120, opts?.limit ?? 60));

  let q = supabase.from("products_with_store_eta").select("*").limit(limit);

  if (storeIds.length > 0) {
    q = q.in("store_id", storeIds);
  }

  const { data, error } = await q;

  if (error) {
    console.error("[fetchCatalog] Supabase error:", error);
    return [];
  }

  const rows = Array.isArray(data) ? (data as CatalogRow[]) : [];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    store_name: row.store_name,
    photo_url: row.photo_url,
    price_tag: row.price_tag,

    // categorização
    category: row.category ?? null,
    gender: row.gender ?? null,
    sizes: row.sizes ?? null,
    categories: row.categories ?? null,

    // loja (se vierem)
    store_id: row.store_id ?? null,
    store_slug: row.store_slug ?? null,

    // ETA (todos os possíveis)
    eta_text: row.eta_text ?? null,
    eta_text_runtime: row.eta_text_runtime ?? null,
    eta_display: row.eta_display ?? null,

    // horários/textos da store (se a view expõe)
    open_time: row.open_time ?? null,
    close_time: row.close_time ?? null,
    eta_text_default: row.eta_text_default ?? null,
    eta_text_before_open: row.eta_text_before_open ?? null,
    eta_text_after_close: row.eta_text_after_close ?? null,

    // extras opcionais
    view_count: typeof row.view_count === "number" ? row.view_count : null,

    // aninhado (se a view retornar relation)
    stores: row.stores ?? null,
  })) as Product[];
}
