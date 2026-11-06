import fs from "node:fs/promises";
import path from "node:path";

const CONFIG_PATH = path.resolve("app-config.json");
const HISTORY_PATH = path.resolve("history.json");
const DOCS_DIR = path.resolve("docs");

// Gratis AI via GitHub Models (gebruikt automatisch GITHUB_TOKEN in GitHub Actions met `models: read`)
const AI_BASE_URL =
  process.env.AI_BASE_URL || "https://models.github.ai/inference/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const AI_API_KEY = process.env.AI_API_KEY || process.env.GITHUB_TOKEN;

// Resend configuratie (gratis tot 3.000 mails/maand)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REPORT_EMAIL_TO = process.env.REPORT_EMAIL_TO;
const REPORT_EMAIL_FROM =
  process.env.REPORT_EMAIL_FROM || "CycleCipher Agent <onboarding@resend.dev>";

// Optioneel: Bluesky credentials om automatisch posts + logo + App Store card te plaatsen
const BLUESKY_HANDLE = process.env.BLUESKY_HANDLE;
const BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;

// Optioneel: Mastodon credentials (erg populair in de privacy-community!)
const MASTODON_INSTANCE_URL = process.env.MASTODON_INSTANCE_URL;
const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

/**
 * 1A. Zoek recente discussies op Reddit (zowel op keywords als in specifieke subreddits)
 */
async function fetchRedditLeads(config, seenUrls) {
  const leads = [];
  const urlsToFetch = [
    `https://www.reddit.com/search.json?q=${encodeURIComponent(
      '("period tracker" OR "period app" OR "cycle tracker" OR "Flo app" OR "Clue app") AND (privacy OR subscription OR alternative OR encrypted OR recommendation OR recommend)'
    )}&sort=new&t=month&limit=15`,
    `https://www.reddit.com/r/privacy+degoogle+Periods+TheGirlSurvivalGuide+iosapps/search.json?q=${encodeURIComponent(
      "period tracker OR cycle tracker OR menstrual app"
    )}&restrict_sr=on&sort=new&t=month&limit=15`,
  ];

  for (const url of urlsToFetch) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "CycleCipherPromoAgent/1.0" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const children = data?.data?.children || [];

      for (const item of children) {
        const post = item.data;
        const postUrl = `https://www.reddit.com${post.permalink}`;
        if (seenUrls.includes(postUrl) || leads.some((l) => l.url === postUrl)) {
          continue;
        }

        leads.push({
          source: `Reddit (r/${post.subreddit})`,
          title: post.title,
          snippet: (post.selftext || "").slice(0, 350),
          url: postUrl,
        });
      }
    } catch (err) {
      console.warn("Kon Reddit niet ophalen:", err.message);
    }
  }
  return leads.slice(0, 10);
}

/**
 * 1B. Zoek recente discussies op Hacker News (privacy / health apps / femtech)
 */
async function fetchHackerNewsLeads(config, seenUrls) {
  const leads = [];
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
    "period tracker OR health data privacy OR reproductive privacy"
  )}&tags=story,ask_hn&hitsPerPage=8`;

  try {
    const res = await fetch(url);
    if (!res.ok) return leads;
    const data = await res.json();

    for (const hit of data.hits || []) {
      const postUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      if (seenUrls.includes(postUrl)) continue;

      leads.push({
        source: "Hacker News",
        title: hit.title,
        snippet: (hit.story_text || "").replace(/<[^>]+>/g, "").slice(0, 350),
        url: postUrl,
      });
    }
  } catch (err) {
    console.warn("Kon Hacker News niet ophalen:", err.message);
  }
  return leads.slice(0, 4);
}

/**
 * 1C. Zoek in de Fediverse / Lemmy privacy-communities
 */
async function fetchLemmyLeads(config, seenUrls) {
  const leads = [];
  const url = `https://lemmy.ml/api/v3/search?q=${encodeURIComponent(
    "period tracker"
  )}&type_=Posts&sort=New&limit=5`;

  try {
    const res = await fetch(url);
    if (!res.ok) return leads;
    const data = await res.json();

    for (const item of data.posts || []) {
      const postUrl = item.post?.ap_id || `https://lemmy.ml/post/${item.post?.id}`;
      if (seenUrls.includes(postUrl)) continue;

      leads.push({
        source: `Lemmy (${item.community?.name || "privacy"})`,
        title: item.post?.name,
        snippet: (item.post?.body || "").slice(0, 300),
        url: postUrl,
      });
    }
  } catch (err) {
    console.warn("Kon Lemmy niet ophalen:", err.message);
  }
  return leads.slice(0, 3);
}

