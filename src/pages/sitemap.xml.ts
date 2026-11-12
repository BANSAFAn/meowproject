import type { APIRoute } from 'astro';
import { LANGUAGES } from '../i18n/translations';
import { PROJECTS } from '../data/projects';

const PREFIXES = ['launcher', 'modpack', 'mod', 'client', 'server', 'website', 'project'];

export const GET: APIRoute = ({ url }) => {
  const origin = url.origin || 'https://meowproject.pages.dev';
  const langs = Object.keys(LANGUAGES);
  const lastmod = new Date().toISOString().split('T')[0];

  const urls: { loc: string; priority: string }[] = [
    { loc: `${origin}/`, priority: '1.0' },
    ...langs.map((l) => ({ loc: `${origin}/${l}/`, priority: '0.9' })),
  ];

  // Projects
  PROJECTS.forEach((p) => {
    urls.push({ loc: `${origin}/project/${p.slug}/`, priority: '0.85' });
    langs.forEach((l) => {
      urls.push({ loc: `${origin}/${l}/project/${p.slug}/`, priority: '0.8' });
    });
  });

  // Categories
  PREFIXES.forEach((cat) => {
    urls.push({ loc: `${origin}/category/${cat}/`, priority: '0.85' });
    langs.forEach((l) => {
      urls.push({ loc: `${origin}/${l}/category/${cat}/`, priority: '0.8' });
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
