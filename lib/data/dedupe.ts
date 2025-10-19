// lib/data/dedupe.ts
import type { Product } from "@/lib/data/types";

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function productKey(p: Product) {
  // Prioridades de chave únicas reais se existirem
  const k1 =
    (p as any).master_sku || (p as any).global_sku || (p as any).external_sku;
  if (k1) return String(k1).trim();

  // Fallback estável
  return [
    norm((p as any).brand || ""),
    norm(p.name || ""),
    norm((p as any).color || ""),
    norm((p as any).size || ""),
  ].join("|");
}

type Chosen = Product & { store_count?: number; stores?: string[] };

export function dedupeProducts(
  products: Product[],
  opts?: { preferCheapest?: boolean }
): Chosen[] {
  const byKey = new Map<string, Chosen>();

  for (const p of products) {
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
      const priceA = Number((existing as any).price_tag) || 0;
      const priceB = Number((p as any).price_tag) || 0;
      if (priceB < priceA) {
        // troca o card exibido pelo mais barato
        byKey.set(key, {
          ...p,
          store_count: existing.store_count,
          stores: existing.stores,
        });
      }
    }
    // opcional: aqui você poderia preferir a loja mais próxima se já tiver distância calculada
    // if ((p as any).distance_km < (existing as any).distance_km) ...
  }

  return Array.from(byKey.values());
}
