import type { APIRoute } from 'astro';
import { LANGUAGES } from '../i18n/translations';

export const GET: APIRoute = ({ url }) => {
  const origin = url.origin || 'https://meowproject.pages.dev';
  const langs = Object.keys(LANGUAGES);
  const lastmod = new Date().toISOString().split('T')[0];

  const urls = [
    `${origin}/`,
    ...langs.map((l) => `${origin}/${l}/`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${loc === `${origin}/` ? '1.0' : '0.9'}</priority>
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
