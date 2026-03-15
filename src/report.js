#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'reviews');
const today = new Date().toISOString().slice(0, 10);

function loadAllReviews() {
  if (!fs.existsSync(dataDir)) {
    console.error('No data directory found. Run "npm run scrape" first.');
    process.exit(1);
  }
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('No review files found. Run "npm run scrape" first.');
    process.exit(1);
  }

  // Group by app name, pick the latest file per app
  const appMap = {};
  for (const file of files) {
    const fullPath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const appName = data.app;
    if (!appMap[appName] || data.scrapedAt > appMap[appName].scrapedAt) {
      appMap[appName] = data;
    }
  }
  return Object.values(appMap);
}

function getTopKeywords(reviews, keywordList, limit = 5) {
  const map = {};
  for (const r of reviews) {
    const lower = (r.title + ' ' + r.text).toLowerCase();
    for (const kw of keywordList) {
      if (lower.includes(kw)) {
        map[kw] = (map[kw] || 0) + 1;
      }
    }
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([kw, count]) => `"${kw}" (${count}x)`);
}

function getTopReviewSnippets(reviews, categories, category, limit = 3) {
  return reviews
    .filter(r => r.categories && r.categories.includes(category))
    .filter(r => r.rating <= 3)
    .slice(0, limit)
    .map(r => {
      const snippet = (r.text || '').slice(0, 100).replace(/\n/g, ' ');
      return `  ★${r.rating} "${snippet}${r.text && r.text.length > 100 ? '...' : ''}"`;
    });
}

function generateReport(allData) {
  const config = require('./config');
  const lines = [];

  lines.push(`# Competitor Review Report`);
  lines.push(`Generated: ${today}`);
  lines.push('');

  // Group by category
  const groups = {
    'Amber Competitors (Eye Rest)': allData.filter(d =>
      config.apps.amber_competitors.some(a => a.name === d.app)
    ),
    'Split Competitors': allData.filter(d =>
      config.apps.split_competitors.some(a => a.name === d.app)
    )
  };

  for (const [groupName, apps] of Object.entries(groups)) {
    lines.push(`## ${groupName}`);
    lines.push('');

    for (const appData of apps) {
      const { app, summary, reviews } = appData;
      const lowRated = reviews.filter(r => r.rating <= 2);
      const highRated = reviews.filter(r => r.rating >= 4);

      lines.push(`### ${app}`);
      lines.push(`Reviews scraped: ${summary.total} | Avg issues: ${Object.entries(summary.byCategory).filter(([k]) => k !== 'other').map(([k,v]) => `${k}:${v}`).join(', ')}`);
      lines.push('');

      // Feature requests
      const featureKws = getTopKeywords(reviews, config.categories.feature_request);
      if (featureKws.length > 0) {
        lines.push(`**Top Feature Requests:**`);
        featureKws.forEach(k => lines.push(`- ${k}`));
        lines.push('');
      }

      // Complaints
      const bugKws = getTopKeywords(reviews, config.categories.bug);
      const uxKws = getTopKeywords(reviews, config.categories.ux_complaint);
      if (bugKws.length > 0 || uxKws.length > 0) {
        lines.push(`**Top Complaints:**`);
        if (bugKws.length > 0) lines.push(`- Bugs: ${bugKws.join(', ')}`);
        if (uxKws.length > 0) lines.push(`- UX: ${uxKws.join(', ')}`);
        lines.push('');
      }

      // Pricing complaints
      const pricingKws = getTopKeywords(reviews, config.categories.pricing, 3);
      if (pricingKws.length > 0) {
        lines.push(`**Pricing Complaints:**`);
        pricingKws.forEach(k => lines.push(`- ${k}`));
        lines.push('');
      }

      // Sample negative reviews
      const snippets = getTopReviewSnippets(reviews, config.categories, 'bug');
      if (snippets.length > 0) {
        lines.push(`**Sample Negative Reviews:**`);
        snippets.forEach(s => lines.push(s));
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // USP section
  lines.push('## Our USP vs Competitors');
  lines.push('');
  lines.push('**Amber (Eye Rest):**');
  lines.push('- Competitors struggle with: confusing UI, missing customization, aggressive paywalls');
  lines.push('- Our advantage: Clean design, sensible free tier, focus on health not gamification');
  lines.push('');
  lines.push('**Split Genesis:**');
  lines.push('- Competitors struggle with: sync bugs, complex UI, subscription fatigue');
  lines.push('- Our advantage: Simple & fast, no account required, fair pricing');
  lines.push('');

  return lines.join('\n');
}

function main() {
  console.log('=== Report Generator ===');
  const allData = loadAllReviews();
  console.log(`Loaded data for ${allData.length} apps`);

  const report = generateReport(allData);

  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `report_${today}.md`);
  fs.writeFileSync(outPath, report);
  console.log(`Report saved: ${outPath}`);
  console.log('');
  console.log('--- REPORT PREVIEW ---');
  console.log(report.slice(0, 1500));
  if (report.length > 1500) console.log('...[truncated, see file for full report]');
}

main();
