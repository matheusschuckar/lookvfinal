"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/data/types";
import { formatBRLAlpha } from "@/lib/ui/helpers";

type ProductWithDedupe = Product & {
  store_count?: number | null;
  stores?: string[] | null;
};

export default function ProductCard({
  p,
  onTap,
}: {
  p: Product;
  onTap?: (p: Product) => void;
}) {
  const photo = Array.isArray(p.photo_url)
    ? p.photo_url[0]
    : typeof p.photo_url === "string"
    ? p.photo_url
    : null;

  const price =
    typeof p.price_tag === "number"
      ? formatBRLAlpha(p.price_tag)
      : String(p.price_tag ?? "");

  const pd = p as ProductWithDedupe;
  const storeCount = typeof pd.store_count === "number" ? pd.store_count : 1;
  const extraStoresLabel = storeCount > 1 ? ` · +${storeCount - 1} lojas` : "";

  const etaTxt =
    (p as { eta_text_runtime?: string | null }).eta_text_runtime ??
    (p as { eta_text?: string | null }).eta_text ??
    "até 1 hora";

  const handleClick = () => onTap?.(p);

  return (
    <Link
      href={`/product/${p.id}`}
      prefetch={false}
      onClick={handleClick}
      className="block rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition border border-neutral-200/60"
    >
      {/* imagem + preço */}
      <div className="relative w-full aspect-[4/5] bg-neutral-100">
        {photo ? (
          <Image
            src={photo}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-100" />
        )}

        {/* badge de preço */}
        <span className="absolute left-2 bottom-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold shadow border border-neutral-300">
          {price}
        </span>
      </div>

      {/* marca */}
      <div className="px-2 pt-2">
        <div className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-semibold text-neutral-700 uppercase truncate">
          {p.store_name}
          {extraStoresLabel}
        </div>
      </div>

      {/* nome + espaçamento para ETA */}
      <div className="flex flex-col px-2 pt-2 pb-3 min-h-[84px] justify-between">
        <div className="text-[13px] font-medium text-neutral-900 leading-snug line-clamp-2">
          {p.name}
        </div>

        {/* ETA em retângulo alinhado no fim */}
        <div className="mt-2">
          <div className="w-fit rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-600">
            {etaTxt}
          </div>
        </div>
      </div>
    </Link>
  );
}
