// lib/storeContent.ts
export type StoreConf = {
  hero?: { image: string; alt?: string; height?: number };
  bio?: string;
  address?: string;
  banners?: {
    editorialTall?: {
      image: string;
      href?: string;
      alt?: string;
      height?: number;
    };
    selectionHero?: {
      image: string;
      href?: string;
      alt?: string;
      height?: number;
    };
    landscapeTriplet?: Array<{ image: string; href?: string; alt?: string }>;
  };
};

// helper simples para slug igual ao da página
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// conteúdo por loja (exemplos)
export const storeContentBySlug: Record<string, StoreConf> = {
  fasano: {
    hero: {
      image:
        "https://kuaoqzxqraeioqyhmnkw.supabase.co/storage/v1/object/public/product-images/Brunello-Cucinelli-Portofino-Summer-2023-Couples-Outfits.jpg",
      alt: "Editorial Fasano",
      height: 220, // pode ajustar por loja
    },
    bio: "Clássicos italianos com curadoria moderna e peças atemporais.",
    address: "R. Vittorio Fasano, 88 — Jardins, São Paulo — SP",
    banners: {
      editorialTall: {
        image:
          "https://kuaoqzxqraeioqyhmnkw.supabase.co/storage/v1/object/public/product-images/NEW%20IN%20LOUIS%20VUITTON-3.png",
        alt: "Editorial",
        height: 520,
        href: "/collections/louisvuitton",
      },
      selectionHero: {
        image:
          "https://kuaoqzxqraeioqyhmnkw.supabase.co/storage/v1/object/public/product-images/Untitled%20(448%20x%20448%20px)-4.png",
        alt: "Seleção Fasano",
        height: 448,
        href: "/collections/fasano",
      },
      landscapeTriplet: [
        {
          image: "https://via.placeholder.com/800x200?text=Banner+1",
          href: "/collections/nova-colecao",
          alt: "Nova coleção",
        },
        {
          image: "https://via.placeholder.com/800x200?text=Banner+2",
          href: "/collections/occasions",
          alt: "Ocasiões",
        },
        {
          image: "https://via.placeholder.com/800x200?text=Banner+3",
          href: "/collections/essentials",
          alt: "Essenciais",
        },
      ],
    },
  },

  // exemplo de outra loja
  "louis-vuitton": {
    hero: {
      image:
        "https://kuaoqzxqraeioqyhmnkw.supabase.co/storage/v1/object/public/product-images/Untitled%20design-10.png",
      alt: "LV Editorial",
      height: 260,
    },
    bio: "Vanguarda e tradição em couro e prêt-à-porter.",
    address: "Av. Cidade Jardim, 123 — São Paulo — SP",
    banners: {
      editorialTall: {
        image:
          "https://kuaoqzxqraeioqyhmnkw.supabase.co/storage/v1/object/public/product-images/NEW%20IN%20LOUIS%20VUITTON-3.png",
        height: 560,
      },
      selectionHero: {
        image: "https://via.placeholder.com/1200x448?text=Selecao+Especial",
        height: 448,
      },
    },
  },
};

// fallback genérico (caso a loja não tenha conteúdo mapeado)
export const defaultStoreConf: StoreConf = {
  hero: {
    image: "https://via.placeholder.com/1200x220?text=Loja",
    alt: "Hero da loja",
    height: 220,
  },
  bio: "",
  address: "",
  banners: {},
};
