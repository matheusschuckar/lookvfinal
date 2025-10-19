// lib/data/dedupe.ts
import type { Product } from "@/lib/data/types";

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

type ProductExtended = Product & {
  master_sku?: string | null;
  global_sku?: string | null;
  external_sku?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  price_tag?: number | null;
  distance_km?: number | null;
};

function productKey(p: ProductExtended): string {
  // Prioridades de chave únicas reais se existirem
  const k1 = p.master_sku || p.global_sku || p.external_sku;
  if (k1) return String(k1).trim();

  // Fallback estável
  return [
    norm(p.brand || ""),
    norm(p.name || ""),
    norm(p.color || ""),
    norm(p.size || ""),
  ].join("|");
}

type Chosen = Product & { store_count?: number; stores?: string[] };

export function dedupeProducts(
  products: Product[],
  opts?: { preferCheapest?: boolean }
): Chosen[] {
  const byKey = new Map<string, Chosen>();

  for (const prod of products) {
    const p = prod as ProductExtended;
    const key = productKey(p);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { ...p, store_count: 1, stores: [p.store_name] });
      continue;
    }

    // agrega contagem e lojas
    existing.store_count = (existing.store_count || 1) + 1;
    existing.stores = [...new Set([...(existing.stores || []), p.store_name])];

    // critério de escolha
    const preferCheapest = opts?.preferCheapest ?? true;

    if (preferCheapest) {
      const priceA = Number(existing.price_tag) || 0;
      const priceB = Number(p.price_tag) || 0;
      if (priceB < priceA) {
        // troca o card exibido pelo mais barato
        byKey.set(key, {
          ...p,
          store_count: existing.store_count,
          stores: existing.stores,
        });
      }
    }

    // opcional: poderia comparar distance_km se desejado
    // if ((p.distance_km ?? Infinity) < (existing.distance_km ?? Infinity)) ...
  }

  return Array.from(byKey.values());
}
