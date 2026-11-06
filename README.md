# 🛡️ CycleCipher — 24/7 Autonome Cloud Promo Agent

Deze agent promoot **CycleCipher** (`https://apps.apple.com/us/app/cyclecipher-period-tracker/id6816656463`) elke dag volledig automatisch in de achtergrond — **ook als je computer uit staat**, **100% gratis**, en **zonder Google-tokens te verbruiken** (via GitHub Models).

## Wat doet de agent elke ochtend?

1. **Scant wereldwijd naar warme leads (Reddit, Hacker News & Lemmy):**
   Zoekt in `r/privacy`, `r/degoogle`, `r/Periods`, `r/TwoXChromosomes`, `r/TheGirlSurvivalGuide`, `r/iosapps`, Hacker News en Lemmy naar mensen die vragen om een veilige period tracker of klagen over apps die data verkopen (zoals Flo/Clue) of dure abonnementen hebben.
2. **Schrijft kant-en-klare, authentieke antwoorden:**
   Selecteert de beste nieuwe posts en schrijft een behulpzame Engelse reactie waarin de voordelen van CycleCipher (*100% Zero-Knowledge AES-256*, *30 dagen gratis*, *geen abonnement maar eenmalig €9,99 / $8.99 Lifetime*) natuurlijk worden genoemd, met een 1-klik knop naar de post.
3. **Roteert langs alle wereldwijde Apple App Store landen:**
   Elke dag zet de agent één regio extra in de spotlight (VS/VK, Nederland/België, Duitsland/Oostenrijk/Zwitserland, Frankrijk, Spanje/LATAM, Scandinavië, Italië, Brazilië/Portugal, Canada/Australië, Japan) met een post in de lokale taal én de landspecifieke App Store link (`https://apps.apple.com/<landcode>/app/cyclecipher-period-tracker/id6816656463`).
4. **Plaatst automatisch op Bluesky & Mastodon (optioneel):**
   Als je een gratis Bluesky-account koppelt, uploadt de agent automatisch het **CycleCipher-schildlogo** (`assets/cyclecipher-logo.jpg`) en plaatst een post met een klikbare App Store link-kaart.
5. **Werkt dagelijks een gratis SEO-landingspagina bij (`docs/index.html`):**
   Schrijft elke dag een kort SEO-artikel over cyclus-privacy en zet dit klaar in `docs/index.html` (gratis te hosten via GitHub Pages).
6. **Stuurt je elke ochtend een compleet HTML-rapport per e-mail via Resend.**

---

## Zo zet je hem in 3 minuten aan

### Stap 1: Maak een gratis Resend API-key aan
1. Ga naar [resend.com](https://resend.com) en maak een gratis account aan (3.000 gratis mails/maand).
2. Ga naar **API Keys** → **Create API Key** en kopieer de sleutel (begint met `re_...`).

### Stap 2: Zet dit project op je GitHub
1. Maak een nieuwe GitHub-repository aan (bijv. `cyclecipher-promo-agent`).
2. Push deze map naar je nieuwe GitHub-repository:
   ```bash
   git init
   git add .
   git commit -m "Initial CycleCipher Promo Agent"
   git branch -M main
   git remote add origin https://github.com/JOUW-GEBRUIKERSNAAM/cyclecipher-promo-agent.git
   git push -u origin main
   ```

### Stap 3: Voeg je Secrets toe in GitHub
Ga in je GitHub-repository naar **Settings** → **Secrets and variables** → **Actions** → **New repository secret** en voeg toe:

| Secret Naam | Waarde | Verplicht? |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | Jouw `re_...` API-sleutel van Resend | **Ja** |
| `REPORT_EMAIL_TO` | Jouw e-mailadres (hetzelfde adres waarmee je bij Resend bent aangemeld) | **Ja** |
| `BLUESKY_HANDLE` | Bijv. `cyclecipher.bsky.social` | Optioneel (voor auto-posting met logo) |
| `BLUESKY_APP_PASSWORD` | Een App Password uit je Bluesky-instellingen | Optioneel (voor auto-posting met logo) |
| `MASTODON_INSTANCE_URL` | Bijv. `https://mastodon.social` | Optioneel (voor auto-posting) |
| `MASTODON_ACCESS_TOKEN` | Je Mastodon access token | Optioneel (voor auto-posting) |

### Stap 4: Direct testen!
Ga in je GitHub-repository naar het tabblad **Actions** → klik links op **Daily CycleCipher Promo Agent** → klik rechts op **Run workflow**. Binnen 30 seconden ontvang je je eerste CycleCipher promotierapport in je mailbox!
