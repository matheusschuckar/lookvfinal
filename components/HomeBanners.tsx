"use client";

import Link from "next/link";

export function EditorialTallBanner({
  banner,
}: {
  banner: { href: string; image: string; alt: string };
}) {
  return (
    <Link
      href={banner.href}
      className="col-span-2 rounded-3xl overflow-hidden relative"
      aria-label={banner.alt}
    >
      <img
        src={banner.image}
        alt={banner.alt}
        className="w-full h-[560px] object-cover object-center"
        loading="lazy"
        decoding="async"
      />
    </Link>
  );
}

export function SelectionHeroBanner({
  banner,
}: {
  banner: { href: string; image: string; alt: string };
}) {
  return (
    <Link
      href={banner.href}
      className="col-span-2 rounded-3xl overflow-hidden relative aspect-square bg-white"
      aria-label={banner.alt}
    >
      <img
        src={banner.image}
        alt={banner.alt}
        className="absolute inset-0 w-full h-full object-contain"
        loading="lazy"
        decoding="async"
      />
    </Link>
  );
}

export function BannersTriplet({
  items,
}: {
  items: Array<{ href: string; image: string; alt: string }>;
}) {
  return (
    <div className="col-span-2 grid grid-cols-3 gap-3">
      {items.map((b, idx) => (
        <Link
          key={`land-${idx}`}
          href={b.href}
          className="rounded-2xl overflow-hidden relative"
          aria-label={b.alt}
        >
          <img
            src={b.image}
            alt={b.alt}
            className="w-full h-28 object-cover object-center"
            loading="lazy"
            decoding="async"
          />
        </Link>
      ))}
    </div>
  );
}
export function PersonalShopperBanner({ href }: { href: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Personal Shopper: Receba em até 2h"
      className="mt-3 block"
    >
      <div
        className="relative overflow-hidden rounded-3xl h-24 flex flex-col items-center justify-center text-center px-6 text-white"
        style={{
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1b1b1b 35%, #2a2a2a 65%, #0e0e0e 100%)",
          boxShadow:
            "inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -1px 3px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        {/* reflexo diagonal suave */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, rgba(0,0,0,0) 60%)",
          }}
        />

        <div className="relative">
          <div className="text-[17px] font-semibold leading-snug tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
            Personal Shopper: receba em até 90 min.
          </div>
          <div className="text-[13px] text-neutral-200 mt-[3px] leading-tight">
            Sua marca favorita ainda não está por aqui?
            <br />
            <span className="underline underline-offset-2">
              Compre com nosso personal shopper
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
