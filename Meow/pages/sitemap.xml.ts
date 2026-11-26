import type { APIRoute } from 'astro';
import { LANGUAGES } from '../i18n/translations';
import { PROJECTS, PREFIXES } from '../data/projects';

export const GET: APIRoute = ({ site, url }) => {
  const origin = site?.origin || url.origin || 'https://meowlab.fun';
  const langs = Object.keys(LANGUAGES);
  const lastmod = new Date().toISOString().split('T')[0];

  const makeAlternates = (pathSuffix: string) =>
    [
      `<xhtml:link rel="alternate" hreflang="x-default" href="${origin}${pathSuffix}" />`,
      ...langs.map((l) => {
        const href = l === 'uk' ? `${origin}${pathSuffix}` : `${origin}/${l}${pathSuffix}`;
        const hreflang = l === 'mo' ? 'ro-MD' : l;
        return `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`;
      }),
    ].join('\n    ');

  const urls: { loc: string; priority: string; pathSuffix: string }[] = [
    { loc: `${origin}/`, priority: '1.0', pathSuffix: '/' },
    ...langs
      .filter((l) => l !== 'uk')
      .map((l) => ({ loc: `${origin}/${l}/`, priority: '0.95', pathSuffix: '/' })),
  ];

  // Categories
  PREFIXES.forEach((cat) => {
    const suffix = `/category/${cat}/`;
    urls.push({ loc: `${origin}${suffix}`, priority: '0.85', pathSuffix: suffix });
    langs
      .filter((l) => l !== 'uk')
      .forEach((l) => {
        urls.push({ loc: `${origin}/${l}${suffix}`, priority: '0.8', pathSuffix: suffix });
      });
  });

  // Projects
  PROJECTS.forEach((p) => {
    const suffix = `/project/${p.slug}/`;
    urls.push({ loc: `${origin}${suffix}`, priority: '0.85', pathSuffix: suffix });
    langs
      .filter((l) => l !== 'uk')
      .forEach((l) => {
        urls.push({ loc: `${origin}/${l}${suffix}`, priority: '0.8', pathSuffix: suffix });
      });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    ${makeAlternates(u.pathSuffix)}
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
