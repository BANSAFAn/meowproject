import type { APIRoute } from 'astro';
import { PROJECTS } from '../data/projects';

function escapeXml(str: string) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = ({ site, url }) => {
  const origin = site?.origin || url.origin || 'https://meowlab.fun';
  const sorted = [...PROJECTS].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  const items = sorted
    .map((p) => {
      const enLoc = p.locales.en || p.locales.uk;
      const link = `${origin}/en/project/${p.slug}/`;
      const pubDate = p.addedAt ? new Date(p.addedAt * 1000).toUTCString() : new Date().toUTCString();
      const title = `[${p.category.toUpperCase()}] ${p.name}`;
      const desc = `${enLoc?.tagline || ''}\n\n${enLoc?.description || ''}`.trim();
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(p.category)}</category>
      <description>${escapeXml(desc)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MeowLab — New Minecraft Projects</title>
    <link>${origin}/</link>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Latest Minecraft launchers, mods, modpacks, servers, and tools added to MeowLab.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