/**
 * Fallback generator zodat het dagelijkse rapport ook werkt als de AI-endpoint
 * tijdelijk niet bereikbaar of gelimiteerd is.
 */
function buildDeterministicPromoPlan(config, leads, angleOfDay, marketOfDay) {
  const localizedAppUrl = `https://apps.apple.com/${marketOfDay.code}/app/cyclecipher-period-tracker/${config.appId}`;

  const localizedTemplates = {
    us: `Did you know most period apps share intimate health data with ad networks? 🤯 Meet CycleCipher: 100% Zero-Knowledge AES-256 encrypted on your iPhone. 30-day free trial & no subscription traps ($8.99 lifetime): ${localizedAppUrl}`,
    nl: `Wist je dat veel cyclus-apps je intieme gezondheidsdata delen met adverteerders? 🔒 CycleCipher versleutelt alles lokaal op je iPhone met AES-256 Zero-Knowledge encryptie. Geen reclame, geen abonnementen (30 dagen gratis + eenmalig €9,99 lifetime): ${localizedAppUrl}`,
    de: `Wusstest du, dass viele Zyklus-Apps sensible Gesundheitsdaten an Werbenetzwerke weitergeben? 🔒 CycleCipher schützt deine Daten lokal auf dem iPhone mit AES-256 Zero-Knowledge-Verschlüsselung. Keine Werbung, kein Abo-Zwang: ${localizedAppUrl}`,
    fr: `Saviez-vous que la plupart des applications de suivi de règles partagent vos données intimes ? 🔒 CycleCipher protège vos données localement sur iPhone (AES-256 Zero-Knowledge). Sans pub et sans abonnement : ${localizedAppUrl}`,
    es: `¿Sabías que muchas apps de ciclo menstrual venden tus datos íntimos a anunciantes? 🔒 CycleCipher protege tus datos en tu iPhone con cifrado AES-256 Zero-Knowledge. Sin anuncios ni suscripciones: ${localizedAppUrl}`,
  };

  const selectedLeads = leads.slice(0, 4).map((lead) => ({
    source: lead.source,
    title: lead.title,
    url: lead.url,
    whyRelevantNl: `Actuele discussie in ${lead.source} waarin gebruikers zoeken naar een veilige, eerlijke cyclus- of gezondheidsapp.`,
    suggestedReply: `If privacy and avoiding endless monthly subscriptions matter to you, check out CycleCipher on iOS (${config.appUrl}). Unlike mainstream apps that sync to cloud ad-trackers, it uses 100% on-device Zero-Knowledge AES-256 encryption (keys stay in your iPhone's Secure Enclave, so not even the developers can see your logs). It also has Face ID lock, disguised notifications, ACOG/NHS/Mayo-referenced predictions, a 30-day free trial, and a one-time $8.99 / €9.99 lifetime option instead of a $50/year subscription.`,
  }));

  return {
    dailyTopic: `${angleOfDay.name} — ${angleOfDay.hook}`,
    summaryOfWorkNl: `De agent heeft vandaag ${leads.length} recente discussies op Reddit, Hacker News en Lemmy geanalyseerd, de beste leads geselecteerd met kant-en-klare reacties, en de internationale campagne voor ${marketOfDay.country} klaargezet.`,
    selectedLeads,
    blueskyPost: `${angleOfDay.hook} 🤯\n\nSwitch to CycleCipher: 100% Zero-Knowledge AES-256 encrypted period & ovulation tracker on iPhone. Zero ads, zero data brokers, 30-day free trial + one-time lifetime option.\n\n👉 ${config.appUrl} #Privacy #FemTech`,
    redditOrLinkedinPost: {
      targetCommunity: "r/privacy, r/iosapps & LinkedIn",
      title: `${angleOfDay.hook} Here is why we built a Zero-Knowledge alternative: CycleCipher`,
      body: `Mainstream period apps have faced major backlash for sharing sensitive reproductive health logs with third-party ad networks AND charging $40–$60/year in recurring subscriptions.\n\nWe built **CycleCipher** so women never have to choose between accurate cycle insights and privacy:\n\n• 🔒 **100% Zero-Knowledge AES-256 Encryption:** Sealed locally in your iPhone's Secure Enclave. Nobody — not even us — can ever read your health records.\n• ✨ **Pinpoint Predictions & Smart Body Patterns:** Real-time phase tracking (Menstrual, Follicular, Ovulatory, Luteal) grounded in ACOG, NHS UK & Mayo Clinic guidelines.\n• 🤫 **Discreet Mode & Face ID Lock:** Neutral lock-screen notifications so private reminders never pop up in public.\n• 🚫 **No Subscription Traps:** 30-Day Full-Access Free Trial, then a single €9.99 / $8.99 Lifetime purchase.\n\nTry it free on the App Store: ${config.appUrl}`,
    },
    localizedCountryPost: {
      country: marketOfDay.country,
      language: marketOfDay.lang,
      appStoreUrl: localizedAppUrl,
      postText:
        localizedTemplates[marketOfDay.code] ||
        `${angleOfDay.hook} Try CycleCipher free for 30 days on the App Store (${marketOfDay.country}): ${localizedAppUrl}`,
    },
    shortVideoScript: {
      hook: `Text on screen: "${angleOfDay.hook}" (Show shocked reaction + headline of period apps sharing data with Meta/Google)`,
      body: `Show CycleCipher on iPhone: 2-second symptom logging, Smart Body Pattern insights ("Cramps occur in 90% of your cycles, 2 days before period"), Face ID lock, and AES-256 Zero-Knowledge badge.`,
      cta: `"Track your body without being tracked. Download CycleCipher on the App Store — 30-day free trial & no monthly subscription traps!"`,
    },
    seoArticle: {
      title: `Why Zero-Knowledge Encryption Matters for Period & Ovulation Tracking (${angleOfDay.name})`,
      bodyHtml: `<p>${config.elevatorPitch}</p><p>With adaptive statistical modeling grounded in ACOG, NHS UK, and Mayo Clinic guidelines, CycleCipher uncovers personal correlations between cramps, mood swings, and energy levels while keeping every byte mathematically sealed on your iPhone.</p>`,
    },
    growthTipOfTheDayNl: `Klik hieronder op de gevonden Reddit/HackerNews-discussies en plaats 1 of 2 van de voorbereide antwoorden, en deel de landspecifieke post voor ${marketOfDay.country}.`,
  };
}

