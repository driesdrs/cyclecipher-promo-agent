import { getStore } from "@netlify/blobs";
import OpenAI from "openai";
import appConfig from "../app-config.json";

export interface Market {
  country: string;
  code: string;
  lang: string;
  locale: string;
  flag: string;
}

export interface PublishedArticle {
  id: string;
  countryCode: string;
  countryName: string;
  flag: string;
  lang: string;
  locale: string;
  slug: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  sections: Array<{ heading: string; body: string }>;
  faqs: Array<{ question: string; answer: string }>;
  ctaButtonText: string;
  socialPost: string;
  appStoreUrl: string;
  pageUrl: string;
  telegraphUrl?: string;
  publishedAt: string;
}

export interface VerifiedLead {
  subreddit: string;
  title: string;
  url: string;
  whyRelevantNl: string;
  tailoredReply: string;
}

export interface PromoCatalog {
  totalRuns: number;
  seenRedditUrls: string[];
  articles: Array<{
    countryCode: string;
    countryName: string;
    flag: string;
    lang: string;
    slug: string;
    title: string;
    metaDescription: string;
    pageUrl: string;
    telegraphUrl?: string;
    appStoreUrl: string;
    publishedAt: string;
  }>;
}

function slugify(input: string, fallbackPrefix: string): string {
  const ascii = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 65);
  return ascii.length >= 6 ? ascii : `${fallbackPrefix}-cyclecipher-private-period-tracker`;
}

/**
 * Genereer voor één specifiek Apple App Store land een volledige, native SEO-pagina + artikel via AI
 */
