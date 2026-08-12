/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  experimental: {
    // Playwright and its Chromium binary must never be bundled — webpack cannot
    // resolve their optional native/runtime deps (chromium-bidi, etc.).
    serverComponentsExternalPackages: [
      "axios",
      "playwright-core",
      "@sparticuz/chromium",
    ],
  },
};

export default nextConfig;
