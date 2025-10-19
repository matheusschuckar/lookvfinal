"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/data/types";

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
      ? `R$ ${p.price_tag.toFixed(2).replace(".", ",")}`
      : String(p.price_tag ?? "");

  // extras vindos do dedupe (opcionais)
  const storeCount = Number((p as any).store_count ?? 1);
  const storesList = Array.isArray((p as any).stores)
    ? ((p as any).stores as string[])
    : [];
  const extraStoresLabel = storeCount > 1 ? ` · +${storeCount - 1} lojas` : "";

  const handleClick = () => {
    onTap?.(p);
  };

  return (
    <Link
      href={`/product/${p.id}`}
      prefetch={false}
      onClick={handleClick}
      className="block group rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition"
    >
      <div className="relative w-full aspect-[4/5] bg-gray-100">
        {photo ? (
          <Image
            src={photo}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gray-100" />
        )}
      </div>

      <div className="px-2 py-3">
        <div className="text-[13px] font-medium text-gray-900 line-clamp-2">
          {p.name}
        </div>

        <div
          className="mt-1 text-[12px] text-gray-500 truncate"
          title={
            storesList.length > 1
              ? `${p.store_name} · também em: ${storesList
                  .filter((s) => s !== p.store_name)
                  .join(", ")}`
              : p.store_name
          }
        >
          {p.store_name}
          {extraStoresLabel}
        </div>

        <div className="mt-1 text-[13px] font-semibold text-gray-900">
          {price}
        </div>
      </div>
    </Link>
  );
}