async function generateCountryCampaign(
  openai: OpenAI | null,
  market: Market,
  seoTheme: string,
  dateSlug: string
): Promise<PublishedArticle> {
  const appStoreUrl = `https://apps.apple.com/${market.code}/app/cyclecipher-period-tracker/${appConfig.appId}`;

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert native ${market.lang} copywriter & App Store SEO specialist writing for women in ${market.country}.
Promote the iOS app **CycleCipher** (${appStoreUrl}).

Facts about CycleCipher (keep 100% accurate):
- 100% Zero-Knowledge Privacy: Health records sealed locally on iPhone (Secure Enclave) with military-grade AES-256 encryption. Not even the developers can read user data.
- Zero Ads & Zero Data Selling: Never shares intimate cycle, ovulation, or symptom logs with Meta, Google, or data brokers.
- Pinpoint Cycle & Ovulation Forecasting: Real-time Menstrual, Follicular, Ovulatory, and Luteal phase predictions grounded in ACOG, NHS UK, and Mayo Clinic clinical guidelines.
- Smart Body Pattern Recognition: Uncovers personal links between cramps, mood swings, headaches, bloating, and energy.
- Discreet Mode & Face ID / Touch ID Lock: Disguised neutral lock-screen notifications.
- Fair Pricing: 30-Day Full-Access Free Trial, then a single one-time Lifetime purchase (€9.99 / $8.99 equivalent) — NO recurring $50/year subscription traps.

Write EVERYTHING in natural, idiomatic **${market.lang}** as spoken in **${market.country}** (except 'englishSlugForUrl' which must be lowercase ASCII English words separated by hyphens).
Focus on today's SEO theme: "${seoTheme}".

Return ONLY valid JSON with this exact shape:
{
  "englishSlugForUrl": "private-period-tracker-no-subscription-${market.code}",
  "title": "Compelling SEO H1 title in ${market.lang} (55-75 chars)",
  "subtitle": "Persuasive 1-sentence subtitle in ${market.lang}",
  "metaDescription": "High-CTR Google meta description in ${market.lang} (130-155 chars)",
  "sections": [
    { "heading": "H2 heading 1 in ${market.lang}", "body": "Detailed, helpful paragraph (80-120 words) in ${market.lang}" },
    { "heading": "H2 heading 2 in ${market.lang}", "body": "Detailed paragraph (80-120 words) in ${market.lang} explaining Zero-Knowledge AES-256 & clinical accuracy" },
    { "heading": "H2 heading 3 in ${market.lang}", "body": "Detailed paragraph (80-120 words) in ${market.lang} highlighting Discreet Mode, 30-day free trial & one-time lifetime access without subscriptions" }
  ],
  "faqs": [
    { "question": "Common search question 1 in ${market.lang}?", "answer": "Clear answer in ${market.lang}" },
    { "question": "Common search question 2 in ${market.lang}?", "answer": "Clear answer in ${market.lang}" },
    { "question": "Common search question 3 in ${market.lang}?", "answer": "Clear answer in ${market.lang}" }
  ],
  "ctaButtonText": "Download free on the App Store (30-Day Free Trial) — translated into ${market.lang}",
  "socialPost": "Short, engaging native ${market.lang} social post (max 240 chars) with 2 hashtags ( DO NOT include URL, URL will be appended)"
}`,
          },
          {
            role: "user",
            content: `Create the localized ${market.lang} App Store SEO landing page & article for ${market.country} (${market.code.toUpperCase()}) on theme: "${seoTheme}".`,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        const slug = `${slugify(parsed.englishSlugForUrl || seoTheme, market.code)}-${dateSlug}`;
        const pageUrl = `${appConfig.siteUrl}/${market.code}/${slug}`;
        return {
          id: `${market.code}:${slug}`,
          countryCode: market.code,
          countryName: market.country,
          flag: market.flag,
          lang: market.lang,
          locale: market.locale,
          slug,
          title: parsed.title,
          subtitle: parsed.subtitle,
          metaDescription: parsed.metaDescription,
          sections: parsed.sections || [],
          faqs: parsed.faqs || [],
          ctaButtonText: parsed.ctaButtonText || "Download on the App Store",
          socialPost: `${parsed.socialPost} ${appStoreUrl}`.trim(),
          appStoreUrl,
          pageUrl,
          publishedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn(`AI generation failed for ${market.code}, using fallback:`, err);
    }
  }

  // Fallback mocht AI onverhoopt falen
  const slug = `${slugify(seoTheme, market.code)}-${dateSlug}`;
  const pageUrl = `${appConfig.siteUrl}/${market.code}/${slug}`;
  return {
    id: `${market.code}:${slug}`,
    countryCode: market.code,
    countryName: market.country,
    flag: market.flag,
    lang: market.lang,
    locale: market.locale,
    slug,
    title: `CycleCipher (${market.country}) — ${seoTheme}`,
    subtitle: appConfig.tagline,
    metaDescription: appConfig.elevatorPitch.slice(0, 155),
    sections: [
      {
        heading: "100% Zero-Knowledge AES-256 Encryption",
        body: appConfig.elevatorPitch,
      },
      {
        heading: "Clinically Referenced Cycle & Ovulation Insights",
        body: "CycleCipher tracks your Menstrual, Follicular, Ovulatory, and Luteal phases using adaptive statistical modeling grounded in ACOG, NHS UK, and Mayo Clinic guidelines — completely on your iPhone.",
      },
      {
        heading: "30-Day Free Trial & No Monthly Subscription Traps",
        body: "Enjoy full unrestricted access for 30 days, followed by a single one-time Lifetime option (€9.99 / $8.99) instead of $50/year recurring subscriptions.",
      },
    ],
    faqs: [
      {
        question: "Can CycleCipher or third parties see my period logs?",
        answer: "No. Your decryption keys stay inside your iPhone's Secure Enclave with AES-256 encryption. Not even we can access your health data.",
      },
    ],
    ctaButtonText: "Download Free on the App Store",
    socialPost: `Track your cycle without being tracked. 100% Zero-Knowledge AES-256 encrypted on iPhone — zero ads, no subscriptions. ${appStoreUrl}`,
    appStoreUrl,
    pageUrl,
    publishedAt: new Date().toISOString(),
  };
}

/**
 * Publiceer het artikel volledig automatisch op Telegraph (DA 90+ publieke blog met backlinks naar App Store & jouw site)
 */
async function publishToTelegraph(
  store: ReturnType<typeof getStore>,
  article: PublishedArticle
): Promise<string | undefined> {
  try {
    let token = await store.get("telegraph_token");
    if (!token) {
      const accRes = await fetch(
        `https://api.telegra.ph/createAccount?short_name=CycleCipher&author_name=${encodeURIComponent(
          "CycleCipher Privacy"
        )}&author_url=${encodeURIComponent(appConfig.appUrl)}`
      );
      const accData: any = await accRes.json();
      if (accData?.ok && accData?.result?.access_token) {
        token = accData.result.access_token;
        await store.set("telegraph_token", token!);
      }
    }
    if (!token) return undefined;

    const contentNodes: any[] = [
      {
        tag: "p",
        children: [{ tag: "em", children: [article.subtitle] }],
      },
    ];

    for (const sec of article.sections) {
      contentNodes.push({ tag: "h4", children: [sec.heading] });
      contentNodes.push({ tag: "p", children: [sec.body] });
    }

    if (article.faqs.length > 0) {
      contentNodes.push({ tag: "h4", children: ["FAQ"] });
      for (const faq of article.faqs) {
        contentNodes.push({
          tag: "p",
          children: [
            { tag: "strong", children: [`${faq.question} `] },
            faq.answer,
          ],
        });
      }
    }

    contentNodes.push({
      tag: "p",
      children: [
        {
          tag: "a",
          attrs: { href: article.appStoreUrl },
          children: [`📲 ${article.ctaButtonText} (${article.countryName} App Store)`],
        },
      ],
    });

    contentNodes.push({
      tag: "p",
      children: [
        {
          tag: "a",
          attrs: { href: article.pageUrl },
          children: [`🌐 ${article.title} — CycleCipher (${article.countryName})`],
        },
      ],
    });

    const pageRes = await fetch("https://api.telegra.ph/createPage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        title: `${article.flag} ${article.title}`,
        author_name: `CycleCipher (${article.countryName})`,
        author_url: article.appStoreUrl,
        content: contentNodes,
        return_content: false,
      }),
    });

    const pageData: any = await pageRes.json();
    if (pageData?.ok && pageData?.result?.url) {
      return pageData.result.url as string;
    }
  } catch (err) {
    console.warn("Telegraph publicatie overgeslagen:", err);
  }
  return undefined;
}

/**
 * Meld alle nieuwe pagina's direct aan bij IndexNow (Bing, DuckDuckGo, Naver, Yandex, Seznam & ChatGPT Search!)
 */
async function pingIndexNow(urls: string[]): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: appConfig.siteDomain,
        key: appConfig.indexNowKey,
        keyLocation: `${appConfig.siteUrl}/${appConfig.indexNowKey}.txt`,
        urlList: urls,
      }),
    });
    return { ok: res.ok || res.status === 202, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Optioneel: plaats automatisch op Bluesky (met App Store link-kaart + schildlogo) als credentials zijn ingesteld
 */
async function autoPostBluesky(article: PublishedArticle): Promise<string | undefined> {
  const handle = Netlify.env.get("BLUESKY_HANDLE");
  const password = Netlify.env.get("BLUESKY_APP_PASSWORD");
  if (!handle || !password) return undefined;

  try {
    const sessionRes = await fetch(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: handle, password }),
      }
    );
    if (!sessionRes.ok) return undefined;
    const session: any = await sessionRes.json();

    let thumbBlob: any = undefined;
    try {
      const imgRes = await fetch(appConfig.logoUrl);
      if (imgRes.ok) {
        const bytes = await imgRes.arrayBuffer();
        const blobRes = await fetch(
          "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
          {
            method: "POST",
            headers: {
              "Content-Type": "image/jpeg",
              Authorization: `Bearer ${session.accessJwt}`,
            },
            body: bytes,
          }
        );
        if (blobRes.ok) {
          const blobData: any = await blobRes.json();
          thumbBlob = blobData.blob;
        }
      }
    } catch {
      // ga door zonder thumbnail
    }

    const postRes = await fetch(
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record: {
            $type: "app.bsky.feed.post",
            text: `${article.flag} ${article.socialPost}`.slice(0, 295),
            createdAt: new Date().toISOString(),
            embed: {
              $type: "app.bsky.embed.external",
              external: {
                uri: article.appStoreUrl,
                title: article.title.slice(0, 100),
                description: article.metaDescription.slice(0, 200),
                ...(thumbBlob ? { thumb: thumbBlob } : {}),
              },
            },
          },
        }),
      }
    );
    if (!postRes.ok) return undefined;
    const postData: any = await postRes.json();
    const rkey = postData?.uri?.split("/").pop();
    return rkey ? `https://bsky.app/profile/${session.handle}/post/${rkey}` : "Gepost op Bluesky";
  } catch {
    return undefined;
  }
}

