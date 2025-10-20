"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

// ===== Tipagens =====
type GridFilter = { featured?: boolean; category?: string };

export type Block =
  | { type: "hero"; image?: string; title?: string; subtitle?: string; show_text?: boolean }
  | { type: "bio" }
  | { type: "category_menu"; source?: "product_categories" | "custom"; items?: string[] }
  | { type: "grid"; rows: number; cols: number; filter?: GridFilter }
  | { type: "banner"; image: string; title?: string; subtitle?: string; href?: string };

export type StoreLayout = { blocks?: Block[] } | null;

export type Store = {
  id: number;
  slug: string | null;
  store_name: string;
  bio: string | null;
  address: string | null;
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  layout: StoreLayout;
};

export type Product = {
  id: number;
  name: string;
  store_name: string | null;
  photo_url: string[] | string | null;
  eta_text: string | null;
  price_tag: number;
  category?: string | null;
  gender?: "male" | "female" | "unisex" | null;
  sizes?: string[] | string | null;
  featured?: boolean | null;
  store_id?: number | null;
};

// ===== Utils =====
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function toSizeList(sizes: Product["sizes"]): string[] {
  if (!sizes) return [];
  const raw = Array.isArray(sizes) ? sizes.join(",") : String(sizes);
  return raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}
function firstImage(x: Product["photo_url"]): string {
  return Array.isArray(x) ? x[0] ?? "" : (x ?? "");
}

