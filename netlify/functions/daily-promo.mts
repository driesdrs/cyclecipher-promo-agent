import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import OpenAI from "openai";
import appConfig from "../../app-config.json";

interface Lead {
  source: string;
  title: string;
  snippet: string;
  url: string;
}

interface HistoryState {
  seenPostUrls: string[];
  pastTopics: string[];
  runs: Array<{
    date: string;
    topic: string;
    angle: string;
    market: string;
    leadsFound: number;
  }>;
}

async function fetchRedditLeads(seenUrls: string[]): Promise<Lead[]> {
  const leads: Lead[] = [];
  const urlsToFetch = [
    `https://www.reddit.com/search.json?q=${encodeURIComponent(
      '("period tracker" OR "period app" OR "cycle tracker" OR "Flo app" OR "Clue app") AND (privacy OR subscription OR alternative OR encrypted OR recommendation OR recommend)'
    )}&sort=new&t=month&limit=12`,
    `https://www.reddit.com/r/privacy+degoogle+Periods+TheGirlSurvivalGuide+iosapps/search.json?q=${encodeURIComponent(
      "period tracker OR cycle tracker OR menstrual app"
    )}&restrict_sr=on&sort=new&t=month&limit=12`,
  ];

  for (const url of urlsToFetch) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "CycleCipherPromoAgent/1.0" },
      });
      if (!res.ok) continue;
      const data: any = await res.json();
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
          snippet: (post.selftext || "").slice(0, 300),
          url: postUrl,
        });
      }
    } catch {
      // ignore fetch error
    }
  }
  return leads.slice(0, 8);
}

