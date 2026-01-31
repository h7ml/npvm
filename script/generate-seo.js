#!/usr/bin/env node
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'https://npvm.zeabur.app';
const PUBLIC_DIR = join(__dirname, '../packages/web/public');

// 确保 public 目录存在
if (!existsSync(PUBLIC_DIR)) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 读取 changelog 数据
function getChangelog() {
  const changelogPath = join(__dirname, '../packages/web/src/data/changelog.json');
  if (existsSync(changelogPath)) {
    try {
      return JSON.parse(readFileSync(changelogPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

// 生成 robots.txt
function generateRobots() {
  const content = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemap
Sitemap: ${BASE_URL}/sitemap.xml

# Disallow API endpoints
Disallow: /api/
Disallow: /docs/
`;
  writeFileSync(join(PUBLIC_DIR, 'robots.txt'), content);
  console.log('Generated robots.txt');
}

// 生成 sitemap.xml
function generateSitemap() {
  const now = new Date().toISOString().split('T')[0];
  const pages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/packages', priority: '0.9', changefreq: 'daily' },
    { loc: '/dependencies', priority: '0.8', changefreq: 'weekly' },
    { loc: '/security', priority: '0.8', changefreq: 'weekly' },
    { loc: '/remote', priority: '0.8', changefreq: 'weekly' },
    { loc: '/guide', priority: '0.7', changefreq: 'monthly' },
    { loc: '/changelog', priority: '0.6', changefreq: 'weekly' },
    { loc: '/settings', priority: '0.5', changefreq: 'monthly' },
  ];

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${BASE_URL}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  writeFileSync(join(PUBLIC_DIR, 'sitemap.xml'), content);
  console.log('Generated sitemap.xml');
}

// 生成 rss.xml
function generateRss() {
  const changelog = getChangelog();
  const now = new Date().toUTCString();

  let items = '';
  if (changelog?.en) {
    items = changelog.en.flatMap(entry =>
      entry.changes.map((change, i) => `    <item>
      <title>${entry.version}: ${change.text}</title>
      <link>${BASE_URL}/changelog</link>
      <description>${change.text}</description>
      <pubDate>${new Date(entry.date).toUTCString()}</pubDate>
      <guid>${BASE_URL}/changelog#${entry.version}-${i}</guid>
    </item>`)
    ).join('\n');
  }

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>npvm - Node Package Manager Visual Platform</title>
    <link>${BASE_URL}</link>
    <description>A modern visual platform for managing Node.js packages. Supports npm, yarn, pnpm, and bun.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
  writeFileSync(join(PUBLIC_DIR, 'rss.xml'), content);
  console.log('Generated rss.xml');
}

// 生成 atom.xml
function generateAtom() {
  const changelog = getChangelog();
  const now = new Date().toISOString();

  let entries = '';
  if (changelog?.en) {
    entries = changelog.en.flatMap(entry =>
      entry.changes.map((change, i) => `  <entry>
    <title>${entry.version}: ${change.text}</title>
    <link href="${BASE_URL}/changelog#${entry.version}-${i}"/>
    <id>${BASE_URL}/changelog#${entry.version}-${i}</id>
    <updated>${new Date(entry.date).toISOString()}</updated>
    <summary>${change.text}</summary>
  </entry>`)
    ).join('\n');
  }

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>npvm - Node Package Manager Visual Platform</title>
  <link href="${BASE_URL}" rel="alternate"/>
  <link href="${BASE_URL}/atom.xml" rel="self"/>
  <id>${BASE_URL}/</id>
  <updated>${now}</updated>
  <subtitle>A modern visual platform for managing Node.js packages.</subtitle>
  <author>
    <name>h7ml</name>
    <uri>https://github.com/h7ml</uri>
  </author>
${entries}
</feed>`;
  writeFileSync(join(PUBLIC_DIR, 'atom.xml'), content);
  console.log('Generated atom.xml');
}

// 执行生成
console.log('Generating SEO files...');
generateRobots();
generateSitemap();
generateRss();
generateAtom();
console.log('SEO files generated successfully!');
