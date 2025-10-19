/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
};
module.exports = nextConfig;

// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      // Supabase Storage (qualquer projeto)
      { protocol: "https", hostname: "**.supabase.co" },
      // VTEX CDN (seus exemplos)
      { protocol: "https", hostname: "**.vtexassets.com" },
      // (opcional) outros CDNs que você usa para banners
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.akamaized.net" },
    ],
  },
};
