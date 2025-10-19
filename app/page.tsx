"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import ProductCard from "../components/ProductCard";
import FiltersModal from "../components/FiltersModal";
import ChipsRow from "../components/ChipsRow";
import { BannersCarousel, type Banner } from "../components/BannersCarousel";
import {
  EditorialTallBanner,
  SelectionHeroBanner,
  BannersTriplet,
} from "../components/HomeBanners";
import HeaderBar from "../components/HeaderBar";
import AppDrawer from "../components/AppDrawer";
import type { Product, Profile } from "@/lib/data/types";

import {
  getPrefs,
  getPrefsV2,
  bumpCategory,
  bumpStore,
  bumpGender,
  bumpSize,
  bumpPriceBucket,
  bumpEtaBucket,
  bumpProduct,
  decayAll,
} from "@/lib/prefs";
import { getViewsMap } from "@/lib/metrics";
import {
  hasAddressBasics,
  hasContact,
  inCoverage,
  intersects,
  categoriesOf,
  priceBucket,
  etaBucket,
} from "@/lib/ui/helpers";
import { HOME_CAROUSEL, INLINE_BANNERS } from "@/lib/ui/homeContent";
import { useInfiniteProducts } from "@/hooks/useInfiniteProducts";
import { dedupeProducts } from "@/lib/data/dedupe"; // <<<< ADICIONADO

type KeyStat = { w: number; t: number };

// ruído determinístico por produto + seed da sessão
function noiseFor(id: number, seed: number) {
  let x = (id ^ seed) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5; // xorshift32
  return (x >>> 0) / 4294967295; // 0..1
}