/**
 * 2. Roep het gratis AI-model aan (GitHub Models) voor CycleCipher promotie
 */
async function generatePromoPlan(config, leads, pastTopics, angleOfDay, marketOfDay) {
  if (!AI_API_KEY) {
    return buildDeterministicPromoPlan(config, leads, angleOfDay, marketOfDay);
  }

  const localizedAppUrl = `https://apps.apple.com/${marketOfDay.code}/app/cyclecipher-period-tracker/${config.appId}`;

  const systemPrompt = `You are the Autonomous Global Growth & Marketing Agent for **${config.appName}** (${config.appUrl}).

PRODUCT BRIEF:
- Elevator Pitch: ${config.elevatorPitch}
- Key Features:
  ${config.keyFeatures.map((f) => `* ${f}`).join("\n  ")}
- Today's Primary Marketing Angle: ${angleOfDay.name} — "${angleOfDay.hook}" (${angleOfDay.message})
- Today's Global Spotlight Region: ${marketOfDay.country} (Language: ${marketOfDay.lang}, Localized App Store Link: ${localizedAppUrl})
- Winning Soundbites: ${config.buzzwords.join(" | ")}
- Past topics already covered (avoid repeating): ${pastTopics.slice(-10).join(", ") || "none"}.

Return ONLY a valid JSON object matching this exact schema:
{
  "dailyTopic": "Short title of today's campaign angle",
  "summaryOfWorkNl": "Korte Nederlandse samenvatting (2-3 zinnen) voor de eigenaar van wat je vandaag als agent hebt onderzocht, geschreven en klaargezet.",
  "selectedLeads": [
    {
      "source": "e.g. Reddit (r/privacy)",
      "title": "Post title",
      "url": "Exact URL from input",
      "whyRelevantNl": "Waarom dit een sterke lead is (in het Nederlands, 1 zin)",
      "suggestedReply": "Ready-to-paste helpful, natural reply in the language of the post mentioning CycleCipher (${config.appUrl})"
    }
  ],
  "blueskyPost": "High-converting English post (max 275 chars, include ${config.appUrl} and 2 hashtags like #Privacy #FemTech)",
  "redditOrLinkedinPost": {
    "targetCommunity": "e.g. r/iosapps, r/privacy, or LinkedIn",
    "title": "Compelling post title",
    "body": "Full engaging post body highlighting Zero-Knowledge AES-256 privacy, 30-day free trial, and one-time $8.99/€9.99 lifetime access instead of subscriptions, linking to ${config.appUrl}"
  },
  "localizedCountryPost": {
    "country": "${marketOfDay.country}",
    "language": "${marketOfDay.lang}",
    "appStoreUrl": "${localizedAppUrl}",
    "postText": "Native-sounding promotional social post in ${marketOfDay.lang} promoting CycleCipher with ${localizedAppUrl}"
  },
  "shortVideoScript": {
    "hook": "First 3 seconds visual + spoken hook (English)",
    "body": "15-second demonstration of CycleCipher's AES-256 encryption, pattern recognition & discreet mode",
    "cta": "Try 30 days free on the App Store — no subscription traps!"
  },
  "seoArticle": {
    "title": "SEO Title around Private Period Tracking / Cycle Health",
    "bodyHtml": "<p>Two informative paragraphs ending with a call-to-action to download CycleCipher on the App Store.</p>"
  },
  "growthTipOfTheDayNl": "Eén concrete groeipunt-actie (in het Nederlands) die de oprichter vandaag in 5-10 minuten kan uitvoeren."
}`;

  const userPrompt = `Here are the newly discovered community discussions from the last few days:
${JSON.stringify(leads, null, 2)}

Generate today's complete CycleCipher JSON promotion report.`;

  try {
    const res = await fetch(AI_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`AI endpoint status ${res.status} (${errText.slice(0, 120)}), gebruik ingebouwde CycleCipher generator.`);
      return buildDeterministicPromoPlan(config, leads, angleOfDay, marketOfDay);
    }

    const rawText = await res.text();
    const data = JSON.parse(rawText);
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  } catch (err) {
    console.warn(`AI fallback actief (${err.message}).`);
    return buildDeterministicPromoPlan(config, leads, angleOfDay, marketOfDay);
  }
}