export default function StorePage() {
  const { slug } = useParams<{ slug: string | string[] }>();
  const search = useSearchParams();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const selectedGenders = useState<Set<"male" | "female">>(new Set())[0];
  const selectedSizes = useState<Set<string>>(new Set())[0];
  const selectedCategories = useState<Set<string>>(new Set())[0];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setErr(null);
        setLoading(true);

        // Normaliza slug e lê sid (id vindo da listagem)
        const param = Array.isArray(slug) ? String(slug[0] ?? "") : String(slug ?? "");
        const safeSlug = decodeURIComponent(param).trim().toLowerCase();
        const sidParam = search.get("sid");
        const sid = sidParam && /^\d+$/.test(sidParam) ? Number(sidParam) : null;

        // Tenta achar a store — ordem: por id, por id no final do slug, por slug/nome
        let found: Store | null = null;

        // 1) por id da query
        if (sid) {
          const { data, error } = await supabase
            .from("stores")
            .select(
              "id, slug, store_name, bio, address, hero_image_url, hero_title, hero_subtitle, layout"
            )
            .eq("id", sid)
            .maybeSingle<Store>();
          if (error) throw error;
          if (data) found = data;
        }

        // 2) se não achou, tenta extrair "-{id}" do fim do slug
        if (!found) {
          const m = safeSlug.match(/-(\d+)$/);
          if (m) {
            const idFromSlug = Number(m[1]);
            if (!Number.isNaN(idFromSlug)) {
              const { data, error } = await supabase
                .from("stores")
                .select(
                  "id, slug, store_name, bio, address, hero_image_url, hero_title, hero_subtitle, layout"
                )
                .eq("id", idFromSlug)
                .maybeSingle<Store>();
              if (error) throw error;
              if (data) found = data;
            }
          }
        }

        // 3) por slug (sem o sufixo -id) e por store_name aproximado
        if (!found) {
          const baseSlug = safeSlug.replace(/-\d+$/, ""); // remove -id se houver
          const { data: bySlug, error: slugErr } = await supabase
            .from("stores")
            .select(
              "id, slug, store_name, bio, address, hero_image_url, hero_title, hero_subtitle, layout"
            )
            .ilike("slug", baseSlug)
            .maybeSingle<Store>();
          if (slugErr) throw slugErr;
          if (bySlug) {
            found = bySlug;
          } else {
            const likePattern = `%${baseSlug.replace(/-/g, "%")}%`;
            const { data: approxRows, error: approxErr } = await supabase
              .from("stores")
              .select(
                "id, slug, store_name, bio, address, hero_image_url, hero_title, hero_subtitle, layout"
              )
              .ilike("store_name", likePattern)
              .limit(20);
            if (approxErr) throw approxErr;
            if (approxRows && approxRows.length) {
              const exact = approxRows.find((r) => slugify(r.store_name) === baseSlug);
              found = (exact ?? approxRows[0]) as Store;
            }
          }
        }

        if (!found) throw new Error("Loja não encontrada");

        // Carrega produtos: por store_id OU store_name; aceita is_active true ou null
        const { data: prodRows, error: prodErr } = await supabase
          .from("products")
          .select(
            "id, name, store_name, store_id, photo_url, eta_text, price_tag, category, gender, sizes, featured"
          )
          .or("is_active.is.true,is_active.is.null")
          .or([`store_id.eq.${found.id}`, `store_name.eq.${found.store_name}`].join(","))
          .limit(1000);
        if (prodErr) throw prodErr;

        if (!cancelled) {
          setStore(found);
          setProducts((prodRows ?? []) as Product[]);
        }
    } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (!cancelled) setErr(msg || "Erro ao carregar");
} finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, search]);

  const categoryOptions = useMemo(() => {
    const s = new Set(products.map((p) => (p.category || "").toLowerCase()).filter(Boolean));
    return Array.from(s).sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategories.size > 0) {
        const pc = (p.category || "").toLowerCase();
        if (!pc || !selectedCategories.has(pc)) return false;
      }
      if (selectedGenders.size > 0) {
        const g = (p.gender || "").toLowerCase();
        if (!g || !selectedGenders.has(g as "male" | "female")) return false;
      }
      if (selectedSizes.size > 0) {
        const list = toSizeList(p.sizes);
        if (!list.length || !list.some((s) => selectedSizes.has(s))) return false;
      }
      return true;
    });
  }, [products, selectedCategories, selectedGenders, selectedSizes]);

  function renderGridFixed(items: Product[]) {
    if (!items.length) return null;
    return (
      <section className="mt-4">
        <div className="grid grid-cols-2 gap-4">
          {items.map((p) => {
            const url = firstImage(p.photo_url);
            return (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="rounded-2xl bg-white shadow-md overflow-hidden hover:shadow-lg transition border border-gray-100"
              >
                <div className="relative">
                  <span
                    className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow border"
                    style={{ backgroundColor: "#8B5E3C", borderColor: "#6F4A2D" }}
                  >
                    {formatBRL(p.price_tag)}
                  </span>
                  <div className="relative w-full h-44">
                    {url ? (
                      <Image
                        src={url}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 400px"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100" />
                    )}
                  </div>
                </div>
                <div className="p-3">
                  {p.category ? (
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">
                      {p.category}
                    </p>
                  ) : null}
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.eta_text ?? "até 1h"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  function renderHero(block?: Extract<Block, { type: "hero" }>) {
    const image = block?.image || store?.hero_image_url || "";
    const title = block?.title ?? store?.hero_title ?? store?.store_name ?? "";
    const subtitle = block?.subtitle ?? store?.hero_subtitle ?? "";
    const showText = Boolean(block?.show_text) && Boolean(title || subtitle);
    if (!image && !showText) return null;
    return (
      <section className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
        {image ? (
          <div className="relative w-full h-52">
            <Image
              src={image}
              alt={title || "Hero"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 800px"
              unoptimized
            />
          </div>
        ) : null}
        {showText && (
          <div className="p-4">
            {title ? <h2 className="text-xl font-semibold leading-tight">{title}</h2> : null}
            {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
          </div>
        )}
      </section>
    );
  }

  function renderBio() {
    if (!store) return null;
    const hasBio = Boolean(store.bio);
    const hasAddress = Boolean(store.address);
    if (!hasBio && !hasAddress) return null;
    return (
      <section className="mt-4 rounded-2xl border border-gray-200 p-4">
        {hasBio ? <p className="text-sm text-gray-800">{store.bio}</p> : null}
        {hasAddress ? (
          <p className="text-sm text-gray-600 mt-2">
            <span className="font-medium">Endereço</span> {store.address}
          </p>
        ) : null}
      </section>
    );
  }

  function renderCategoryMenu(block?: Extract<Block, { type: "category_menu" }>) {
    const items = block?.source === "custom" && block.items?.length ? block.items : categoryOptions;
    if (!items.length) return null;
    return (
      <section className="mt-3">
        <div className="rounded-2xl border border-gray-200 p-3.5">
          <div className="text-xs text-gray-500 mb-2">Categorias</div>
          <div className="flex flex-wrap gap-2">
            {items.map((c) => (
              <span
                key={c}
                className="h-9 px-3 rounded-full border text-sm capitalize bg-white text-gray-900 border-gray-300"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderBlocks(blocks: Block[]) {
    return blocks.map((b, i) => {
      if (b.type === "hero") return <div key={i}>{renderHero(b)}</div>;
      if (b.type === "bio") return <div key={i}>{renderBio()}</div>;
      if (b.type === "category_menu") return <div key={i}>{renderCategoryMenu(b)}</div>;
      if (b.type === "grid") return <div key={i}>{/* grids custom, se quiser */}</div>;
      if (b.type === "banner") return <div key={i}>{/* banner custom, se quiser */}</div>;
      return null;
    });
  }

  return (
    <main className="bg-white text-black max-w-md mx-auto min-h-[100dvh] px-5 pb-28">
      <div className="pt-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] leading-6 font-bold tracking-tight">
            {store?.store_name || "Loja"}
          </h1>
          <p className="text-[12px] text-gray-600">
            {products.length} {products.length === 1 ? "peça" : "peças"}
          </p>
        </div>
        <Link
          href="/stores"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm hover:bg-gray-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Lojas
        </Link>
      </div>

      {err && <p className="mt-4 text-sm text-red-600">Erro {err}</p>}
      {loading && <p className="mt-4 text-sm text-gray-600">Carregando…</p>}

      {!loading && store && (
        <div className="mt-4">
          {renderBlocks(
            (store.layout?.blocks?.length ? store.layout.blocks : []).filter(
              (b) => b.type === "hero" || b.type === "bio" || b.type === "category_menu"
            )
          )}

          {renderGridFixed(filtered)}
        </div>
      )}
    </main>
  );
}
