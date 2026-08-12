import type { Browser, BrowserContext } from "playwright-core";

/**
 * Headless browser provider.
 *
 * Google renders search results client-side, so a real engine is required —
 * plain HTTP returns a JS redirect shell with zero results. Two environments
 * have to be supported:
 *
 *  - Local dev: the Chromium that `npx playwright install chromium` downloaded.
 *  - Vercel/Lambda: @sparticuz/chromium, a compressed build that fits inside
 *    the serverless bundle limit. The full playwright browser does not.
 */

const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
);

/** Flags that make headless Chromium survive a constrained container. */
const HARDENED_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-blink-features=AutomationControlled",
];

export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright-core");

  if (IS_SERVERLESS) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: [...sparticuz.args, ...HARDENED_ARGS],
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }

  return chromium.launch({ headless: true, args: HARDENED_ARGS });
}

/**
 * A context that looks like an ordinary Indian desktop browser, with the
 * consent cookie pre-seeded so Google serves results instead of a cookie wall.
 */
export async function createContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    viewport: { width: 1366, height: 900 },
  });

  await context.addCookies([
    {
      name: "CONSENT",
      value: "YES+cb.20240101-00-p0.en+FX+000",
      domain: ".google.com",
      path: "/",
    },
  ]);

  // Images and fonts are pure cost here — we only ever read text and hrefs.
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") {
      return route.abort();
    }
    return route.continue();
  });

  return context;
}