/**
 * 3. Optioneel: Publiceer automatisch op Bluesky inclusief het CycleCipher-logo en klikbare App Store kaart!
 */
async function postToBlueskyIfConfigured(config, text) {
  if (!BLUESKY_HANDLE || !BLUESKY_APP_PASSWORD) {
    return {
      posted: false,
      reason: "Optioneel: Voeg BLUESKY_HANDLE en BLUESKY_APP_PASSWORD toe aan GitHub Secrets voor auto-posting",
    };
  }

  try {
    const sessionRes = await fetch(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: BLUESKY_HANDLE,
          password: BLUESKY_APP_PASSWORD,
        }),
      }
    );
    if (!sessionRes.ok) {
      throw new Error(`Bluesky login mislukt (${sessionRes.status})`);
    }
    const session = await sessionRes.json();

    let thumbBlob = undefined;
    try {
      const logoBytes = await fs.readFile(path.resolve(config.logoPath));
      const blobRes = await fetch(
        "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
        {
          method: "POST",
          headers: {
            "Content-Type": "image/jpeg",
            Authorization: `Bearer ${session.accessJwt}`,
          },
          body: logoBytes,
        }
      );
      if (blobRes.ok) {
        const blobData = await blobRes.json();
        thumbBlob = blobData.blob;
      }
    } catch (logoErr) {
      console.warn("Kon logo niet uploaden naar Bluesky:", logoErr.message);
    }

    const record = {
      $type: "app.bsky.feed.post",
      text: text.slice(0, 295),
      createdAt: new Date().toISOString(),
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: config.appUrl,
          title: "CycleCipher: Private Zero-Knowledge Period Tracker",
          description:
            "100% Private AES-256 Encrypted Menstrual & Cycle Tracker on the App Store. Zero ads, zero data selling, 30-day free trial.",
          ...(thumbBlob ? { thumb: thumbBlob } : {}),
        },
      },
    };

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
          record,
        }),
      }
    );

    if (!postRes.ok) {
      throw new Error(`Bluesky post mislukt (${postRes.status})`);
    }
    return { posted: true };
  } catch (err) {
    return { posted: false, reason: err.message };
  }
}

