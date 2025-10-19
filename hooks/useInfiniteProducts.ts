// hooks/useInfiniteProducts.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/data/types";
import { fetchProductsPageByOffset } from "@/lib/data/productsInfinite";

export function useInfiniteProducts() {
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(0); // página atual (offset)
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // evita chamadas duplas em StrictMode e múltiplos observers
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading || inFlight.current || !hasMore) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const {
        items: pageItems,
        hasMore: more,
        nextPage,
      } = await fetchProductsPageByOffset(page);

      // protege contra duplicados
      setItems((prev) => {
        const known = new Set(prev.map((p) => String(p.id)));
        const merged = [
          ...prev,
          ...pageItems.filter((p) => !known.has(String(p.id))),
        ];
        return merged;
      });

      setHasMore(more);
      if (nextPage != null) setPage(nextPage);
    } catch (e: any) {
      console.error("[useInfiniteProducts] load error:", e?.message || e);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [page, hasMore, loading]);

  // primeira página
  useEffect(() => {
    if (items.length === 0) {
      // não depende de nada além do estado local
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper para resetar quando necessário (ex.: filtros server-side no futuro)
  const reset = useCallback(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
  }, []);

  return { items, hasMore, loading, error, loadMore, reset };
}
