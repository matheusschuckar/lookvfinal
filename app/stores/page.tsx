"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type StoreCard = {
  id: number; // ← agora obrigatório
  name: string;
  slug: string; // slug + id, garantidamente único
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Monta nome exibido combinando brand + store quando fizer sentido. */
function displayStoreName(row: {
  store_name?: string | null;
  brand_name?: string | null;
  city?: string | null;
}) {
  const store = (row.store_name ?? "").trim();
  const brand = (row.brand_name ?? "").trim();

  if (brand && store) {
    const starts = store.toLowerCase().startsWith(brand.toLowerCase());
    return starts ? store : `${brand} ${store}`; // p.ex. "Austral Iguatemi"
  }
  // fallback: tenta city para diferenciar
  if (!store && brand && row.city) return `${brand} ${row.city}`;
  return store || brand || "Loja";
}

/** Busca TODAS as lojas do usuário via RPC. */
async function fetchAllStoresForUser(): Promise<StoreCard[]> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase.rpc("all_stores_for_user", {
    p_user_id: uid,
  });
  if (error) {
    console.warn("[stores] all_stores_for_user error:", error.message);
    return [];
  }

  const list: StoreCard[] = (data ?? [])
    .map((r: any): StoreCard | null => {
      const id = Number(r.store_id);
      if (!id) return null;
      const name = displayStoreName({
        store_name: r.store_name,
        brand_name: r.brand_name,
        city: r.city,
      });
      const base = slugify(name || `store-${id}`);
      return {
        id,
        name,
        slug: `${base}-${id}`, // ← slug único (evita colisões)
      };
    })
    .filter((s: StoreCard | null): s is StoreCard => !!s)
    .sort((a: StoreCard, b: StoreCard) => a.name.localeCompare(b.name));

  return list;
}

/** Fallback: lista nomes únicos vindos de products (guest/sem perfil). */
async function fetchStoresFromProducts(): Promise<StoreCard[]> {
  const { data, error } = await supabase
    .from("products")
    .select("store_name, store_id")
    .eq("is_active", true);

  if (error) throw error;

  // mantém POR ID; se não houver id em products, cria um hash simples do nome
  const seen = new Set<number | string>();
  const list: StoreCard[] = [];

  for (const r of data ?? []) {
    const name = String(r.store_name || "").trim();
    if (!name) continue;

    const id: number | string =
      typeof r.store_id === "number" && r.store_id
        ? r.store_id
        : `name-${name}`; // evita perder lojas no fallback sem id

    if (seen.has(id)) continue;
    seen.add(id);

    const base = slugify(name);
    list.push({
      id:
        typeof id === "number"
          ? id
          : Math.abs(base.split("").reduce((a, c) => a + c.charCodeAt(0), 0)), // só para key estável
      name,
      slug: `${base}-${id}`,
    });
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export default function StoresPage() {
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 1) Tenta via RPC (todas as lojas do usuário)
        const listFromRpc = await fetchAllStoresForUser();
        if (listFromRpc.length > 0) {
          setStores(listFromRpc);
          return;
        }
        // 2) Fallback
        const fallback = await fetchStoresFromProducts();
        setStores(fallback);
      } catch (e: any) {
        setErr(e?.message ?? "Não foi possível carregar as lojas");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="bg-white text-black max-w-md mx-auto min-h-[100dvh] px-5 pb-28">
      <div className="pt-6 flex items-center justify-between">
        <h1 className="text-[28px] leading-7 font-bold tracking-tight">
          Lojas
        </h1>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition
                     bg-transparent text-[#141414] border-[#141414] hover:bg-[#141414]/10"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            stroke="currentColor"
            fill="none"
          >
            <path
              d="M15 18l-6-6 6-6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Voltar
        </Link>
      </div>

      {err && <p className="mt-4 text-sm text-red-600">Erro: {err}</p>}
      {loading && <p className="mt-4 text-sm text-gray-600">Carregando…</p>}
      {!loading && stores.length === 0 && (
        <p className="mt-8 text-sm text-gray-600">Nenhuma loja encontrada.</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        {stores.map((s) => (
          <Link
            key={s.slug} // agora único por conta do "-id"
            href={`/stores/${s.slug}?n=${encodeURIComponent(s.name)}&sid=${
              s.id
            }`}
            title={s.name}
            className="group rounded-2xl border h-28 transition
                       bg-[#141414] border-[#141414]
                       hover:shadow-md hover:-translate-y-0.5 flex items-center justify-center px-3"
          >
            <div className="text-center text-white">
              <div className="text-[15px] font-semibold line-clamp-2">
                {s.name}
              </div>
              <div
                className="mt-2 inline-flex items-center gap-1 px-3 h-7 rounded-full border text-[11px] font-medium transition"
                style={{
                  backgroundColor: "transparent",
                  borderColor: "white",
                  color: "white",
                }}
              >
                Ver peças
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  style={{ stroke: "white" }}
                >
                  <path
                    d="M9 18l6-6-6-6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
