"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const FEATURED_IDS = [
  "uuid-ou-id-do-produto-1",
  "uuid-ou-id-do-produto-2",
  "uuid-ou-id-do-produto-3",
];

type Product = {
  id: string;
  name: string;
  price_tag: number;
  photo_url: string[] | string | null;
  store_name: string | null;
  category: string | null;
  categories: string[] | null;
  eta_display?: string | null;
  eta_text?: string | null;
};

function firstImage(x: string[] | string | null | undefined) {
  return Array.isArray(x) ? x[0] ?? "" : x ?? "";
}

function formatBRLAlpha(v: number) {
  const cents = Math.round(v * 100) % 100;
  if (cents === 0) return `BRL ${Math.round(v).toLocaleString("pt-BR")}`;
  return `BRL ${v.toFixed(2).replace(".", ",")}`;
}

export default function LouisVuittonPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(url, key);

        const { data, error } = await supabase
          .from("products")
          .select(
            "id, name, price_tag, photo_url, store_name, category, categories, eta_display, eta_text"
          )
          .in("id", FEATURED_IDS);

        if (error) throw error;
        setProducts(data ?? []);
      } catch (err) {
        console.error("SUPABASE_ERROR", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">
      {/* Botão Voltar */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          href="/"
          className="text-sm font-medium text-neutral-100 hover:text-white bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20 transition-all"
        >
          ← Voltar
        </Link>
      </div>

      {/* Banner horizontal */}
      <div className="relative overflow-hidden rounded-3xl">
        <img
          src="https://images.unsplash.com/photo-1520975922324-9bcd35aa7f84?q=80&w=1600&auto=format&fit=crop"
          alt="Louis Vuitton Editorial"
          className="w-full h-[300px] md:h-[420px] object-cover object-center"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-white">
          <h1 className="text-2xl md:text-4xl font-medium tracking-tight">
            Louis Vuitton Editorial
          </h1>
          <p className="text-sm md:text-base opacity-90">
            Semana Look. Essenciais da maison com curadoria precisa.
          </p>
        </div>
      </div>

      {/* Bio centralizada */}
      <section className="text-center space-y-5 max-w-3xl mx-auto">
        <h2 className="text-xl md:text-2xl font-medium">
          Novidades Louis Vuitton
        </h2>
        <p className="text-base leading-relaxed text-neutral-700">
          A seleção mira peças que unem técnica e presença. Silhuetas limpas,
          assinatura forte e materiais que elevam o uso diário.
        </p>
        <p className="text-base leading-relaxed text-neutral-700">
          A Look organiza o closet com peças certas no momento certo. Aqui você
          encontra uma edição afiada que funciona do aeroporto ao jantar.
        </p>
      </section>

      {/* Produtos */}
      <section className="space-y-6 text-center">
        <h2 className="text-xl md:text-2xl font-medium">Seleção da semana</h2>
        <div className="text-sm text-neutral-500">
          {loading ? "Carregando..." : `${products.length} itens`}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 p-8 text-center text-neutral-600">
            Carregando produtos...
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 p-8 text-center text-neutral-600">
            Em breve novas peças selecionadas para esta página.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="group rounded-3xl overflow-hidden bg-white border border-neutral-200 hover:shadow-lg transition-all"
              >
                <div className="relative w-full aspect-[4/5] bg-neutral-50">
                  {firstImage(p.photo_url) ? (
                    <img
                      src={firstImage(p.photo_url)}
                      alt={p.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-neutral-400 text-sm">
                      imagem indisponível
                    </div>
                  )}
                  <span className="absolute top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-medium text-white shadow border bg-[#141414] border-[#141414]">
                    {formatBRLAlpha(p.price_tag)}
                  </span>
                </div>
                <div className="p-5 text-center">
                  {p.category && (
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">
                      {p.category}
                    </p>
                  )}
                  <p className="text-base font-semibold leading-tight line-clamp-2">
                    {p.name}
                  </p>
                  {p.store_name && (
                    <p className="text-xs text-gray-500 mt-1">{p.store_name}</p>
                  )}
                  {(p.eta_display || p.eta_text) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {p.eta_display ?? p.eta_text}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