async function fetchHackerNewsLeads(seenUrls: string[]): Promise<Lead[]> {
  const leads: Lead[] = [];
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
    "period tracker OR health data privacy OR reproductive privacy"
  )}&tags=story,ask_hn&hitsPerPage=6`;

  try {
    const res = await fetch(url);
    if (!res.ok) return leads;
    const data: any = await res.json();

    for (const hit of data.hits || []) {
      const postUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      if (seenUrls.includes(postUrl)) continue;
      leads.push({
        source: "Hacker News",
        title: hit.title,
        snippet: (hit.story_text || "").replace(/<[^>]+>/g, "").slice(0, 300),
        url: postUrl,
      });
    }
  } catch {
    // ignore
  }
  return leads.slice(0, 4);
}

function buildFallbackPlan(
  leads: Lead[],
  angleOfDay: (typeof appConfig.angles)[0],
  marketOfDay: (typeof appConfig.globalMarkets)[0]
) {
  const localizedAppUrl = `https://apps.apple.com/${marketOfDay.code}/app/cyclecipher-period-tracker/${appConfig.appId}`;
  const localizedTemplates: Record<string, string> = {
    us: `Did you know most period apps share intimate health data with ad networks? 🤯 Meet CycleCipher: 100% Zero-Knowledge AES-256 encrypted on your iPhone. 30-day free trial & no subscription traps ($8.99 lifetime): ${localizedAppUrl}`,
    nl: `Wist je dat veel cyclus-apps je intieme gezondheidsdata delen met adverteerders? 🔒 CycleCipher versleutelt alles lokaal op je iPhone met AES-256 Zero-Knowledge encryptie. Geen reclame, geen abonnementen (30 dagen gratis + eenmalig €9,99 lifetime): ${localizedAppUrl}`,
    de: `Wusstest du, dass viele Zyklus-Apps sensible Gesundheitsdaten an Werbenetzwerke weitergeben? 🔒 CycleCipher schützt deine Daten lokal auf dem iPhone mit AES-256 Zero-Knowledge-Verschlüsselung. Keine Werbung, kein Abo-Zwang: ${localizedAppUrl}`,
    fr: `Saviez-vous que la plupart des applications de suivi de règles partagent vos données intimes ? 🔒 CycleCipher protège vos données localement sur iPhone (AES-256 Zero-Knowledge). Sans pub et sans abonnement : ${localizedAppUrl}`,
    es: `¿Sabías que muchas apps de ciclo menstrual venden tus datos íntimos a anunciantes? 🔒 CycleCipher protege tus datos en tu iPhone con cifrado AES-256 Zero-Knowledge. Sin anuncios ni suscripciones: ${localizedAppUrl}`,
  };

  return {
    dailyTopic: `${angleOfDay.name} — ${angleOfDay.hook}`,
    summaryOfWorkNl: `De cloud-agent heeft vandaag ${leads.length} recente discussies op Reddit en Hacker News gescand, de beste leads geselecteerd met kant-en-klare reacties, en de internationale promotie voor ${marketOfDay.country} klaargezet.`,
    selectedLeads: leads.slice(0, 4).map((lead) => ({
      source: lead.source,
      title: lead.title,
      url: lead.url,
      whyRelevantNl: `Actuele discussie in ${lead.source} waarin gebruikers zoeken naar een veilige, eerlijke cyclus- of gezondheidsapp.`,
      suggestedReply: `If privacy and avoiding endless monthly subscriptions matter to you, check out CycleCipher on iOS (${appConfig.appUrl}). Unlike mainstream apps that sync to cloud ad-trackers, it uses 100% on-device Zero-Knowledge AES-256 encryption (keys stay in your iPhone's Secure Enclave, so not even the developers can see your logs). It also has Face ID lock, disguised notifications, ACOG/NHS/Mayo-referenced predictions, a 30-day free trial, and a one-time $8.99 / €9.99 lifetime option instead of a $50/year subscription.`,
    })),
    blueskyPost: `${angleOfDay.hook} 🤯\n\nSwitch to CycleCipher: 100% Zero-Knowledge AES-256 encrypted period & ovulation tracker on iPhone. Zero ads, zero data brokers, 30-day free trial + one-time lifetime option.\n\n👉 ${appConfig.appUrl} #Privacy #FemTech`,
    redditOrLinkedinPost: {
      targetCommunity: "r/privacy, r/iosapps & LinkedIn",
      title: `${angleOfDay.hook} Why we built a Zero-Knowledge alternative: CycleCipher`,
      body: `Mainstream period apps have faced major backlash for sharing sensitive reproductive health logs with third-party ad networks AND charging $40–$60/year in recurring subscriptions.\n\nWe built **CycleCipher** so women never have to choose between accurate cycle insights and privacy:\n\n• 🔒 **100% Zero-Knowledge AES-256 Encryption:** Sealed locally in your iPhone's Secure Enclave. Nobody — not even us — can ever read your health records.\n• ✨ **Pinpoint Predictions & Smart Body Patterns:** Real-time phase tracking grounded in ACOG, NHS UK & Mayo Clinic guidelines.\n• 🤫 **Discreet Mode & Face ID Lock:** Neutral lock-screen notifications.\n• 🚫 **No Subscription Traps:** 30-Day Full-Access Free Trial, then a single €9.99 / $8.99 Lifetime purchase.\n\nDownload free on the App Store: ${appConfig.appUrl}`,
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
      hook: `Text on screen: "${angleOfDay.hook}"`,
      body: `Show CycleCipher on iPhone: 2-second symptom logging, Smart Body Pattern insights ("Cramps occur in 90% of your cycles, 2 days before period"), Face ID lock, and AES-256 Zero-Knowledge badge.`,
      cta: `"Track your body without being tracked. Download CycleCipher on the App Store — 30-day free trial & no monthly subscription traps!"`,
    },
    growthTipOfTheDayNl: `Klik op 1 of 2 van de gevonden Reddit/HackerNews-discussies hieronder om je kant-en-klare reactie te plaatsen, en deel de landspecifieke post voor ${marketOfDay.country}.`,
  };
}