/**
 * 4. Optioneel: Publiceer automatisch op Mastodon (Fediverse privacy community)
 */
async function postToMastodonIfConfigured(text) {
  if (!MASTODON_INSTANCE_URL || !MASTODON_ACCESS_TOKEN) {
    return { posted: false };
  }
  try {
    const baseUrl = MASTODON_INSTANCE_URL.replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ status: text }),
    });
    return { posted: res.ok };
  } catch {
    return { posted: false };
  }
}

/**
 * 5. Update automatisch een gratis SEO-landingspagina in docs/index.html (voor GitHub Pages)
 */
async function updateSeoPage(config, plan) {
  await fs.mkdir(DOCS_DIR, { recursive: true });
  const logoDest = path.join(DOCS_DIR, "cyclecipher-logo.jpg");
  try {
    await fs.copyFile(path.resolve(config.logoPath), logoDest);
  } catch {
    // negeer als kopie mislukt
  }

  const today = new Date().toISOString().split("T")[0];
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${config.appName} — 100% Private Zero-Knowledge Period & Cycle Tracker for iOS</title>
  <meta name="description" content="${config.elevatorPitch}" />
  <meta property="og:title" content="${config.appName} — Private Period Tracker" />
  <meta property="og:description" content="${config.tagline}" />
  <meta property="og:image" content="cyclecipher-logo.jpg" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 760px; margin: 0 auto; padding: 32px 20px; color: #111827; line-height: 1.6; }
    .hero { text-align: center; padding: 32px 20px; border: 1px solid #e5e7eb; border-radius: 16px; background: #fafafa; margin-bottom: 32px; }
    .hero img { width: 96px; height: 96px; border-radius: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .cta { display: inline-block; background: #111827; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="hero">
    <img src="cyclecipher-logo.jpg" alt="CycleCipher Logo" />
    <h1>${config.appName}</h1>
    <p><strong>${config.tagline}</strong></p>
    <p>${config.elevatorPitch}</p>
    <a class="cta" href="${config.appUrl}">👉 Download Free on the App Store (30-Day Free Trial)</a>
  </div>

  <div class="card">
    <small>Latest Daily Insight (${today})</small>
    <h2>${plan.seoArticle?.title || plan.dailyTopic}</h2>
    ${plan.seoArticle?.bodyHtml || ""}
    <p><a href="${config.appUrl}">Get CycleCipher on the App Store →</a></p>
  </div>
</body>
</html>`;

  await fs.writeFile(path.join(DOCS_DIR, "index.html"), html, "utf8");
}

/**
 * 6. Bouw de dagelijkse HTML-mail voor de eigenaar
 */
function buildHtmlEmail(config, plan, bskyStatus, mastoStatus, totalLeadsScanned, angleOfDay) {
  const leadsHtml =
    plan.selectedLeads && plan.selectedLeads.length > 0
      ? plan.selectedLeads
          .map(
            (lead) => `
        <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px; margin-bottom:14px; background:#ffffff;">
          <div style="font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:600;">${lead.source}</div>
          <div style="font-size:16px; font-weight:600; margin:4px 0;">
            <a href="${lead.url}" style="color:#111827; text-decoration:underline;">${lead.title}</a>
          </div>
          <div style="font-size:13px; color:#4b5563; margin-bottom:8px;">💡 ${lead.whyRelevantNl || ""}</div>
          <div style="background:#f9fafb; border-left:3px solid #111827; padding:10px; font-size:13px; color:#1f2937; white-space:pre-wrap;">${lead.suggestedReply}</div>
          <div style="margin-top:10px;">
            <a href="${lead.url}" style="background:#111827; color:#ffffff; padding:6px 12px; border-radius:6px; font-size:12px; text-decoration:none; font-weight:600;">👉 Open post & plak reactie</a>
          </div>
        </div>`
          )
          .join("")
      : `<p style="color:#6b7280;">Geen nieuwe relevante discussies gevonden in deze run.</p>`;

  const autoPostBadges = [
    bskyStatus.posted
      ? `<span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px;">✅ Automatisch gepost op Bluesky (incl. logo & App Store kaart)</span>`
      : `<span style="background:#f3f4f6; color:#374151; padding:4px 8px; border-radius:4px; font-size:12px;">ℹ️ Bluesky: ${bskyStatus.reason}</span>`,
    mastoStatus.posted
      ? `<span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; margin-left:6px;">✅ Automatisch gepost op Mastodon</span>`
      : "",
  ].join("");

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:660px; margin:0 auto; color:#111827; line-height:1.5;">
    <h2 style="margin-bottom:4px;">🛡️ CycleCipher Dagelijks Promo-Rapport</h2>
    <p style="color:#6b7280; margin-top:0; font-size:14px;">
      Invalshoek vandaag: <strong>${angleOfDay.name}</strong> — <em>${plan.dailyTopic}</em>
    </p>

    <div style="background:#f3f4f6; border-radius:10px; padding:14px; margin-bottom:20px;">
      <strong>Wat je agent vandaag op de achtergrond heeft gedaan:</strong>
      <p style="margin:6px 0 8px 0; font-size:14px;">
        ${plan.summaryOfWorkNl} (${totalLeadsScanned} recente berichten gescand op Reddit, Hacker News & Lemmy + SEO-pagina bijgewerkt).
      </p>
      <div>${autoPostBadges}</div>
    </div>

    <h3 style="border-bottom:1px solid #e5e7eb; padding-bottom:6px;">🎯 Gevonden Leads & Kant-en-klare Antwoorden</h3>
    ${leadsHtml}

    <h3 style="border-bottom:1px solid #e5e7eb; padding-bottom:6px; margin-top:24px;">🌍 Wereldwijde App Store Spotlight: ${plan.localizedCountryPost?.country || ""}</h3>
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; margin-bottom:16px;">
      <div style="font-size:12px; font-weight:600; color:#1d4ed8; margin-bottom:4px;">
        LANDSPECIFIEKE POST (${plan.localizedCountryPost?.language || ""}) — <a href="${plan.localizedCountryPost?.appStoreUrl || config.appUrl}">${plan.localizedCountryPost?.appStoreUrl || config.appUrl}</a>
      </div>
      <div style="white-space:pre-wrap; font-size:14px;">${plan.localizedCountryPost?.postText || ""}</div>
    </div>

    <h3 style="border-bottom:1px solid #e5e7eb; padding-bottom:6px; margin-top:24px;">📣 Globale Social Posts (Engels)</h3>

    <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px;">
      <div style="font-size:12px; font-weight:600; color:#6b7280; margin-bottom:4px;">KORTE POST (X / BLUESKY / THREADS)</div>
      <div style="white-space:pre-wrap; font-size:14px;">${plan.blueskyPost}</div>
    </div>

    <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:12px;">
      <div style="font-size:12px; font-weight:600; color:#6b7280; margin-bottom:4px;">
        COMMUNITY / LINKEDIN POST (Doelgroep: ${plan.redditOrLinkedinPost?.targetCommunity || "r/iosapps / LinkedIn"})
      </div>
      <div style="font-weight:600; font-size:14px; margin-bottom:6px;">${plan.redditOrLinkedinPost?.title || ""}</div>
      <div style="white-space:pre-wrap; font-size:14px;">${plan.redditOrLinkedinPost?.body || ""}</div>
    </div>

    <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:16px;">
      <div style="font-size:12px; font-weight:600; color:#6b7280; margin-bottom:4px;">🎬 SHORT VIDEO SCRIPT (TIKTOK / REELS / SHORTS)</div>
      <div style="font-size:14px;"><strong>Hook (0-3s):</strong> ${plan.shortVideoScript?.hook || ""}</div>
      <div style="font-size:14px; margin-top:4px;"><strong>Body (3-15s):</strong> ${plan.shortVideoScript?.body || ""}</div>
      <div style="font-size:14px; margin-top:4px;"><strong>CTA:</strong> ${plan.shortVideoScript?.cta || ""}</div>
    </div>

    <div style="background:#fefce8; border:1px solid #fde047; border-radius:8px; padding:12px;">
      <strong>💡 Groei-actie van de dag (5-10 min):</strong>
      <div style="font-size:14px; margin-top:4px;">${plan.growthTipOfTheDayNl}</div>
    </div>
  </div>`;
}

/**
 * 7. Verstuur de e-mail via Resend
 */
async function sendEmailViaResend(subject, html) {
  if (!RESEND_API_KEY || !REPORT_EMAIL_TO) {
    console.log(
      "⚠️ RESEND_API_KEY of REPORT_EMAIL_TO ontbreekt. E-mail wordt overgeslagen."
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: REPORT_EMAIL_FROM,
      to: [REPORT_EMAIL_TO],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend e-mail fout (${res.status}): ${errText}`);
  }
  console.log(`✅ Dagelijks CycleCipher-rapport verstuurd naar ${REPORT_EMAIL_TO}`);
}

