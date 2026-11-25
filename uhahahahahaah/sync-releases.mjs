import fs from 'node:fs';
import path from 'node:path';

const PROJECTS_DIR = path.resolve(process.cwd(), 'Meow', 'projects');
const OUT_FILE = path.resolve(process.cwd(), 'public', 'data', 'releases.json');

const ghHeaders = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'MeowLab-Release-Sync/1.0',
};
if (process.env.GITHUB_TOKEN) {
  ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

function cleanReleaseNotes(md) {
  if (!md) return '';
  return md
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1400);
}

function extractGhOwnerRepo(url) {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/\s#?]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/i, '');
  if (['orgs', 'topics', 'users', 'issues', 'pulls'].includes(owner.toLowerCase())) return null;
  return `${owner}/${repo}`;
}

function extractRepoTarget(sourceLinks) {
  for (const s of sourceLinks || []) {
    const url = String(s?.url || '').trim();
    if (!url) continue;
    const gh = extractGhOwnerRepo(url);
    if (gh) return { platform: 'github', ownerRepo: gh, url: `https://github.com/${gh}` };
    const gl = url.match(/gitlab\.com\/([^/\s#?]+(?:\/[^/\s#?]+)+)/i);
    if (gl) {
      const fullPath = gl[1].replace(/\/-\/.*$/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
      return { platform: 'gitlab', ownerRepo: fullPath, url: `https://gitlab.com/${fullPath}` };
    }
    const cb = url.match(/codeberg\.org\/([^/\s#?]+)\/([^/\s#?]+)/i);
    if (cb) {
      const pair = `${cb[1]}/${cb[2].replace(/\.git$/i, '')}`;
      return { platform: 'codeberg', ownerRepo: pair, url: `https://codeberg.org/${pair}` };
    }
    const gt = url.match(/gitea\.(?:com|io)\/([^/\s#?]+)\/([^/\s#?]+)/i);
    if (gt) {
      const host = url.includes('gitea.io') ? 'gitea.io' : 'gitea.com';
      const pair = `${gt[1]}/${gt[2].replace(/\.git$/i, '')}`;
      return { platform: 'gitea', ownerRepo: pair, url: `https://${host}/${pair}`, host };
    }
  }
  return null;
}

async function fetchRepoStars(target) {
  try {
    if (target.platform === 'github') {
      const res = await fetch(`https://api.github.com/repos/${target.ownerRepo}`, { headers: ghHeaders });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.stargazers_count === 'number') {
        return { count: data.stargazers_count, platform: 'github', url: target.url };
      }
    } else if (target.platform === 'gitlab') {
      const encoded = encodeURIComponent(target.ownerRepo);
      const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}`, {
        headers: { 'User-Agent': 'MeowLab-Release-Sync/1.0' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.star_count === 'number') {
        return { count: data.star_count, platform: 'gitlab', url: target.url };
      }
    } else if (target.platform === 'codeberg') {
      const res = await fetch(`https://codeberg.org/api/v1/repos/${target.ownerRepo}`, {
        headers: { 'User-Agent': 'MeowLab-Release-Sync/1.0' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.stars_count === 'number') {
        return { count: data.stars_count, platform: 'codeberg', url: target.url };
      }
    } else if (target.platform === 'gitea') {
      const res = await fetch(`https://${target.host}/api/v1/repos/${target.ownerRepo}`, {
        headers: { 'User-Agent': 'MeowLab-Release-Sync/1.0' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.stars_count === 'number') {
        return { count: data.stars_count, platform: 'gitea', url: target.url };
      }
    }
  } catch (e) {
    console.warn(`Failed fetching stars for ${target.platform}:${target.ownerRepo}:`, e.message);
  }
  return null;
}

async function fetchLatestRelease(ownerRepo) {
  try {
    let res = await fetch(`https://api.github.com/repos/${ownerRepo}/releases/latest`, { headers: ghHeaders });
    if (res.status === 404) {
      const listRes = await fetch(`https://api.github.com/repos/${ownerRepo}/releases?per_page=1`, { headers: ghHeaders });
      if (listRes.ok) {
        const arr = await listRes.json();
        if (Array.isArray(arr) && arr.length > 0) {
          const r = arr[0];
          return {
            tag: r.tag_name || r.name || 'latest',
            name: r.name || r.tag_name || '',
            publishedAt: (r.published_at || r.created_at || '').slice(0, 10),
            url: r.html_url || `https://github.com/${ownerRepo}/releases`,
            prerelease: Boolean(r.prerelease),
            changelog: cleanReleaseNotes(r.body || ''),
          };
        }
      }
      const tagRes = await fetch(`https://api.github.com/repos/${ownerRepo}/tags?per_page=1`, { headers: ghHeaders });
      if (tagRes.ok) {
        const tags = await tagRes.json();
        if (Array.isArray(tags) && tags.length > 0 && tags[0].name) {
          let commitDate = '';
          let commitMsg = '';
          if (tags[0].commit?.url) {
            const cRes = await fetch(tags[0].commit.url, { headers: ghHeaders });
            if (cRes.ok) {
              const cData = await cRes.json();
              commitDate = (cData?.commit?.committer?.date || cData?.commit?.author?.date || '').slice(0, 10);
              commitMsg = cleanReleaseNotes(cData?.commit?.message || '');
            }
          }
          return {
            tag: tags[0].name,
            name: tags[0].name,
            publishedAt: commitDate,
            url: `https://github.com/${ownerRepo}/releases/tag/${encodeURIComponent(tags[0].name)}`,
            prerelease: false,
            changelog: commitMsg,
          };
        }
      }
      return null;
    }
    if (!res.ok) {
      console.warn(`GitHub API ${res.status} for ${ownerRepo}`);
      return null;
    }
    const r = await res.json();
    return {
      tag: r.tag_name || r.name || 'latest',
      name: r.name || r.tag_name || '',
      publishedAt: (r.published_at || r.created_at || '').slice(0, 10),
      url: r.html_url || `https://github.com/${ownerRepo}/releases`,
      prerelease: Boolean(r.prerelease),
      changelog: cleanReleaseNotes(r.body || ''),
    };
  } catch (e) {
    console.warn(`Failed fetching release for ${ownerRepo}:`, e.message);
    return null;
  }
}

async function main() {
  let current = { updatedAt: new Date().toISOString(), releases: {}, stars: {} };
  if (fs.existsSync(OUT_FILE)) {
    try {
      current = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    } catch (_) {}
  }
  if (!current.releases) current.releases = {};
  if (!current.stars) current.stars = {};

  const slugs = fs.readdirSync(PROJECTS_DIR).filter((d) =>
    fs.existsSync(path.join(PROJECTS_DIR, d, 'project.json'))
  );

  const entries = slugs
    .map((slug) => ({
      slug,
      meta: JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, slug, 'project.json'), 'utf8')),
    }))
    .sort((a, b) => {
      const prio = (c) => (c === 'launcher' ? 0 : c === 'client' ? 1 : c === 'project' ? 2 : 3);
      return prio(a.meta.category) - prio(b.meta.category);
    });

  let updatedReleases = 0;
  let updatedStars = 0;

  // 1. Fetch repository stars for ALL open-source repos (GitHub, GitLab, Codeberg, Gitea)
  for (const { slug, meta } of entries) {
    const target = extractRepoTarget(meta.sourceLinks);
    if (!target) continue;
    const starInfo = await fetchRepoStars(target);
    if (starInfo) {
      current.stars[slug] = starInfo;
      updatedStars++;
      console.log(`★ ${slug} (${starInfo.platform}): ${starInfo.count}`);
    }
  }

  // 2. Fetch latest GitHub releases for GitHub-hosted projects
  for (const { slug, meta } of entries) {
    const ghLink = (meta.sourceLinks || []).find((s) => /github\.com\//i.test(s.url || ''));
    const ownerRepo = extractGhOwnerRepo(ghLink?.url);
    if (!ownerRepo) continue;

    const info = await fetchLatestRelease(ownerRepo);
    if (info) {
      current.releases[slug] = {
        repo: ownerRepo,
        ...info,
      };
      updatedReleases++;
      console.log(`✓ ${slug} (${meta.category}): ${info.tag} (${info.publishedAt || 'no-date'})`);
    }
  }

  current.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(current, null, 2) + '\n', 'utf8');
  console.log(`Saved ${updatedStars} star counts & ${updatedReleases} releases to public/data/releases.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