async function generatePlanWithAI(
  leads: Lead[],
  pastTopics: string[],
  angleOfDay: (typeof appConfig.angles)[0],
  marketOfDay: (typeof appConfig.globalMarkets)[0]
) {
  if (!Netlify.env.get("OPENAI_BASE_URL") && !Netlify.env.get("OPENAI_API_KEY")) {
    return buildFallbackPlan(leads, angleOfDay, marketOfDay);
  }

  const localizedAppUrl = `https://apps.apple.com/${marketOfDay.code}/app/cyclecipher-period-tracker/${appConfig.appId}`;
  try {
    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the Autonomous Global Growth & Marketing Agent for CycleCipher (${appConfig.appUrl}).
Elevator pitch: ${appConfig.elevatorPitch}
Today's angle: ${angleOfDay.name} — "${angleOfDay.hook}"
Today's Spotlight Region: ${marketOfDay.country} (${marketOfDay.lang}, ${localizedAppUrl})
Past topics to avoid repeating: ${pastTopics.slice(-8).join(", ") || "none"}

Return valid JSON with keys: dailyTopic, summaryOfWorkNl, selectedLeads (array of {source, title, url, whyRelevantNl, suggestedReply}), blueskyPost, redditOrLinkedinPost ({targetCommunity, title, body}), localizedCountryPost ({country, language, appStoreUrl, postText}), shortVideoScript ({hook, body, cta}), growthTipOfTheDayNl.`,
        },
        {
          role: "user",
          content: `Leads found today:\n${JSON.stringify(leads, null, 2)}`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return buildFallbackPlan(leads, angleOfDay, marketOfDay);
    return JSON.parse(content);
  } catch {
    return buildFallbackPlan(leads, angleOfDay, marketOfDay);
  }
}

function renderEmailHtml(
  plan: any,
  totalLeadsScanned: number,
  angleOfDay: (typeof appConfig.angles)[0]
): string {
  const leadsHtml =
    plan.selectedLeads && plan.selectedLeads.length > 0
      ? plan.selectedLeads
          .map(
            (lead: any) => `
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

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:660px; margin:0 auto; color:#111827; line-height:1.5;">
    <h2 style="margin-bottom:4px;">🛡️ CycleCipher Dagelijks Promo-Rapport</h2>
    <p style="color:#6b7280; margin-top:0; font-size:14px;">
      Invalshoek vandaag: <strong>${angleOfDay.name}</strong>
    </p>

    <div style="background:#f3f4f6; border-radius:10px; padding:14px; margin-bottom:20px;">
      <strong>Wat je agent vandaag op de achtergrond heeft gedaan:</strong>
      <p style="margin:6px 0 0 0; font-size:14px;">
        ${plan.summaryOfWorkNl} (${totalLeadsScanned} recente berichten gescand op Reddit & Hacker News).
      </p>
    </div>

    <h3 style="border-bottom:1px solid #e5e7eb; padding-bottom:6px;">🎯 Gevonden Leads & Kant-en-klare Antwoorden</h3>
    ${leadsHtml}

    <h3 style="border-bottom:1px solid #e5e7eb; padding-bottom:6px; margin-top:24px;">🌍 Wereldwijde App Store Spotlight: ${plan.localizedCountryPost?.country || ""}</h3>
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; margin-bottom:16px;">
      <div style="font-size:12px; font-weight:600; color:#1d4ed8; margin-bottom:4px;">
        LANDSPECIFIEKE POST (${plan.localizedCountryPost?.language || ""}) — <a href="${plan.localizedCountryPost?.appStoreUrl || appConfig.appUrl}">${plan.localizedCountryPost?.appStoreUrl || appConfig.appUrl}</a>
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
        COMMUNITY / LINKEDIN POST (${plan.redditOrLinkedinPost?.targetCommunity || "r/iosapps / LinkedIn"})
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

export default async (req: Request) => {
  const store = getStore("cyclecipher-promo");
  const history: HistoryState = (await store.get("history", { type: "json" })) || {
    seenPostUrls: [],
    pastTopics: [],
    runs: [],
  };

  const runCount = (history.runs || []).length;
  const angleOfDay = appConfig.angles[runCount % appConfig.angles.length];
  const marketOfDay = appConfig.globalMarkets[runCount % appConfig.globalMarkets.length];

  const [redditLeads, hnLeads] = await Promise.all([
    fetchRedditLeads(history.seenPostUrls || []),
    fetchHackerNewsLeads(history.seenPostUrls || []),
  ]);
  const allLeads = [...redditLeads, ...hnLeads];

  const plan = await generatePlanWithAI(
    allLeads,
    history.pastTopics || [],
    angleOfDay,
    marketOfDay
  );

  const html = renderEmailHtml(plan, allLeads.length, angleOfDay);
  const resendKey = Netlify.env.get("RESEND_API_KEY");
  const emailTo = Netlify.env.get("REPORT_EMAIL_TO") || "driesdrs@gmail.com";

  if (resendKey) {
    const today = new Date().toISOString().split("T")[0];
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "CycleCipher Agent <onboarding@resend.dev>",
        to: [emailTo],
        subject: `🛡️ [CycleCipher] Dagelijks Promo Rapport — ${plan.dailyTopic} (${today})`,
        html,
      }),
    });
  }

  await store.setJSON("history", {
    seenPostUrls: [...(history.seenPostUrls || []), ...allLeads.map((l) => l.url)].slice(-250),
    pastTopics: [...(history.pastTopics || []), plan.dailyTopic].slice(-40),
    runs: [
      ...(history.runs || []),
      {
        date: new Date().toISOString(),
        topic: plan.dailyTopic,
        angle: angleOfDay.name,
        market: marketOfDay.country,
        leadsFound: allLeads.length,
      },
    ].slice(-40),
  });

  return Response.json({ ok: true, topic: plan.dailyTopic, leads: allLeads.length });
};

export const config: Config = {
  schedule: "0 7 * * *", // 07:00 UTC = 08:00 CET (elke ochtend)
};