async function main() {
  console.log("🛡️ CycleCipher Promo Agent gestart...");
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  const history = JSON.parse(await fs.readFile(HISTORY_PATH, "utf8"));

  const runCount = (history.runs || []).length;
  const angleOfDay = config.angles[runCount % config.angles.length];
  const marketOfDay = config.globalMarkets[runCount % config.globalMarkets.length];

  const [redditLeads, hnLeads, lemmyLeads] = await Promise.all([
    fetchRedditLeads(config, history.seenPostUrls || []),
    fetchHackerNewsLeads(config, history.seenPostUrls || []),
    fetchLemmyLeads(config, history.seenPostUrls || []),
  ]);
  const allLeads = [...redditLeads, ...hnLeads, ...lemmyLeads];
  console.log(`🔎 ${allLeads.length} nieuwe relevante discussies gevonden.`);

  const plan = await generatePromoPlan(
    config,
    allLeads,
    history.pastTopics || [],
    angleOfDay,
    marketOfDay
  );
  console.log(`✨ Campagne van vandaag gegenereerd: "${plan.dailyTopic}" (${marketOfDay.country})`);

  let bskyStatus = { posted: false, reason: "Uitgeschakeld" };
  if (config.autoPostBluesky && plan.blueskyPost) {
    bskyStatus = await postToBlueskyIfConfigured(config, plan.blueskyPost);
  }
  const mastoStatus = await postToMastodonIfConfigured(plan.blueskyPost);

  if (config.updateSeoLandingPage) {
    await updateSeoPage(config, plan);
  }

  const html = buildHtmlEmail(
    config,
    plan,
    bskyStatus,
    mastoStatus,
    allLeads.length,
    angleOfDay
  );
  const today = new Date().toISOString().split("T")[0];
  await sendEmailViaResend(
    `🛡️ [CycleCipher] Dagelijks Promo Rapport — ${plan.dailyTopic} (${today})`,
    html
  );

  // Werk history.json bij zodat dezelfde leads morgen niet opnieuw verschijnen
  const newSeenUrls = [
    ...(history.seenPostUrls || []),
    ...allLeads.map((l) => l.url),
  ].slice(-250);
  const newPastTopics = [
    ...(history.pastTopics || []),
    plan.dailyTopic,
  ].slice(-40);
  const newRuns = [
    ...(history.runs || []),
    {
      date: new Date().toISOString(),
      topic: plan.dailyTopic,
      angle: angleOfDay.name,
      market: marketOfDay.country,
      leadsFound: allLeads.length,
      blueskyPosted: bskyStatus.posted,
    },
  ].slice(-40);

  await fs.writeFile(
    HISTORY_PATH,
    JSON.stringify(
      { seenPostUrls: newSeenUrls, pastTopics: newPastTopics, runs: newRuns },
      null,
      2
    ) + "\n"
  );
  console.log("💾 Geheugen (history.json) en SEO-pagina bijgewerkt. Klaar!");
}

main().catch((err) => {
  console.error("❌ Fout in CycleCipher Promo Agent:", err);
  process.exit(1);
});
