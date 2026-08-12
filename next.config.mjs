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
    // Externalizing @sparticuz/chromium above stops webpack from touching it,
    // but Vercel's separate output-file-tracing step still has to be told to
    // ship its bin/ directory (the brotli-compressed Chromium binary) — it's
    // loaded via a runtime-computed path, not a static require, so the
    // tracer misses it on its own and the function crashes with
    // "input directory .../bin does not exist". Scoped to just the routes
    // that call launchBrowser() (see src/services/scraping/google/browser.ts)
    // so the ~70MB binary isn't bundled into every unrelated function.
    outputFileTracingIncludes: {
      "/api/scrape/google": ["./node_modules/@sparticuz/chromium/bin/**"],
      "/api/leads/find-contacts": ["./node_modules/@sparticuz/chromium/bin/**"],
      "/api/leads/classify": ["./node_modules/@sparticuz/chromium/bin/**"],
    },
  },
};

export default nextConfig;