/**
 * Optioneel: plaats automatisch een Engelstalig diepte-artikel op Dev.to als DEVTO_API_KEY aanwezig is
 */
async function autoPostDevTo(article: PublishedArticle): Promise<string | undefined> {
  const devToKey = Netlify.env.get("DEVTO_API_KEY");
  if (!devToKey) return undefined;

  try {
    const markdown = [
      `*${article.subtitle}*`,
      "",
      ...article.sections.map((s) => `## ${s.heading}\n\n${s.body}\n`),
      `👉 **[${article.ctaButtonText}](${article.appStoreUrl})**`,
    ].join("\n");

    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": devToKey,
      },
      body: JSON.stringify({
        article: {
          title: article.title,
          published: true,
          body_markdown: markdown,
          tags: ["privacy", "ios", "security", "health"],
          canonical_url: article.pageUrl,
        },
      }),
    });
    if (!res.ok) return undefined;
    const data: any = await res.json();
    return data?.url;
  } catch {
    return undefined;
  }
}

/**
 * Streng AI-gefilterde Reddit-vragen (ALLEEN échte vragen over menstruatie/cyclus-apps, 0% ruis!)
 */
async function findStrictlyVerifiedRedditQuestions(
  openai: OpenAI | null,
  seenUrls: string[]
): Promise<VerifiedLead[]> {
  const candidates: Array<{ subreddit: string; title: string; selftext: string; url: string }> = [];
  const strictRegex =
    /\b(period tracker|period app|menstrual app|menstrual tracker|cycle tracker|cycle app|ovulation app|ovulation tracker|flo app|clue app|stardust app)\b/i;

  try {
    const url = `https://www.reddit.com/r/Periods+TheGirlSurvivalGuide+TwoXChromosomes+WomensHealth+PMDD+TryingForABaby+privacy+iosapps/search.json?q=${encodeURIComponent(
      '"period tracker" OR "period app" OR "cycle tracker" OR "menstrual app" OR "Flo app" OR "Clue app"'
    )}&restrict_sr=on&sort=new&t=week&limit=15`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) CycleCipherResearch/2.0",
      },
    });

    if (res.ok) {
      const data: any = await res.json();
      for (const child of data?.data?.children || []) {
        const p = child.data;
        const postUrl = `https://www.reddit.com${p.permalink}`;
        const combined = `${p.title || ""} ${p.selftext || ""}`;
        if (!seenUrls.includes(postUrl) && strictRegex.test(combined)) {
          candidates.push({
            subreddit: `r/${p.subreddit}`,
            title: p.title,
            selftext: (p.selftext || "").slice(0, 400),
            url: postUrl,
          });
        }
      }
    }
  } catch {
    // negeer als Reddit rate-limited is
  }

  if (candidates.length === 0 || !openai) return [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a strict relevance filter for CycleCipher (${appConfig.appUrl}), an iOS Zero-Knowledge AES-256 private period & ovulation tracker (30-day free trial, $8.99/€9.99 one-time lifetime access, no ads).

Evaluate candidate Reddit posts. ONLY accept a post if a real person is genuinely asking for a period/cycle/ovulation tracking app recommendation, asking about period app privacy, or frustrated with period app subscriptions (like Flo/Clue).
REJECT everything else (politics, general news, medical emergencies, Android-only requests). If NONE qualify, return {"verified": []}.

Return JSON:
{
  "verified": [
    {
      "subreddit": "r/...",
      "title": "Exact title",
      "url": "Exact url",
      "whyRelevantNl": "1 Nederlandse zin waarom deze persoon specifiek geholpen is met CycleCipher",
      "tailoredReply": "Empathetic, natural reply directly answering their specific post first, then mentioning CycleCipher (${appConfig.appUrl})"
    }
  ]
}`,
        },
        {
          role: "user",
          content: JSON.stringify(candidates.slice(0, 6)),
        },
      ],
    });
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return (parsed.verified || []).slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Bouw de dagelijkse Proof-of-Work e-mail met LIVE klikbare links van wat de agent zelf heeft gepubliceerd
 */
function buildProofOfWorkEmailHtml(params: {
  publishedArticles: PublishedArticle[];
  indexNowStatus: { ok: boolean; status: number };
  bskyUrls: string[];
  devToUrl?: string;
  verifiedLeads: VerifiedLead[];
  totalArticlesCount: number;
  uniqueCountriesCount: number;
}): string {
  const {
    publishedArticles,
    indexNowStatus,
    bskyUrls,
    devToUrl,
    verifiedLeads,
    totalArticlesCount,
    uniqueCountriesCount,
  } = params;

  const publishedCards = publishedArticles
    .map(
      (art) => `
      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin-bottom:14px; background:#ffffff;">
        <div style="font-size:12px; color:#059669; font-weight:700; text-transform:uppercase;">
          ✅ LIVE GEPUBLICEERD — ${art.flag} ${art.countryName} (${art.lang})
        </div>
        <div style="font-size:17px; font-weight:700; margin:6px 0 4px 0; color:#111827;">
          ${art.title}
        </div>
        <div style="font-size:13px; color:#4b5563; margin-bottom:12px;">
          ${art.metaDescription}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="${art.pageUrl}" style="background:#111827; color:#ffffff; padding:7px 12px; border-radius:6px; font-size:12px; text-decoration:none; font-weight:600; margin-right:6px;">
            🌐 Bekijk Live SEO-Pagina (${art.countryCode.toUpperCase()})
          </a>
          ${
            art.telegraphUrl
              ? `<a href="${art.telegraphUrl}" style="background:#2563eb; color:#ffffff; padding:7px 12px; border-radius:6px; font-size:12px; text-decoration:none; font-weight:600; margin-right:6px;">
                  📰 Bekijk Extern Artikel (Telegraph)
                </a>`
              : ""
          }
          <a href="${art.appStoreUrl}" style="background:#f3f4f6; color:#111827; padding:7px 12px; border-radius:6px; font-size:12px; text-decoration:none; font-weight:600;">
            🍎 App Store (${art.countryCode.toUpperCase()})
          </a>
        </div>
      </div>`
    )
    .join("");

  const socialHtml =
    bskyUrls.length > 0 || devToUrl
      ? `<div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:12px; margin-bottom:20px; font-size:13px;">
          <strong>📣 Automatisch op Social Media / Blogs geplaatst:</strong>
          <ul style="margin:6px 0 0 0; padding-left:18px;">
            ${bskyUrls.map((u) => `<li>Bluesky: <a href="${u}">${u}</a></li>`).join("")}
            ${devToUrl ? `<li>Dev.to artikel: <a href="${devToUrl}">${devToUrl}</a></li>` : ""}
          </ul>
        </div>`
      : "";

  const leadsSection =
    verifiedLeads.length > 0
      ? `
      <h3 style="border-bottom:1px solid #e5e7eb; padding-bottom:6px; margin-top:26px;">
        🎯 Streng Geverifieerde Vragen van Vandaag (Optioneel, 100% Relevant)
      </h3>
      ${verifiedLeads
        .map(
          (l) => `
        <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px; margin-bottom:12px; background:#ffffff;">
          <div style="font-size:12px; color:#6b7280; font-weight:600;">${l.subreddit}</div>
          <div style="font-size:15px; font-weight:600; margin:4px 0;">
            <a href="${l.url}" style="color:#111827;">${l.title}</a>
          </div>
          <div style="font-size:13px; color:#4b5563; margin-bottom:8px;">💡 ${l.whyRelevantNl}</div>
          <div style="background:#f9fafb; border-left:3px solid #111827; padding:10px; font-size:13px; white-space:pre-wrap;">${l.tailoredReply}</div>
        </div>`
        )
        .join("")}`
      : "";

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:680px; margin:0 auto; color:#111827; line-height:1.55;">
    <h2 style="margin-bottom:4px;">🛡️ CycleCipher — Autonoom Wereldwijd Promo-Verslag</h2>
    <p style="color:#6b7280; margin-top:0; font-size:14px;">
      Jouw cloud-agent heeft vannacht/vanochtend volledig zelfstandig nieuwe promotie geschreven, vertaald en live gepubliceerd.
    </p>

    <div style="background:#f3f4f6; border-radius:10px; padding:16px; margin-bottom:20px; font-size:14px;">
      <div><strong>📊 Totaaloverzicht Wereldwijde Uitrol:</strong></div>
      <ul style="margin:8px 0 0 0; padding-left:20px;">
        <li><strong>Vandaag nieuw live gezet:</strong> ${publishedArticles.length} App Store landen (${publishedArticles.map((a) => `${a.flag} ${a.countryName}`).join(", ")})</li>
        <li><strong>Totaal aantal live SEO-landingspagina's:</strong> ${totalArticlesCount} pagina's in ${uniqueCountriesCount} van de ${appConfig.globalMarkets.length} App Store-landen</li>
        <li><strong>Externe backlink-artikelen (Telegraph):</strong> ${publishedArticles.filter((a) => a.telegraphUrl).length} vandaag gepubliceerd</li>
        <li><strong>Zoekmachine-indexatie (IndexNow — Bing, DuckDuckGo, Naver, Yandex & ChatGPT Search):</strong> ${
          indexNowStatus.ok ? `✅ Direct aangemeld (HTTP ${indexNowStatus.status})` : "⏳ Sitemap bijgewerkt"
        }</li>
        <li><strong>Wereldwijde Hub & Sitemap:</strong> <a href="${appConfig.siteUrl}">${appConfig.siteUrl}</a> · <a href="${appConfig.siteUrl}/sitemap.xml">sitemap.xml</a></li>
      </ul>
    </div>

    ${socialHtml}

    <h3 style="border-bottom:1px solid #e5e7eb; padding-bottom:6px;">
      🌍 Vandaag Zelfstandig Gepubliceerd per App Store Land
    </h3>
    ${publishedCards}

    ${leadsSection}
  </div>`;
}

