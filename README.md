# Review Scraper

Competitive App Store & Google Play analysis for **Amber** (Eye Rest) and **Split Genesis**.

Scrapes reviews from competitors, categorizes them by topic, and generates Telegram-friendly markdown reports.

## Setup

```bash
npm install
```

## Run

```bash
npm run scrape    # Scrape all apps (saves to data/reviews/)
npm run report    # Generate analysis report (saves to data/)
```

## Target Apps

**Amber competitors (iOS):**
- Time Out
- Rest - Break Reminders
- Eye Care 20 20 20

**Split Genesis competitors (iOS + Android):**
- Splitwise
- Tricount
- Settle Up
- Spliit

## Output

- `data/reviews/{appname}_{date}.json` — raw reviews + categories
- `data/report_{date}.md` — analysis report with top issues and USP

## Self-hosted Cron (Hetzner)

```bash
# Weekly Monday 9am
0 9 * * 1 cd /opt/review-scraper && npm run scrape && npm run report
```

## Categories

Reviews are auto-tagged:
- `feature_request` — users asking for new features
- `ux_complaint` — usability issues
- `bug` — crashes and errors
- `pricing` — payment/subscription complaints

## Deploy

```bash
git clone https://github.com/salahxiv/review-scraper.git /opt/review-scraper
cd /opt/review-scraper
npm install
npm run scrape
npm run report
```
