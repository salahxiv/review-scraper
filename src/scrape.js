#!/usr/bin/env node
'use strict';

const appStore = require('app-store-scraper');
const gplay = require('google-play-scraper');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const today = new Date().toISOString().slice(0, 10);
const dataDir = path.join(__dirname, '..', 'data', 'reviews');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function categorize(text, categories) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => lower.includes(kw))) {
      matched.push(cat);
    }
  }
  return matched.length > 0 ? matched : ['other'];
}

function buildSummary(reviews, categories) {
  const byCategory = {};
  for (const cat of [...Object.keys(categories), 'other']) {
    byCategory[cat] = 0;
  }

  const complaintMap = {};

  for (const r of reviews) {
    for (const cat of r.categories) {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    // Track complaint keywords
    const lower = (r.text || '').toLowerCase();
    for (const kw of [...(categories.bug || []), ...(categories.ux_complaint || [])]) {
      if (lower.includes(kw)) {
        complaintMap[kw] = (complaintMap[kw] || 0) + 1;
      }
    }
  }

  const topComplaints = Object.entries(complaintMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw, count]) => ({ keyword: kw, count }));

  return { total: reviews.length, byCategory, topComplaints };
}

async function scrapeIos(app) {
  console.log(`  [iOS] Scraping ${app.name} (${app.iosId})...`);
  try {
    const raw = await appStore.reviews({
      id: app.iosId,
      page: 1,
      sort: appStore.sort.RECENT,
      country: 'us'
    });
    return raw.map(r => ({
      id: r.id,
      rating: r.score,
      title: r.title || '',
      text: r.text || '',
      date: r.updated,
      version: r.version || '',
      platform: 'ios',
      categories: categorize((r.title || '') + ' ' + (r.text || ''), config.categories)
    }));
  } catch (err) {
    console.error(`  [iOS] Error for ${app.name}: ${err.message}`);
    return [];
  }
}

async function scrapeAndroid(app) {
  console.log(`  [Android] Scraping ${app.name} (${app.androidId})...`);
  try {
    const raw = await gplay.reviews({
      appId: app.androidId,
      num: 100,
      sort: gplay.sort.NEWEST,
      lang: 'en',
      country: 'us'
    });
    const list = raw.data || raw;
    return list.map(r => ({
      id: r.id,
      rating: r.score,
      title: r.title || '',
      text: r.text || '',
      date: r.date,
      version: r.version || '',
      platform: 'android',
      categories: categorize((r.title || '') + ' ' + (r.text || ''), config.categories)
    }));
  } catch (err) {
    console.error(`  [Android] Error for ${app.name}: ${err.message}`);
    return [];
  }
}

async function scrapeApp(app) {
  let reviews = [];

  if (app.platform === 'ios' || app.platform === 'both') {
    const iosReviews = await scrapeIos(app);
    reviews = reviews.concat(iosReviews);
  }

  if ((app.platform === 'android' || app.platform === 'both') && app.androidId) {
    const androidReviews = await scrapeAndroid(app);
    reviews = reviews.concat(androidReviews);
  }

  const summary = buildSummary(reviews, config.categories);
  const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const outPath = path.join(dataDir, `${slug}_${today}.json`);

  const output = {
    app: app.name,
    iosId: app.iosId || null,
    androidId: app.androidId || null,
    scrapedAt: new Date().toISOString(),
    summary,
    reviews
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`  Saved ${reviews.length} reviews → ${outPath}`);
  console.log(`  Summary: total=${summary.total}, categories=${JSON.stringify(summary.byCategory)}`);
  return output;
}

async function main() {
  console.log('=== Review Scraper ===');
  console.log(`Date: ${today}`);
  console.log('');

  const allApps = [
    ...config.apps.amber_competitors,
    ...config.apps.split_competitors
  ];

  for (const app of allApps) {
    console.log(`\nScraping: ${app.name}`);
    await scrapeApp(app);
    // Polite delay between apps
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n=== Done ===');
  console.log(`Run "npm run report" to generate the analysis report.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