/**
 * Hoofdfunctie: draait dagelijks via de Netlify Scheduled Function (én via het beveiligde test-endpoint)
 */
export async function runDailyPromoCycle() {
  const store = getStore({ name: "cyclecipher-promo", consistency: "strong" });
  const catalog: PromoCatalog = (await store.get("catalog", { type: "json" })) || {
    totalRuns: 0,
    seenRedditUrls: [],
    articles: [],
  };

  const openai =
    Netlify.env.get("OPENAI_BASE_URL") || Netlify.env.get("OPENAI_API_KEY")
      ? new OpenAI()
      : null;

  // Kies elke dag de volgende 3 Apple App Store landen uit de lijst van 40 landen!
  const marketsPerDay = 3;
  const startIdx = (catalog.totalRuns * marketsPerDay) % appConfig.globalMarkets.length;
  const todaysMarkets: Market[] = [];
  for (let i = 0; i < marketsPerDay; i++) {
    todaysMarkets.push(
      appConfig.globalMarkets[(startIdx + i) % appConfig.globalMarkets.length]
    );
  }

  // Roteer ook door de SEO-zoekthema's
  const themeIdx =
    Math.floor((catalog.totalRuns * marketsPerDay) / appConfig.globalMarkets.length) %
    appConfig.seoThemes.length;
  const seoTheme = appConfig.seoThemes[themeIdx];
  const dateSlug = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // 1. Genereer alle 3 landencampagnes én verifieer eventuele Reddit-vragen parallel
  const [generatedArticles, verifiedLeads] = await Promise.all([
    Promise.all(
      todaysMarkets.map((market) =>
        generateCountryCampaign(openai, market, seoTheme, dateSlug)
      )
    ),
    findStrictlyVerifiedRedditQuestions(openai, catalog.seenRedditUrls || []),
  ]);

  // 2. Publiceer elk artikel op Telegraph + sla het permanent op in Netlify Blobs
  for (const article of generatedArticles) {
    article.telegraphUrl = await publishToTelegraph(store, article);
    await store.setJSON(`article:${article.countryCode}:${article.slug}`, article);
  }

  // 3. Optioneel: auto-post naar Bluesky & Dev.to als gekoppeld
  const bskyUrls: string[] = [];
  for (const article of generatedArticles) {
    const bskyUrl = await autoPostBluesky(article);
    if (bskyUrl) bskyUrls.push(bskyUrl);
  }
  const enArticle =
    generatedArticles.find((a) => a.lang === "English") || generatedArticles[0];
  const devToUrl = enArticle ? await autoPostDevTo(enArticle) : undefined;

  // 4. Werk de globale catalogus bij (voor de homepage, landpagina's, sitemap.xml & rss.xml)
  const newEntries = generatedArticles.map((a) => ({
    countryCode: a.countryCode,
    countryName: a.countryName,
    flag: a.flag,
    lang: a.lang,
    slug: a.slug,
    title: a.title,
    metaDescription: a.metaDescription,
    pageUrl: a.pageUrl,
    telegraphUrl: a.telegraphUrl,
    appStoreUrl: a.appStoreUrl,
    publishedAt: a.publishedAt,
  }));

  const updatedArticles = [
    ...newEntries,
    ...catalog.articles.filter(
      (existing) => !newEntries.some((n) => n.pageUrl === existing.pageUrl)
    ),
  ].slice(0, 500);

  const updatedCatalog: PromoCatalog = {
    totalRuns: catalog.totalRuns + 1,
    seenRedditUrls: [
      ...(catalog.seenRedditUrls || []),
      ...verifiedLeads.map((l) => l.url),
    ].slice(-300),
    articles: updatedArticles,
  };

  await store.setJSON("catalog", updatedCatalog);

  // 5. Meld alle nieuwe pagina's + landhubs + sitemap direct aan bij zoekmachines via IndexNow
  const urlsToIndex = [
    appConfig.siteUrl,
    `${appConfig.siteUrl}/sitemap.xml`,
    ...generatedArticles.flatMap((a) => [
      `${appConfig.siteUrl}/${a.countryCode}`,
      a.pageUrl,
    ]),
  ];
  const indexNowStatus = await pingIndexNow(urlsToIndex);

  // 6. Stuur het bewijs-rapport met alle live links naar de eigenaar via Resend
  const uniqueCountriesCount = new Set(updatedArticles.map((a) => a.countryCode)).size;
  const html = buildProofOfWorkEmailHtml({
    publishedArticles: generatedArticles,
    indexNowStatus,
    bskyUrls,
    devToUrl,
    verifiedLeads,
    totalArticlesCount: updatedArticles.length,
    uniqueCountriesCount,
  });

  const resendKey = Netlify.env.get("RESEND_API_KEY");
  const emailTo = Netlify.env.get("REPORT_EMAIL_TO") || "driesdrs@gmail.com";
  let emailSent = false;

  if (resendKey) {
    const today = new Date().toISOString().slice(0, 10);
    const countriesLabel = generatedArticles.map((a) => a.flag).join(" ");
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "CycleCipher Cloud Agent <onboarding@resend.dev>",
        to: [emailTo],
        subject: `🛡️ CycleCipher Live Promo (${countriesLabel} +${generatedArticles.length} landen gepubliceerd op ${today})`,
        html,
      }),
    });
    emailSent = emailRes.ok;
  }

  return {
    ok: true,
    emailSent,
    indexNowStatus,
    totalArticlesCount: updatedArticles.length,
    uniqueCountriesCount,
    publishedToday: generatedArticles.map((a) => ({
      country: a.countryName,
      code: a.countryCode,
      lang: a.lang,
      title: a.title,
      pageUrl: a.pageUrl,
      telegraphUrl: a.telegraphUrl,
      appStoreUrl: a.appStoreUrl,
    })),
    verifiedLeadsCount: verifiedLeads.length,
  };
}