// Helper: tenta puxar os ids da loja mais próxima por marca para o usuário.
// Se o perfil ainda não tem geom, a RPC retorna vazia e usamos fallback.
async function fetchNearestStoreIdsForUser(userId: string): Promise<number[]> {
  const { data, error } = await supabase.rpc(
    "nearest_store_per_brand_for_user",
    { p_user_id: userId }
  );
  if (error) {
    console.warn("[nearest] rpc error:", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => r.store_id as number);
}

export default function Home() {
  const router = useRouter();

  // seed do ranking
  const [rankSeed] = useState(() => Math.floor(Math.random() * 1e9));

  // carregamento e erros gerais da tela
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // perfil do usuário
  const [profile, setProfile] = useState<Profile | null>(null);

  // nearest stores para filtrar no cliente enquanto não filtramos no SQL
  const [nearestStoreIds, setNearestStoreIds] = useState<number[] | null>(null);

  // métricas locais de views
  const [views, setViews] = useState<Record<string, number>>({});

  // busca local
  const [query, setQuery] = useState("");

  // drawer e filtros
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // sentinel para o IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // hook de paginação infinita
  const {
    items: infiniteItems,
    hasMore,
    loading: loadingMore,
    error: loadMoreError,
    loadMore,
  } = useInfiniteProducts();

  // observa mudanças de views entre abas
  useEffect(() => {
    setViews(getViewsMap());
    function onStorage(e: StorageEvent) {
      if (e.key === "look.metrics.v1.views" && e.newValue) {
        try {
          setViews(JSON.parse(e.newValue));
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // bloqueia scroll quando drawer ou modal estiverem abertos
  useEffect(() => {
    const anyOverlay = drawerOpen || filterOpen;
    const prev = document.documentElement.style.overflow;
    if (anyOverlay) document.documentElement.style.overflow = "hidden";
    else document.documentElement.style.overflow = prev || "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [drawerOpen, filterOpen]);

  // banners
  const banners = useMemo<Banner[]>(
    () =>
      HOME_CAROUSEL.map((b) => ({
        title: b.title,
        href: b.href,
        image: b.image,
        subtitle: Array.isArray(b.subtitle)
          ? ([...b.subtitle] as string[])
          : b.subtitle,
      })) as Banner[],
    []
  );

  // auth, perfil e nearest stores
  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();

        if (!u.user) {
          setProfile(null);
          setNearestStoreIds(null);
        } else {
          let profResp = await supabase
            .from("user_profiles")
            .select(
              "id,name,whatsapp,street,number,complement,city,state,cep,status"
            )
            .eq("id", u.user.id)
            .single();

          if (profResp.error && /state/i.test(String(profResp.error.message))) {
            profResp = await supabase
              .from("user_profiles")
              .select(
                "id,name,whatsapp,street,number,complement,city,cep,status"
              )
              .eq("id", u.user.id)
              .single();
            if (profResp.data) (profResp.data as any).state = null;
          }
          if (profResp.error) throw profResp.error;

          const prof = profResp.data as Profile;
          setProfile(prof);

          const nearestIds = await fetchNearestStoreIdsForUser(u.user.id);
          setNearestStoreIds(nearestIds.length ? nearestIds : null);
        }
      } catch (e: any) {
        const msg = String(e?.message || "");
        console.error("[Home] load error:", msg);
        setErr(msg || "Erro inesperado");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // categorias dinâmicas com base no infinito
  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of infiniteItems) categoriesOf(p).forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [infiniteItems]);

  const allCategories = dynamicCategories;
  const [chipCategory, setChipCategory] = useState<string>("Tudo");
  const [activeTab, setActiveTab] = useState<
    "genero" | "tamanho" | "categorias"
  >("genero");
  const [selectedGenders, setSelectedGenders] = useState<
    Set<"male" | "female">
  >(new Set());
  const [selectedSizes, setSelectedSizes] = useState<
    Set<"PP" | "P" | "M" | "G" | "GG">
  >(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );

  const clearFilters = () => {
    setSelectedGenders(new Set());
    setSelectedSizes(new Set());
    setSelectedCategories(new Set());
    setChipCategory("Tudo");
  };

  const anyActiveFilter =
    selectedGenders.size > 0 ||
    selectedSizes.size > 0 ||
    selectedCategories.size > 0 ||
    chipCategory !== "Tudo";

  // filtragem no cliente incluindo nearest stores + DEDUPE
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const afterFilters = infiniteItems
      .filter((p) => {
        if (nearestStoreIds && nearestStoreIds.length > 0) {
          const sid = Number((p as any).store_id ?? (p as any).storeId ?? 0);
          if (!nearestStoreIds.includes(sid)) return false;
        }
        return true;
      })
      .filter((p) => {
        if (q) {
          const cats = categoriesOf(p);
          const matchText =
            p.name.toLowerCase().includes(q) ||
            p.store_name.toLowerCase().includes(q) ||
            cats.some((c) => c.includes(q));
          if (!matchText) return false;
        }

        const cats = categoriesOf(p);

        if (selectedCategories.size > 0) {
          const hit = cats.some((c) => selectedCategories.has(c));
          if (!hit) return false;
        } else if (chipCategory !== "Tudo") {
          if (!cats.includes(chipCategory.toLowerCase())) return false;
        }

        if (selectedGenders.size > 0) {
          const pg = (p.gender || "").toLowerCase();
          if (!pg || !selectedGenders.has(pg as "male" | "female"))
            return false;
        }

        if (selectedSizes.size > 0) {
          const raw = Array.isArray(p.sizes)
            ? (p.sizes as string[]).join(",")
            : p.sizes ?? "";
          const list = String(raw)
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean) as Array<"PP" | "P" | "M" | "G" | "GG">;
          if (!list.length || !intersects(selectedSizes, list)) return false;
        }

        return true;
      });

    // 🔑 DEDUPLICA por chave lógica (SKU/global) mantendo só um produto (por padrão o mais barato)
    return dedupeProducts(afterFilters, { preferCheapest: true });
  }, [
    infiniteItems,
    nearestStoreIds,
    query,
    chipCategory,
    selectedCategories,
    selectedGenders,
    selectedSizes,
  ]);

  // ranking multi sinal
  const EPSILON = 0.08;
  const JITTER = 0.08;
  const HF_DAYS = 14;

  useEffect(() => {
    try {
      decayAll(HF_DAYS);
    } catch {}
  }, []);

  const W = {
    CAT: 1.0,
    STORE: 0.65,
    GENDER: 0.45,
    SIZE: 0.35,
    PRICE: 0.3,
    ETA: 0.25,
    PRODUCT: 0.2,
    TREND: 0.15,
  };

  const filteredRanked = useMemo<Product[]>(() => {
    const p2 = getPrefsV2();
    const p1 = getPrefs();

    function norm(map: Record<string, KeyStat> | Record<string, number>) {
      const vals = Object.values(map).map((v: any) =>
        typeof v === "number" ? v : v?.w ?? 0
      );
      const max = vals.length ? Math.max(1, ...vals) : 1;
      return { map, max };
    }

    const nCat = norm(p2.cat);
    const nStore = norm(p2.store);
    const nGender = norm(p2.gender);
    const nSize = norm(p2.size);
    const nPrice = norm(p2.price);
    const nEta = norm(p2.eta);
    const nProd = norm(p2.product);

    const localViews = views || {};
    const trendingMax = Object.values(localViews).length
      ? Math.max(1, ...Object.values(localViews))
      : 1;

    const explore = Math.random() < EPSILON;

    const scored = filtered.map((p) => {
      const cats = categoriesOf(p);
      const mainCat = cats[0] || (p as any).category || "";
      const storeKey = (p.store_name || "").toLowerCase();
      const genderKey = (p.gender || "").toLowerCase();
      const priceKey = priceBucket(p.price_tag);
      const etaTxt = (p as any).eta_text_runtime ?? (p as any).eta_text ?? null;
      const etaKey = etaBucket(etaTxt);
      const prodKey = String(p.id);

      const fromMap = (
        nm: ReturnType<typeof norm>,
        key: string,
        alsoV1?: Record<string, number>
      ) => {
        const k = (key || "").toLowerCase();
        const v2 = (nm.map as any)[k];
        const raw = typeof v2 === "number" ? v2 : v2?.w ?? 0;
        const legacy = alsoV1 ? alsoV1[k] || 0 : 0;
        const v = Math.max(raw, legacy);
        return v / Math.max(1, nm.max);
      };

      const fCat = fromMap(nCat, mainCat, p1.cat);
      const fStore = fromMap(nStore, storeKey, p1.store);
      const fGender = fromMap(nGender, genderKey);
      const fSize = 0;
      const fPrice = fromMap(nPrice, priceKey);
      const fEta = fromMap(nEta, etaKey);
      const fProd = fromMap(nProd, prodKey);

      const local = (localViews[String(p.id)] || 0) / trendingMax;
      const remote = typeof p.view_count === "number" ? p.view_count : 0;
      const trend = Math.max(local, remote > 0 ? Math.min(remote / 50, 1) : 0);

      const noise = noiseFor(p.id, rankSeed) * JITTER;
      const weightTrend = explore ? W.TREND * 2.2 : W.TREND;

      const score =
        W.CAT * fCat +
        W.STORE * fStore +
        W.GENDER * fGender +
        W.SIZE * fSize +
        W.PRICE * fPrice +
        W.ETA * fEta +
        W.PRODUCT * fProd +
        weightTrend * trend +
        noise;

      return { p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    if (explore && scored.length > 8) {
      const injected = [...scored];
      for (let k = 0; k < Math.min(6, Math.floor(scored.length / 8)); k++) {
        const idx =
          4 + Math.floor(Math.random() * Math.min(24, injected.length - 5));
        const [item] = injected.splice(idx, 1);
        injected.splice(2 * k + 1, 0, item);
      }
      return injected.map((x) => x.p);
    }

    return scored.map((x) => x.p);
  }, [filtered, views, rankSeed]);

  const locationLabel = profile?.city
    ? `${profile.city}${profile?.state ? `, ${profile.state}` : ""}`
    : "São Paulo, SP";

  async function handleLogout() {
    try {
      setDrawerOpen(false);
      await supabase.auth.signOut();
      setProfile(null);
    } finally {
      router.replace("/");
    }
  }

  const idle = (cb: () => void) => {
    const ric: any =
      (typeof window !== "undefined" && (window as any).requestIdleCallback) ||
      null;
    if (ric) ric(cb, { timeout: 500 });
    else setTimeout(cb, 0);
  };

  function recordInteraction(p: Product) {
    try {
      const cats = categoriesOf(p);
      const mainCat = cats[0] || "";
      if (mainCat) bumpCategory(mainCat, 1.2);
      bumpStore(p.store_name || "", 1);
      if (p.gender) bumpGender(p.gender, 0.8);
      bumpPriceBucket(priceBucket(p.price_tag), 0.6);
      const etaTxt = (p as any).eta_text_runtime ?? (p as any).eta_text ?? null;
      bumpEtaBucket(etaBucket(etaTxt), 0.5);
      bumpProduct(p.id, 0.25);

      const KEY = "look.metrics.v1.views";
      const raw = localStorage.getItem(KEY);
      const map = raw ? JSON.parse(raw) : {};
      const k = String(p.id);
      map[k] = (map[k] || 0) + 1;
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch {}
  }

  // observa o sentinel para pedir mais páginas
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "1200px 0px 0px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <main
      className="canvas text-black max-w-md mx-auto min-h-screen px-5 with-bottom-nav !bg-[var(--background)]"
      style={{ backgroundColor: "var(--background)" }}
    >
      <HeaderBar
        loading={loading}
        profile={profile}
        onOpenMenu={() => setDrawerOpen(true)}
      />

      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLogout={handleLogout}
      />

      {profile && !hasAddressBasics(profile) && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900">
          <div className="text-sm font-medium">Complete seu endereço</div>
          <p className="mt-1 text-xs text-neutral-700 leading-5">
            Precisamos do CEP, rua e número para mostrar as opções da sua
            região.
          </p>
          <div className="mt-3">
            <Link
              href="/address"
              className="inline-flex items-center justify-center rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
            >
              Atualizar endereço
            </Link>
          </div>
        </div>
      )}

      {profile && hasAddressBasics(profile) && !hasContact(profile) && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900">
          <div className="text-sm font-medium">Finalize seu cadastro</div>
          <p className="mt-1 text-xs text-neutral-700 leading-5">
            Adicione seu nome e WhatsApp para facilitar o atendimento.
          </p>
          <div className="mt-3">
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800"
            >
              Completar dados
            </Link>
          </div>
        </div>
      )}

      {profile && hasAddressBasics(profile) && !inCoverage(profile) && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="text-sm font-medium">
            Ainda não atendemos sua região
          </div>
          <p className="mt-1 text-xs text-amber-800/90 leading-5">
            Por enquanto entregamos somente na cidade de São Paulo. Se você
            tiver um endereço em São Paulo, pode cadastrá-lo para visualizar os
            produtos.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/address"
              className="inline-flex items-center justify-center rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
            >
              Trocar endereço
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800"
            >
              Meu cadastro
            </Link>
          </div>
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex gap-2">
          <div className="flex-1 relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="7" strokeWidth="2" />
                <path d="M20 20l-3.5-3.5" strokeWidth="2" />
              </svg>
            </span>
            <input
              aria-label="Search products"
              type="search"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-[22px] border border-warm chip pl-9 pr-3 h-11 text-[14px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div className="shrink-0">
            <div className="inline-flex items-center gap-1 rounded-[22px] border border-warm chip px-3 h-11 text-[12px] text-gray-700">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="11" r="3" strokeWidth="2" />
              </svg>
              <span className="whitespace-nowrap max-w-[140px] truncate">
                {locationLabel}
              </span>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-gray-600">Carregando…</p>}
      {err && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
          <div className="text-sm font-medium">
            Não foi possível carregar seus dados
          </div>
          <p className="mt-1 text-xs text-red-800/90 leading-5">
            {String(err)}
          </p>
        </div>
      )}

      {!loading && <BannersCarousel banners={banners} />}

      {!loading && (
        <ChipsRow
          anyActiveFilter={anyActiveFilter}
          chipCategory={chipCategory}
          setChipCategory={setChipCategory}
          selectedCategories={selectedCategories}
          selectedGenders={selectedGenders}
          selectedSizes={selectedSizes}
          allCategories={allCategories}
          clearFilters={() => {
            clearFilters();
            setChipCategory("Tudo");
          }}
          openFilter={() => setFilterOpen(true)}
          onBumpCategory={(c, w) => bumpCategory(c, w)}
          onToggleGender={(g) =>
            setSelectedGenders((prev) => {
              const wasActive = prev.has(g);
              const next = new Set(prev);
              if (wasActive) next.delete(g);
              else {
                next.add(g);
                bumpGender(g, 1.0);
              }
              return next;
            })
          }
        />
      )}

      <FiltersModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        allCategories={allCategories}
        selectedGenders={selectedGenders}
        setSelectedGenders={setSelectedGenders}
        selectedSizes={selectedSizes}
        setSelectedSizes={setSelectedSizes}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        clearAll={() => {
          clearFilters();
          setChipCategory("Tudo");
        }}
        onApply={() => {
          selectedCategories.forEach((c) => bumpCategory(c, 0.5));
          selectedGenders.forEach((g) => bumpGender(g, 0.5));
          selectedSizes.forEach((s) => bumpSize(s, 0.3));
          setFilterOpen(false);
        }}
      />

      {!loading && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 pb-6">
            {(() => {
              const items: React.ReactNode[] = [];
              const list = filteredRanked;
              let i = 0;

              const idleLocal = (cb: () => void) => {
                const ric: any =
                  (typeof window !== "undefined" &&
                    (window as any).requestIdleCallback) ||
                  null;
                if (ric) ric(cb, { timeout: 500 });
                else setTimeout(cb, 0);
              };

              const pushProducts = (count: number) => {
                for (let k = 0; k < count && i < list.length; k++, i++) {
                  items.push(
                    <ProductCard
                      key={`p-${list[i].id}`}
                      p={list[i]}
                      onTap={(p) => idleLocal(() => recordInteraction(p))}
                    />
                  );
                }
              };

              // roteiro editorial
              pushProducts(4);
              items.push(
                <EditorialTallBanner
                  key="banner-editorialTall"
                  banner={INLINE_BANNERS.editorialTall}
                />
              );
              pushProducts(4);
              items.push(
                <SelectionHeroBanner
                  key="banner-selectionHero"
                  banner={INLINE_BANNERS.selectionHero}
                />
              );

              // restante do que já carregou
              pushProducts(Number.MAX_SAFE_INTEGER);

              if (items.length === 0) {
                items.push(
                  <p
                    key="empty"
                    className="col-span-2 mt-4 text-sm text-gray-600"
                  >
                    Nenhum produto encontrado com os filtros atuais.
                  </p>
                );
              }

              return items;
            })()}
          </div>

          {loadingMore && (
            <div className="mt-2 space-y-6 px-1">
              <div className="h-[220px] w-full animate-pulse rounded-2xl bg-neutral-200" />
              <div className="h-[220px] w-full animate-pulse rounded-2xl bg-neutral-200" />
            </div>
          )}

          {loadMoreError && (
            <p className="mt-3 text-center text-sm text-red-600">
              Erro ao carregar mais itens
            </p>
          )}

          {hasMore && <div ref={sentinelRef} className="h-8" />}

          {!hasMore && filteredRanked.length > 0 && (
            <p className="py-8 text-center text-sm text-neutral-500">
              Fim do catálogo
            </p>
          )}
        </>
      )}

      <div className="h-4" />
    </main>
  );
}
