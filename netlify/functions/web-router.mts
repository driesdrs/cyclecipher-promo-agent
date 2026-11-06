import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import appConfig from "../../app-config.json";
import {
  runDailyPromoCycle,
  type PromoCatalog,
  type PublishedArticle,
} from "../../src/promo-engine";

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHreflangTags(): string {
  const tags = appConfig.globalMarkets.map(
    (m) =>
      `<link rel="alternate" hreflang="${m.locale.toLowerCase()}" href="${appConfig.siteUrl}/${m.code}" />`
  );
  tags.push(
    `<link rel="alternate" hreflang="x-default" href="${appConfig.siteUrl}/" />`
  );
  return tags.join("\n  ");
}

const SHARED_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #f8fafc; line-height: 1.65; }
  .container { max-width: 860px; margin: 0 auto; padding: 28px 20px 64px; }
  .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
  .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: #0f172a; font-weight: 700; font-size: 19px; }
  .brand img { width: 40px; height: 40px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .pill { background: #e2e8f0; color: #1e293b; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .hero { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 36px 28px; text-align: center; box-shadow: 0 8px 24px rgba(15,23,42,0.04); margin-bottom: 28px; }
  .hero img { width: 88px; height: 88px; border-radius: 20px; margin-bottom: 14px; box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
  h1 { font-size: clamp(26px, 4vw, 36px); line-height: 1.2; margin: 8px 0 12px; letter-spacing: -0.02em; }
  h2 { font-size: 22px; margin-top: 28px; margin-bottom: 10px; letter-spacing: -0.01em; }
  .subtitle { font-size: 18px; color: #475569; max-width: 640px; margin: 0 auto 22px; }
  .cta-btn { display: inline-block; background: #0f172a; color: #ffffff !important; padding: 14px 26px; border-radius: 12px; font-weight: 600; font-size: 16px; text-decoration: none; transition: transform 0.15s ease; }
  .cta-btn:hover { transform: translateY(-1px); background: #1e293b; }
  .badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 18px; font-size: 13px; color: #475569; }
  .badge { background: #f1f5f9; padding: 5px 12px; border-radius: 8px; }
  .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .country-link { display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; text-decoration: none; color: #0f172a; font-weight: 500; font-size: 14px; }
  .country-link:hover { border-color: #94a3b8; }
  .faq-item { border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 14px; }
  footer { text-align: center; color: #64748b; font-size: 13px; margin-top: 48px; }
`;

function renderArticlePage(article: PublishedArticle): string {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "CycleCipher: Period Tracker",
      operatingSystem: "iOS",
      applicationCategory: "HealthApplication",
      description: article.metaDescription,
      downloadUrl: article.appStoreUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "30-Day Full-Access Free Trial, optional one-time Lifetime unlock",
      },
    },
    ...(article.faqs.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: article.faqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          },
        ]
      : []),
  ];

  return `<!DOCTYPE html>
<html lang="${escapeHtml(article.locale)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="apple-itunes-app" content="app-id=${appConfig.numericAppId}, app-argument=${escapeHtml(article.appStoreUrl)}" />
  <title>${escapeHtml(article.title)} | CycleCipher</title>
  <meta name="description" content="${escapeHtml(article.metaDescription)}" />
  <link rel="canonical" href="${escapeHtml(article.pageUrl)}" />
  ${renderHreflangTags()}
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(article.title)}" />
  <meta property="og:description" content="${escapeHtml(article.metaDescription)}" />
  <meta property="og:image" content="${appConfig.logoUrl}" />
  <meta property="og:url" content="${escapeHtml(article.pageUrl)}" />
  <meta name="twitter:card" content="summary" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a class="brand" href="/${escapeHtml(article.countryCode)}">
        <img src="/cyclecipher-logo.jpg" alt="CycleCipher Logo" />
        <span>CycleCipher</span>
      </a>
      <span class="pill">${article.flag} ${escapeHtml(article.countryName)}</span>
    </nav>

    <header class="hero">
      <img src="/cyclecipher-logo.jpg" alt="CycleCipher Shield" />
      <h1>${escapeHtml(article.title)}</h1>
      <p class="subtitle">${escapeHtml(article.subtitle)}</p>
      <a class="cta-btn" href="${escapeHtml(article.appStoreUrl)}">🍎 ${escapeHtml(article.ctaButtonText)}</a>
      <div class="badges">
        <span class="badge">🔒 AES-256 Zero-Knowledge</span>
        <span class="badge">🚫 Zero Ads & Zero Data Brokers</span>
        <span class="badge">🎁 30-Day Free Trial · No Subscriptions</span>
      </div>
    </header>

    <article class="card">
      ${article.sections
        .map(
          (sec) => `
        <section>
          <h2>${escapeHtml(sec.heading)}</h2>
          <p>${escapeHtml(sec.body)}</p>
        </section>`
        )
        .join("")}

      <div style="text-align:center; margin-top:28px; padding-top:20px; border-top:1px solid #e2e8f0;">
        <a class="cta-btn" href="${escapeHtml(article.appStoreUrl)}">🍎 ${escapeHtml(article.ctaButtonText)}</a>
      </div>
    </article>

    ${
      article.faqs.length > 0
        ? `<section class="card">
            <h2>FAQ</h2>
            ${article.faqs
              .map(
                (f) => `
              <div class="faq-item">
                <strong>${escapeHtml(f.question)}</strong>
                <p style="margin:6px 0 0 0; color:#334155;">${escapeHtml(f.answer)}</p>
              </div>`
              )
              .join("")}
          </section>`
        : ""
    }

    <footer>
      <p><a href="/">🌍 All App Store Regions</a> · <a href="/${escapeHtml(article.countryCode)}">${article.flag} ${escapeHtml(article.countryName)}</a> · <a href="${escapeHtml(article.appStoreUrl)}">App Store</a></p>
      <p>© ${new Date().getFullYear()} CycleCipher — Mathematically sealed on your iPhone.</p>
    </footer>
  </div>
</body>
</html>`;
}

function renderCountryOrHomeHub(
  catalog: PromoCatalog,
  selectedMarket?: (typeof appConfig.globalMarkets)[0]
): string {
  const appStoreUrl = selectedMarket
    ? `https://apps.apple.com/${selectedMarket.code}/app/cyclecipher-period-tracker/${appConfig.appId}`
    : appConfig.appUrl;

  const articles = selectedMarket
    ? catalog.articles.filter((a) => a.countryCode === selectedMarket.code)
    : catalog.articles.slice(0, 24);

  const pageTitle = selectedMarket
    ? `${selectedMarket.flag} CycleCipher (${selectedMarket.country}) — 100% Private Period & Ovulation Tracker`
    : `CycleCipher — The World's First Zero-Knowledge Menstrual & Cycle Tracker for iPhone`;

  return `<!DOCTYPE html>
<html lang="${selectedMarket ? escapeHtml(selectedMarket.locale) : "en"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="apple-itunes-app" content="app-id=${appConfig.numericAppId}, app-argument=${escapeHtml(appStoreUrl)}" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(appConfig.elevatorPitch)}" />
  <link rel="canonical" href="${appConfig.siteUrl}${selectedMarket ? `/${selectedMarket.code}` : "/"}" />
  ${renderHreflangTags()}
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(appConfig.tagline)}" />
  <meta property="og:image" content="${appConfig.logoUrl}" />
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a class="brand" href="/">
        <img src="/cyclecipher-logo.jpg" alt="CycleCipher Logo" />
        <span>CycleCipher</span>
      </a>
      <span class="pill">${selectedMarket ? `${selectedMarket.flag} ${escapeHtml(selectedMarket.country)}` : "🌍 Available Worldwide on iOS"}</span>
    </nav>

    <header class="hero">
      <img src="/cyclecipher-logo.jpg" alt="CycleCipher Logo" />
      <h1>${selectedMarket ? `CycleCipher — ${escapeHtml(selectedMarket.country)}` : "Track Your Body Without Being Tracked."}</h1>
      <p class="subtitle">${escapeHtml(appConfig.elevatorPitch)}</p>
      <a class="cta-btn" href="${escapeHtml(appStoreUrl)}">🍎 Download Free on the App Store (30-Day Free Trial)</a>
      <div class="badges">
        <span class="badge">🔒 AES-256 iPhone Secure Enclave</span>
        <span class="badge">📊 ACOG, NHS & Mayo Referenced</span>
        <span class="badge">💎 €9.99 / $8.99 One-Time Lifetime (No Subscriptions)</span>
      </div>
    </header>

    ${
      articles.length > 0
        ? `<section class="card">
            <h2>📚 Latest Guides & Privacy Insights${selectedMarket ? ` (${escapeHtml(selectedMarket.country)})` : ""}</h2>
            ${articles
              .map(
                (a) => `
              <div style="padding:14px 0; border-bottom:1px solid #f1f5f9;">
                <div style="font-size:12px; color:#64748b; font-weight:600;">${a.flag} ${escapeHtml(a.countryName)} · ${escapeHtml(a.lang)}</div>
                <a href="/${escapeHtml(a.countryCode)}/${escapeHtml(a.slug)}" style="font-size:17px; font-weight:600; color:#0f172a; text-decoration:none;">
                  ${escapeHtml(a.title)}
                </a>
                <p style="margin:4px 0 0 0; font-size:14px; color:#475569;">${escapeHtml(a.metaDescription)}</p>
              </div>`
              )
              .join("")}
          </section>`
        : ""
    }

    <section class="card">
      <h2>🌍 Official Apple App Store Regions (${appConfig.globalMarkets.length} Countries)</h2>
      <div class="grid">
        ${appConfig.globalMarkets
          .map(
            (m) => `
          <a class="country-link" href="/${m.code}">
            <span>${m.flag} ${escapeHtml(m.country)}</span>
            <span style="color:#64748b; font-size:12px;">${m.code.toUpperCase()} →</span>
          </a>`
          )
          .join("")}
      </div>
    </section>

    <footer>
      <p><a href="/sitemap.xml">Sitemap</a> · <a href="/rss.xml">RSS Feed</a> · <a href="${escapeHtml(appStoreUrl)}">Apple App Store</a></p>
      <p>© ${new Date().getFullYear()} CycleCipher — Zero-Knowledge Menstrual & Cycle Tracker.</p>
    </footer>
  </div>
</body>
</html>`;
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  // Beveiligd endpoint om direct een cloud-run te starten (alleen met jouw geheime RESEND_API_KEY)
  if (pathname === "/api/run-promo" && req.method === "POST") {
    const auth = req.headers.get("authorization") || "";
    const expected = `Bearer ${Netlify.env.get("RESEND_API_KEY")}`;
    if (!Netlify.env.get("RESEND_API_KEY") || auth !== expected) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await runDailyPromoCycle();
    return Response.json(result);
  }

  // IndexNow verificatie-bestand
  if (pathname === `/${appConfig.indexNowKey}.txt`) {
    return new Response(appConfig.indexNowKey, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Robots.txt — verwelkom zowel Google/Bing/DuckDuckGo als AI-zoekmachines (ChatGPT, Perplexity, Apple)
  if (pathname === "/robots.txt") {
    const robots = [
      "User-agent: *",
      "Allow: /",
      `Sitemap: ${appConfig.siteUrl}/sitemap.xml`,
    ].join("\n");
    return new Response(robots, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const store = getStore({ name: "cyclecipher-promo", consistency: "strong" });
  const catalog: PromoCatalog = (await store.get("catalog", { type: "json" })) || {
    totalRuns: 0,
    seenRedditUrls: [],
    articles: [],
  };

  // Dynamische XML Sitemap voor Google, Bing, DuckDuckGo, Naver & AI crawlers
  if (pathname === "/sitemap.xml") {
    const urls = [
      `${appConfig.siteUrl}/`,
      ...appConfig.globalMarkets.map((m) => `${appConfig.siteUrl}/${m.code}`),
      ...catalog.articles.map((a) => a.pageUrl),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join("\n")}
</urlset>`;
    return new Response(xml, {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  }

  // Dynamische RSS Feed
  if (pathname === "/rss.xml") {
    const items = catalog.articles
      .slice(0, 50)
      .map(
        (a) => `    <item>
      <title>${escapeHtml(a.title)}</title>
      <link>${escapeHtml(a.pageUrl)}</link>
      <guid>${escapeHtml(a.pageUrl)}</guid>
      <description>${escapeHtml(a.metaDescription)}</description>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
    </item>`
      )
      .join("\n");
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CycleCipher Global Privacy & Cycle Guides</title>
    <link>${appConfig.siteUrl}</link>
    <description>${escapeHtml(appConfig.elevatorPitch)}</description>
${items}
  </channel>
</rss>`;
    return new Response(rss, {
      headers: { "content-type": "application/rss+xml; charset=utf-8" },
    });
  }

  // Homepage
  if (pathname === "/") {
    return new Response(renderCountryOrHomeHub(catalog), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const parts = pathname.split("/").filter(Boolean);

  // Land-hub: /:country (bijv. /nl, /de, /jp, /us)
  if (parts.length === 1) {
    const market = appConfig.globalMarkets.find(
      (m) => m.code === parts[0].toLowerCase()
    );
    if (market) {
      return new Response(renderCountryOrHomeHub(catalog, market), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }

  // Artikel-pagina: /:country/:slug
  if (parts.length === 2) {
    const [countryCode, slug] = parts;
    const article: PublishedArticle | null = await store.get(
      `article:${countryCode.toLowerCase()}:${slug}`,
      { type: "json" }
    );
    if (article) {
      return new Response(renderArticlePage(article), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }

  return new Response(renderCountryOrHomeHub(catalog), {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

export const config: Config = {
  path: "/*",
  preferStatic: true,
};
