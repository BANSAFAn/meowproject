import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // e.g. "BANSAFAn/meowproject"
const GITHUB_EVENT_NAME = process.env.GITHUB_EVENT_NAME || 'push';
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const STEP_SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY;

function configureBotGitAuthor() {
  execSync('git config user.name "meowblin"');
  execSync('git config user.email "meowblin@meowlab.pp.ua"');
}

const RATING_REGEX = /(?:\[rating\]\(\s*(100|[1-9]?\d)\s*\)|\[rating:\s*(100|[1-9]?\d)(?:\s*\/\s*100)?\s*\]|rating:\s*(100|[1-9]?\d))/i;

const SUPPORTED_LANGS = ['uk', 'en', 'de', 'pl', 'be', 'kk'];
const LANG_METADATA = {
  uk: { flag: '🇺🇦', name: 'Українська' },
  en: { flag: '🇬🇧', name: 'English' },
  pl: { flag: '🇵🇱', name: 'Polski' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  be: { flag: '🇧🇾', name: 'Беларуская' },
  kk: { flag: '🇰🇿', name: 'Қазақша' }
};

const LABEL_DEFINITIONS = {
  'launcher': { name: '🚀 launcher', color: 'd93f0b', description: 'Minecraft Game Launchers' },
  'modpack': { name: '📦 modpack', color: 'b60205', description: 'Modpacks and bundle distributions' },
  'mod': { name: '🧩 mod', color: '8250df', description: 'Mods and optimizations' },
  'client': { name: '⚡ client', color: 'bf8700', description: 'Custom game clients' },
  'server': { name: '🌐 server', color: '0969da', description: 'Minecraft Multiplayer Servers' },
  'website': { name: '🔗 website', color: '1f883d', description: 'Web tools and directories' },
  'project': { name: '⭐ project', color: 'e3b341', description: 'General Minecraft community projects' },
  'discussion': { name: '💬 discussion', color: '7057ff', description: 'Official community review thread' },
  'verified-submission': { name: '🛡️ verified-submission', color: '238636', description: 'Verified submission by MeowProject bot' },
  'automated-pr': { name: '🤖 automated-pr', color: '6e7781', description: 'Automated workflow processing' },
  'i18n': { name: '🌍 i18n', color: '0075ca', description: 'Localization and translations' },
};

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
  return JSON.parse(raw);
}

function getCategoryLabelName(category) {
  return LABEL_DEFINITIONS[category]?.name || category;
}

async function ensureRepositoryLabels() {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) return;
  appendSummary('### 🏷️ Ensuring colorful GitHub labels with emojis');
  try {
    const { ok, data: existingLabels } = await githubApi(`/repos/${GITHUB_REPOSITORY}/labels?per_page=100`);
    if (!ok || !Array.isArray(existingLabels)) return;

    for (const [key, def] of Object.entries(LABEL_DEFINITIONS)) {
      const exactMatch = existingLabels.find(l => l.name === def.name);
      const oldMatch = existingLabels.find(l => l.name.toLowerCase() === key.toLowerCase() || l.name.toLowerCase().endsWith(key.toLowerCase()));

      if (exactMatch) {
        if (exactMatch.color !== def.color || exactMatch.description !== def.description) {
          await githubApi(`/repos/${GITHUB_REPOSITORY}/labels/${encodeURIComponent(def.name)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ color: def.color, description: def.description })
          });
        }
      } else if (oldMatch) {
        appendSummary(`Renaming label "${oldMatch.name}" -> "${def.name}" (#${def.color})`);
        await githubApi(`/repos/${GITHUB_REPOSITORY}/labels/${encodeURIComponent(oldMatch.name)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_name: def.name, color: def.color, description: def.description })
        });
      } else {
        appendSummary(`Creating label "${def.name}" (#${def.color})`);
        await githubApi(`/repos/${GITHUB_REPOSITORY}/labels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: def.name, color: def.color, description: def.description })
        });
      }
    }
  } catch (err) {
    console.error('Error ensuring repository labels:', err.message);
  }
}

function appendSummary(text) {
  console.log(text);
  if (STEP_SUMMARY_PATH && fs.existsSync(path.dirname(STEP_SUMMARY_PATH))) {
    try {
      fs.appendFileSync(STEP_SUMMARY_PATH, text + '\n', 'utf8');
    } catch (_) {}
  }
}

async function githubApi(endpoint, options = {}) {
  const url = `https://api.github.com${endpoint}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'MeowProject-Bot',
    ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function postOrUpdateBotComment(issueNumber, markdownBody) {
  try {
    const { data: comments } = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments?per_page=100`);
    const existingComments = Array.isArray(comments) ? comments : [];

    // Find any existing comment posted by MeowProject Bot
    const botComment = existingComments.find(c => {
      const isBotUser = (c.user?.login || '').includes('github-actions') || (c.user?.type === 'Bot');
      const hasMarker = (c.body || '').includes('[MeowProject Bot]');
      return isBotUser || hasMarker;
    });

    if (botComment) {
      if (botComment.body.trim() === markdownBody.trim()) {
        console.log(`Bot comment on #${issueNumber} is identical, no update needed.`);
        return botComment;
      }
      console.log(`Updating existing bot comment #${botComment.id} on issue #${issueNumber}`);
      const updateRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/comments/${botComment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: markdownBody })
      });
      return updateRes.data;
    } else {
      console.log(`Posting new bot comment on issue #${issueNumber}`);
      const createRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: markdownBody })
      });
      return createRes.data;
    }
  } catch (err) {
    console.error(`Error in postOrUpdateBotComment for issue #${issueNumber}:`, err.message);
  }
}

function extractSection(text, title) {
  const reg = new RegExp('(?:^|\\n)###\\s+' + title + '\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|$)', 'i');
  const m = text.match(reg);
  return m ? m[1].trim() : '';
}

function decodeHtmlEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchYoutubeLatestVideos(channelId) {
  if (!channelId || !channelId.startsWith('UC')) return [];
  const uulf = 'UULF' + channelId.slice(2);
  try {
    let res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${uulf}`);
    if (!res.ok) {
      res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    }
    if (!res.ok) return [];
    const rss = await res.text();
    return [...rss.matchAll(/<entry>[\s\S]*?<yt:videoId>([^<]+)<\/yt:videoId>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<published>([^<]+)<\/published>[\s\S]*?<\/entry>/g)]
      .slice(0, 3)
      .map(m => ({ id: m[1], title: decodeHtmlEntities(m[2]), published: m[3].slice(0, 10) }));
  } catch (_) {
    return [];
  }
}

async function fetchYoutubeChannelInfo(rawUrl) {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = url.startsWith('@') ? `https://www.youtube.com/${url}` : `https://${url}`;
  }
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+667'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();

    const cidMatch =
      html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/) ||
      html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/) ||
      html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
    const channelId = cidMatch ? cidMatch[1] : null;

    const handleMatch =
      url.match(/\/(@[a-zA-Z0-9_.-]+)/) ||
      html.match(/"vanityChannelUrl"\s*:\s*"https?:\/\/(?:www\.)?youtube\.com\/(@[a-zA-Z0-9_.-]+)"/);
    const handle = handleMatch ? handleMatch[1] : null;

    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
    const channelName = ogTitle ? decodeHtmlEntities(ogTitle[1]).trim() : (handle || null);

    let description = '';
    const metaDescMatch = html.match(/"channelMetadataRenderer"\s*:\s*\{[\s\S]*?"description"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (metaDescMatch) {
      try { description = JSON.parse(`"${metaDescMatch[1]}"`).trim(); } catch (_) {}
    }
    if (!description) {
      const ogDesc = html.match(/<meta property="og:description" content="([^"]*)"/);
      if (ogDesc) description = decodeHtmlEntities(ogDesc[1]).trim();
    }

    const ogImg = html.match(/<meta property="og:image" content="([^"]+)"/);
    let avatarUrl = ogImg ? ogImg[1] : null;
    if (avatarUrl) avatarUrl = avatarUrl.replace(/=s\d+-/, '=s400-');

    let bannerUrl = null;
    const bannerBlock =
      html.match(/"imageBannerViewModel"\s*:\s*\{[\s\S]*?"sources"\s*:\s*(\[[\s\S]*?\])/) ||
      html.match(/"tvBanner"\s*:\s*\{\s*"thumbnails"\s*:\s*(\[[\s\S]*?\])/) ||
      html.match(/"banner"\s*:\s*\{\s*"thumbnails"\s*:\s*(\[[\s\S]*?\])/);
    if (bannerBlock) {
      try {
        const list = JSON.parse(bannerBlock[1]);
        if (Array.isArray(list) && list.length > 0) {
          bannerUrl = list[list.length - 1].url || null;
        }
      } catch (_) {}
    }

    return { channelId, channelName, handle, description, avatarUrl, bannerUrl };
  } catch (_) {
    return null;
  }
}

async function downloadImage(url, destPath) {
  try {
    let rawUrl = url;
    if (rawUrl.includes('github.com')) {
      rawUrl = rawUrl
        .replace('github.com/', 'raw.githubusercontent.com/')
        .replace('/blob/', '/')
        .replace('/raw/', '/');
    }
    const res = await fetch(rawUrl);
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, buffer);
      return true;
    }
  } catch (_) {}
  return false;
}

// -----------------------------------------------------------------------------
// A. REVIEW COMPILER (GitHub + GitLab issues comments -> static reviews.json)
// -----------------------------------------------------------------------------
const GITLAB_PROJECT = process.env.GITLAB_PROJECT || 'banernotfake/meowproject';
const CODEBERG_REPO = process.env.CODEBERG_REPO || 'Baneronetwo/meowlab';

async function fetchCodebergIssues() {
  try {
    const res = await fetch(`https://codeberg.org/api/v1/repos/${CODEBERG_REPO}/issues?state=open&limit=50`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchCodebergComments(num) {
  try {
    const res = await fetch(`https://codeberg.org/api/v1/repos/${CODEBERG_REPO}/issues/${num}/comments?limit=50`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchGitLabIssuesWithNotes() {
  try {
    const res = await fetch('https://gitlab.com/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ project(fullPath: "${GITLAB_PROJECT}") { issues(state: opened, first: 100) { nodes { iid title webUrl notes(first: 100) { nodes { id body system createdAt url author { username name avatarUrl } } } } } } }`
      })
    });
    if (!res.ok) return [];
    const data = await res.json();
    const nodes = data?.data?.project?.issues?.nodes;
    return Array.isArray(nodes) ? nodes : [];
  } catch {
    return [];
  }
}

async function compileReviews(issues, slugs, projectsDir) {
  appendSummary('### 💬 Compiling Community Reviews & Ratings into static reviews.json');
  const gitlabIssues = await fetchGitLabIssuesWithNotes();
  const codebergIssues = await fetchCodebergIssues();
  
  const reviewsData = {
    updatedAt: new Date().toISOString(),
    projects: {}
  };

  for (const slug of slugs) {
    const metaPath = path.join(projectsDir, slug, 'project.json');
    const meta = readJsonFile(metaPath);

    const issue = (meta.issueThreadNumber && issues.find(iss => !iss.pull_request && iss.number === meta.issueThreadNumber)) ||
      issues.find(iss => {
        if (iss.pull_request) return false;
        const t = (iss.title || '').toLowerCase();
        return t.includes(meta.name.toLowerCase()) || t.includes(slug.toLowerCase());
      });

    if (!issue) {
      reviewsData.projects[slug] = {
        issueNumber: meta.issueThreadNumber || null,
        issueUrl: null,
        averageRating: null,
        totalRatings: 0,
        commentsCount: 0,
        reviews: []
      };
      continue;
    }

    let comments = [];
    if (issue.comments > 0) {
      const cRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments?per_page=100`);
      if (cRes.ok && Array.isArray(cRes.data)) {
        comments = cRes.data;
      }
    }

    const ratings = [];
    const reviewsList = [];

    for (const c of comments) {
      // Ignore bot comments!
      const isBot = (c.user?.type === 'Bot') ||
        (c.user?.login || '').includes('github-actions') ||
        (c.user?.login || '').includes('[bot]') ||
        (c.body || '').includes('[MeowProject Bot]');
      if (isBot) continue;

      const rawBody = (c.body || '').trim();
      const trustedDiscordPosters = new Set([
        'banikikikikiai',
        String(process.env.DISCORD_REVIEW_AUTHOR || '').toLowerCase(),
        String((GITHUB_REPOSITORY || 'BANSAFAn/meowproject').split('/')[0]).toLowerCase(),
      ].filter(Boolean));
      let discordMeta = null;
      const discordMatch = rawBody.match(/<!--\s*meowlab-discord:([A-Za-z0-9_-]+)\s*-->/);
      if (discordMatch && trustedDiscordPosters.has(String(c.user?.login || '').toLowerCase())) {
        try {
          const parsed = JSON.parse(Buffer.from(discordMatch[1], 'base64url').toString('utf8'));
          if (parsed && /^\d{15,22}$/.test(String(parsed.id || ''))) {
            discordMeta = parsed;
          }
        } catch { /* ignore malformed marker */ }
      }

      const match = rawBody.match(RATING_REGEX);
      let score = null;
      if (match) {
        const val = Number(match[1] || match[2] || match[3]);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          score = val;
          ratings.push(score);
        }
      }
      const cleanedBody = rawBody
        .replace(/<!--\s*meowlab-discord:[A-Za-z0-9_-]+\s*-->/g, '')
        .replace(RATING_REGEX, '')
        .replace(/\n*— via MeowLab · Discord: [^\n]+\s*$/i, '')
        .trim();

      const rawReactions = c.reactions || {};
      const reactions = {};
      for (const key of ['+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes']) {
        if (typeof rawReactions[key] === 'number' && rawReactions[key] > 0) {
          reactions[key] = rawReactions[key];
        }
      }

      const discordAvatar = discordMeta
        ? (discordMeta.avatar && /^(a_)?[0-9a-f]{32}$/.test(String(discordMeta.avatar))
            ? `https://cdn.discordapp.com/avatars/${discordMeta.id}/${discordMeta.avatar}.png?size=64`
            : `https://cdn.discordapp.com/embed/avatars/${Number(String(discordMeta.id).slice(-2)) % 5}.png`)
        : '';

      reviewsList.push({
        id: c.id,
        source: discordMeta ? 'discord' : 'github',
        author: discordMeta ? (String(discordMeta.name || 'discord-user').slice(0, 40)) : (c.user?.login || 'community-user'),
        avatar: discordMeta ? discordAvatar : (c.user?.avatar_url || ''),
        date: (c.created_at || '').slice(0, 10),
        body: cleanedBody,
        score,
        reactions,
        url: c.html_url || issue.html_url,
        issueNum: issue.number
      });
    }

    // Merge GitLab issue notes if a matching GitLab issue exists
    const glIssue = (meta.gitlabIssueId && gitlabIssues.find(gi => Number(gi.iid) === Number(meta.gitlabIssueId))) ||
      gitlabIssues.find(gi => {
        const t = (gi.title || '').toLowerCase();
        return t.includes(meta.name.toLowerCase()) || t.includes(slug.toLowerCase());
      });
    const glNotes = glIssue?.notes?.nodes || [];
    for (const n of glNotes) {
      if (n.system) continue;
      const rawBody = (n.body || '').trim();
      const match = rawBody.match(RATING_REGEX);
      let score = null;
      if (match) {
        const val = Number(match[1] || match[2] || match[3]);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          score = val;
          ratings.push(score);
        }
      }
      const cleanedBody = rawBody.replace(RATING_REGEX, '').trim();
      const rawAvatar = n.author?.avatarUrl || '';
      const avatar = rawAvatar.startsWith('/') ? `https://gitlab.com${rawAvatar}` : rawAvatar;
      const noteId = String(n.id || '').split('/').pop();
      reviewsList.push({
        id: `gl-${noteId}`,
        source: 'gitlab',
        author: n.author?.username || n.author?.name || 'gitlab-user',
        avatar,
        date: (n.createdAt || '').slice(0, 10),
        body: cleanedBody,
        score,
        reactions: {},
        url: n.url || glIssue.webUrl,
        issueNum: Number(glIssue.iid) || glIssue.iid
      });
    }

    // Merge Codeberg issue comments if a matching Codeberg issue exists
    const cbIssue = codebergIssues.find(ci => {
      const t = (ci.title || '').toLowerCase();
      return t.includes(meta.name.toLowerCase()) || t.includes(slug.toLowerCase());
    });
    if (cbIssue && cbIssue.comments > 0) {
      const cbComments = await fetchCodebergComments(cbIssue.number);
      for (const c of cbComments) {
        const rawBody = (c.body || '').trim();
        const match = rawBody.match(RATING_REGEX);
        let score = null;
        if (match) {
          const val = Number(match[1] || match[2] || match[3]);
          if (!isNaN(val) && val >= 0 && val <= 100) {
            score = val;
            ratings.push(score);
          }
        }
        const cleanedBody = rawBody.replace(RATING_REGEX, '').trim();
        reviewsList.push({
          id: `cb-${c.id}`,
          source: 'codeberg',
          author: c.user?.login || c.user?.username || 'codeberg-user',
          avatar: c.user?.avatar_url || '',
          date: (c.created_at || '').slice(0, 10),
          body: cleanedBody,
          score,
          reactions: {},
          url: c.html_url || cbIssue.html_url,
          issueNum: cbIssue.number
        });
      }
    }

    const avg = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;

    reviewsData.projects[slug] = {
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      averageRating: avg,
      totalRatings: ratings.length,
      commentsCount: reviewsList.length,
      reviews: reviewsList
    };

    appendSummary(`- **${meta.name}** (#${issue.number}): ${reviewsList.length} comments, avg rating: ${avg !== null ? `${avg}/100` : 'none'}`);
  }

  const outDir = path.resolve('public/data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'reviews.json');
  fs.writeFileSync(outPath, JSON.stringify(reviewsData, null, 2) + '\n', 'utf8');
  appendSummary('✅ Successfully updated `public/data/reviews.json`');
  return true;
}

// -----------------------------------------------------------------------------
// B. HANDLE PUSH / DISPATCH
// -----------------------------------------------------------------------------
async function handlePushOrDispatch() {
  appendSummary('## 🐾 MeowProject Bot: Syncing Discussion Issues');
  
  const projectsDir = path.resolve('Meow/projects');
  if (!fs.existsSync(projectsDir)) {
    appendSummary('❌ `Meow/projects` directory not found.');
    return;
  }

  const { status, ok, data: issues } = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues?state=all&per_page=100`);
  if (!ok) {
    appendSummary(`❌ Failed to fetch issues (HTTP ${status}): ${JSON.stringify(issues)}`);
    return;
  }

  appendSummary(`Found ${issues.length} existing issues in repository.`);

  // Ensure repository labels are colorful and have emojis!
  await ensureRepositoryLabels();

  // Close legacy proposal issue #6 if open
  try {
    const issue6 = issues.find(i => i.number === 6 && i.state === 'open');
    if (issue6) {
      appendSummary('Closing legacy proposal issue #6 in favor of official discussion #19...');
      await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/6`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'closed' })
      });
    }
  } catch (_) {}

  const preferredOrder = ['xmcl', 'hmcl', 'atm9', 'sodium', 'lunarclient'];
  const allFolders = fs.readdirSync(projectsDir).filter(f => {
    return fs.statSync(path.join(projectsDir, f)).isDirectory() && fs.existsSync(path.join(projectsDir, f, 'project.json'));
  });

  const slugs = [
    ...preferredOrder.filter(s => allFolders.includes(s)),
    ...allFolders.filter(s => !preferredOrder.includes(s))
  ];

  appendSummary(`Catalog projects to check: \`${slugs.join(', ')}\``);

  let modifiedMeta = false;

  for (const slug of slugs) {
    const metaPath = path.join(projectsDir, slug, 'project.json');
    const meta = readJsonFile(metaPath);
    const expectedTitle = `${meta.category}: ${meta.name}`;

    const existing = issues.find(iss => {
      if (iss.pull_request) return false;
      const isBotAuthor = (iss.user?.login || '').includes('github-actions') || iss.user?.type === 'Bot';
      const t = (iss.title || '').toLowerCase();
      const titleMatches = t === expectedTitle.toLowerCase() || t === meta.name.toLowerCase();
      return isBotAuthor && (titleMatches || (meta.issueThreadNumber && iss.number === meta.issueThreadNumber));
    });

    let targetIssueNumber = existing ? existing.number : null;

    if (existing) {
      appendSummary(`ℹ️ Official discussion issue already exists: #${existing.number} ([${existing.title}](${existing.html_url}))`);
      if (existing.state === 'closed') {
        appendSummary(`Reopening catalog discussion issue #${existing.number} for **${meta.name}**...`);
        await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${existing.number}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: 'open' })
        });
      }
    } else {
      appendSummary(`Creating official discussion issue for **${meta.name}**...`);
      let ukDesc = '';
      let enDesc = '';
      const ukPath = path.join(projectsDir, slug, 'locales', 'uk.json');
      const enPath = path.join(projectsDir, slug, 'locales', 'en.json');
      if (fs.existsSync(ukPath)) {
        try { ukDesc = readJsonFile(ukPath).description || ''; } catch (_) {}
      }
      if (fs.existsSync(enPath)) {
        try { enDesc = readJsonFile(enPath).description || ''; } catch (_) {}
      }

      const issueBody = [
        `### ${meta.category.toUpperCase()}: ${meta.name}`,
        ``,
        `Official discussion and community review thread for **${meta.name}**.`,
        ``,
        `- **Website:** ${meta.website || 'N/A'}`,
        `- **Country:** ${meta.country}`,
        `- **License:** ${meta.license}`,
        `- **Platforms:** ${(meta.platforms || []).join(', ')}`,
        ``,
        `---`,
        `#### Description (UK)`,
        ukDesc || 'N/A',
        ``,
        `#### Description (EN)`,
        enDesc || 'N/A',
        ``,
        `---`,
        `### How to leave a review / rating`,
        `Write your feedback in a comment below! Adding \`[rating](0-100)\` at the end (e.g. \`[rating](95)\`) is completely optional and will be automatically displayed on the MeowProject directory card.`,
      ].join('\n');

      let createRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expectedTitle,
          body: issueBody,
          labels: [
            getCategoryLabelName(meta.category),
            LABEL_DEFINITIONS['verified-submission'].name,
            LABEL_DEFINITIONS['discussion'].name
          ]
        })
      });

      if (!createRes.ok && createRes.status === 422) {
        createRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: expectedTitle,
            body: issueBody
          })
        });
      }

      if (createRes.ok) {
        targetIssueNumber = createRes.data.number;
        issues.push(createRes.data);
        appendSummary(`✅ Created Issue #${targetIssueNumber}: [${expectedTitle}](${createRes.data.html_url})`);

        // Close any old user proposal issue and link to this new official thread
        try {
          const userProposal = issues.find(i => !i.pull_request && (i.title || '').toLowerCase().includes(meta.name.toLowerCase()) && i.number !== targetIssueNumber);
          if (userProposal) {
            await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${userProposal.number}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                body: `### [MeowProject Bot] Project Accepted & Published to Catalog! 🎉\n\n**${meta.name}** has been accepted and merged into the live MeowProject catalog!\n\nThe official community discussion and reviews thread has been established here: #${targetIssueNumber}.\n\n*Closing this proposal issue as completed.*`
              })
            });
            await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${userProposal.number}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: 'closed' })
            });
          }
        } catch (_) {}
      } else {
        appendSummary(`❌ Failed to create issue for ${meta.name} (HTTP ${createRes.status}): ${JSON.stringify(createRes.data)}`);
      }
    }

    if (targetIssueNumber && meta.issueThreadNumber !== targetIssueNumber) {
      meta.issueThreadNumber = targetIssueNumber;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      modifiedMeta = true;
    }
  }

  // Compile reviews.json from real comments!
  await compileReviews(issues, slugs, projectsDir);

  // Refresh YouTubers: auto-enrich missing channelId / avatar / banner / description + 3 latest regular videos (UULF = no Shorts, no Live)
  try {
    const ytFile = path.resolve(process.cwd(), 'public', 'data', 'youtubers.json');
    let ytData = { updatedAt: new Date().toISOString(), channels: {} };
    if (fs.existsSync(ytFile)) {
      try { ytData = readJsonFile(ytFile); } catch (_) {}
    }

    let ytChanged = false;
    for (const slug of slugs) {
      const metaPath = path.join(projectsDir, slug, 'project.json');
      const meta = readJsonFile(metaPath);
      if (meta.category !== 'youtuber') continue;

      const publicDir = path.resolve(process.cwd(), 'public', 'projects', slug);
      const needsEnrich = !meta.youtubeChannelId || !meta.youtubeChannelId.startsWith('UC') || !meta.icon || meta.icon === '/favicon.svg' || !meta.banner;

      if (needsEnrich && (meta.website || meta.youtubeHandle)) {
        const ytUrl = meta.website || `https://www.youtube.com/${meta.youtubeHandle}`;
        const info = await fetchYoutubeChannelInfo(ytUrl);
        if (info) {
          if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
          if (info.channelId && !meta.youtubeChannelId) {
            meta.youtubeChannelId = info.channelId;
            modifiedMeta = true;
            ytChanged = true;
          }
          if (info.handle && !meta.youtubeHandle) {
            meta.youtubeHandle = info.handle;
            modifiedMeta = true;
          }
          if (info.channelName && (!meta.name || meta.name.startsWith('@'))) {
            meta.name = info.channelName;
            meta.shortName = info.channelName;
            modifiedMeta = true;
          }
          if (info.avatarUrl && (!meta.icon || meta.icon === '/favicon.svg')) {
            const ok = await downloadImage(info.avatarUrl, path.join(publicDir, 'icon.jpg'));
            if (ok) {
              meta.icon = `/projects/${slug}/icon.jpg`;
              modifiedMeta = true;
              ytChanged = true;
            }
          }
          if (info.bannerUrl && !meta.banner) {
            const ok = await downloadImage(info.bannerUrl, path.join(publicDir, 'banner.jpg'));
            if (ok) {
              meta.banner = `/projects/${slug}/banner.jpg`;
              modifiedMeta = true;
              ytChanged = true;
            }
          }
          if (info.description) {
            const ukLocPath = path.join(projectsDir, slug, 'locales', 'uk.json');
            if (!fs.existsSync(ukLocPath)) {
              fs.mkdirSync(path.dirname(ukLocPath), { recursive: true });
              fs.writeFileSync(ukLocPath, JSON.stringify({
                tagline: info.channelName || meta.name,
                description: info.description,
                features: [],
                screenshotCaptions: []
              }, null, 2) + '\n', 'utf8');
              modifiedMeta = true;
            }
          }
          if (modifiedMeta) {
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
          }
        }
      }

      if (!meta.youtubeChannelId || !meta.youtubeChannelId.startsWith('UC')) continue;
      try {
        const vids = await fetchYoutubeLatestVideos(meta.youtubeChannelId);
        if (vids.length > 0) {
          const prevIds = (meta.latestVideos || []).map(v => v.id).join(',');
          const nextIds = vids.map(v => v.id).join(',');
          if (prevIds !== nextIds) {
            meta.latestVideos = vids;
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
            modifiedMeta = true;
            ytChanged = true;
          }
          ytData.channels[slug] = {
            youtubeChannelId: meta.youtubeChannelId,
            banner: meta.banner || null,
            latestVideos: vids
          };
          ytChanged = true;
        }
      } catch (_) {}
    }
    if (ytChanged) {
      ytData.updatedAt = new Date().toISOString();
      fs.mkdirSync(path.dirname(ytFile), { recursive: true });
      fs.writeFileSync(ytFile, JSON.stringify(ytData, null, 2) + '\n', 'utf8');
      appendSummary('📺 Refreshed YouTubers metadata (avatar/banner/channelId) & latest regular videos (no Shorts/Live).');
    }
  } catch (e) {
    appendSummary(`⚠️ YouTubers refresh skipped: ${e.message}`);
  }

  // Auto-close accidental PRs for existing catalog issues (#3 ATM9, #4 Sodium, #5 Lunar Client)
  try {
    const { data: openPrs } = await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls?state=open&per_page=50`);
    if (Array.isArray(openPrs)) {
      for (const pr of openPrs) {
        // If PR points to issue 3, 4, 5 (existing catalog items)
        if ([3, 4, 5].some(num => (pr.title || '').includes(`(#${num})`) || (pr.head?.ref || '').includes(`issue-${num}`))) {
          appendSummary(`Closing duplicate PR #${pr.number} ("${pr.title}")...`);
          await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls/${pr.number}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: 'closed' })
          });
          // Delete any bot comments on the closed PR
          try {
            const { data: prComments } = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${pr.number}/comments?per_page=100`);
            if (Array.isArray(prComments)) {
              for (const pc of prComments) {
                if ((pc.user?.login || '').includes('github-actions') || (pc.user?.type === 'Bot')) {
                  await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/comments/${pc.id}`, { method: 'DELETE' });
                }
              }
            }
          } catch (_) {}
        }
      }
    }
  } catch (e) {
    appendSummary(`Note: cleanup PRs status: ${e.message}`);
  }

  // Clean up any old bot error comments on official catalog discussion issues (#1-#5)
  for (const issNum of [1, 2, 3, 4, 5]) {
    try {
      const { data: comments } = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issNum}/comments?per_page=100`);
      if (Array.isArray(comments)) {
        for (const c of comments) {
          const isBot = (c.user?.login || '').includes('github-actions') || (c.user?.type === 'Bot');
          const isSpam = (c.body || '').includes('[MeowProject Bot]') && (
            c.body.includes('Description Required') ||
            c.body.includes('Title Format Verification') ||
            c.body.includes('Submission Verified') ||
            c.body.includes('Translation Template') ||
            c.body.includes('Closed duplicate PR')
          );
          if (isBot && isSpam) {
            console.log(`Deleting spam bot comment #${c.id} from catalog issue #${issNum}`);
            await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/comments/${c.id}`, { method: 'DELETE' });
          }
        }
      }
    } catch (e) {
      console.error(`Note: clean comments on #${issNum}: ${e.message}`);
    }
  }

  await syncDiscussionsAndStats();

  try {
    const status = execSync('git status --porcelain').toString().trim();
    if (status.length > 0) {
      configureBotGitAuthor();
      execSync('git add public/data/reviews.json public/data/discussions.json public/data/repo-stats.json Meow/projects/*/project.json');
      execSync('git commit -m "chore(bot): sync issues, discussions and community reviews"');
      execSync('git push origin main');
      appendSummary('✅ Successfully committed changes to main branch.');
    } else {
      appendSummary('ℹ️ No repository changes needed.');
    }
  } catch (e) {
    appendSummary(`⚠️ Note: Git sync status: ${e.message}`);
  }
}

async function syncDiscussionsAndStats() {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) return;
  const [owner, name] = GITHUB_REPOSITORY.split('/');
  if (!owner || !name) return;

  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        stargazerCount
        discussions(first: 20, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes {
            number
            title
            url
            createdAt
            upvoteCount
            answerChosenAt
            bodyText
            author { login }
            category { name emojiHTML }
            comments { totalCount }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MeowProject-Bot/1.0'
      },
      body: JSON.stringify({ query, variables: { owner, name } })
    });
    const json = await res.json();
    const repoNode = json?.data?.repository;
    if (!repoNode) return;

    const nowIso = new Date().toISOString();
    if (typeof repoNode.stargazerCount === 'number') {
      const statsPath = path.join(process.cwd(), 'public/data/repo-stats.json');
      let prevStats = null;
      try { prevStats = JSON.parse(fs.readFileSync(statsPath, 'utf8')); } catch (_) {}
      if (!prevStats || prevStats.stars !== repoNode.stargazerCount || prevStats.repo !== GITHUB_REPOSITORY) {
        fs.writeFileSync(
          statsPath,
          JSON.stringify({ updatedAt: nowIso, repo: GITHUB_REPOSITORY, stars: repoNode.stargazerCount }, null, 2) + '\n',
          'utf8'
        );
      }
    }

    const nodes = repoNode.discussions?.nodes || [];
    const discussions = nodes.map((d) => ({
      number: d.number,
      title: d.title,
      url: d.url,
      category: d.category?.name || 'General',
      author: d.author?.login || 'ghost',
      createdAt: d.createdAt,
      commentsCount: d.comments?.totalCount || 0,
      upvotes: d.upvoteCount || 0,
      answered: Boolean(d.answerChosenAt),
      excerpt: (d.bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 180)
    }));

    const discPath = path.join(process.cwd(), 'public/data/discussions.json');
    let prevDisc = null;
    try { prevDisc = JSON.parse(fs.readFileSync(discPath, 'utf8')); } catch (_) {}
    if (!prevDisc || JSON.stringify(prevDisc.discussions) !== JSON.stringify(discussions) || prevDisc.repo !== GITHUB_REPOSITORY) {
      fs.writeFileSync(
        discPath,
        JSON.stringify({ updatedAt: nowIso, repo: GITHUB_REPOSITORY, discussions }, null, 2) + '\n',
        'utf8'
      );
    }
  } catch (e) {
    console.error('syncDiscussionsAndStats error:', e.message);
  }
}

async function handleComment() {
  appendSummary('## 💬 MeowProject Bot: New Comment Detected');
  await handlePushOrDispatch();
}

// -----------------------------------------------------------------------------
// C. PROJECT PROPOSAL -> AUTOMATED PULL REQUEST
// -----------------------------------------------------------------------------
async function handleProjectSubmission(issue, matchedPrefix) {
  const title = (issue.title || '').trim();
  const body = (issue.body || '').trim();

  // Never process existing catalog projects as new proposals!
  const projectsDir = path.resolve('Meow/projects');
  const catalogIssues = [1, 2, 3, 4, 5];
  if (catalogIssues.includes(issue.number)) {
    console.log(`Issue #${issue.number} is an official catalog thread. Skipping proposal.`);
    return;
  }

  appendSummary(`### 🚀 Processing New Project Proposal from Issue #${issue.number}: "${title}"`);

  const category = matchedPrefix.replace(':', '').trim().toLowerCase();
  let rawName = title.replace(new RegExp('^' + matchedPrefix, 'i'), '').trim();
  if (!rawName) {
    const fromSection = extractSection(body, 'Type & Name');
    rawName = fromSection.replace(/^`?.*:\s*|`?$/g, '').trim();
  }
  const name = rawName || 'Untitled Project';
  const slug = name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

  if (fs.existsSync(path.join(projectsDir, slug, 'project.json'))) {
    console.log(`Project with slug "${slug}" is already in the catalog (Meow/projects/${slug}). Skipping.`);
    return;
  }

  const country = extractSection(body, 'Country') || 'GLOBAL';
  const platformsRaw = extractSection(body, 'Platforms');
  const platforms = platformsRaw
    ? platformsRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
    : ['Windows'];

  const website = extractSection(body, 'Website');

  // Source code links
  const sourceSection = extractSection(body, 'Source code');
  const sourceLinks = [];
  for (const line of sourceSection.split('\n')) {
    const clean = line.replace(/^[-*]\s*/, '').trim();
    const m = clean.match(/^([a-z0-9_-]+)\s*:\s*(https?:\/\/\S+)/i);
    if (m) {
      sourceLinks.push({
        host: m[1].toLowerCase(),
        label: m[1].charAt(0).toUpperCase() + m[1].slice(1),
        url: m[2]
      });
    } else if (/^https?:\/\//i.test(clean)) {
      sourceLinks.push({
        host: 'git',
        label: 'Repository',
        url: clean
      });
    }
  }

  // Captions & Features
  const featureLines = extractSection(body, 'Key Features')
    .split('\n')
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const captionLines = extractSection(body, 'Screenshot Captions')
    .split('\n')
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  // Parse multi-language descriptions
  const descSection = extractSection(body, 'Description') || body;
  const langRegex = /(?:^|\n)####\s+([A-Za-z]{2})\s*\n([\s\S]*?)(?=\n####\s+[A-Za-z]{2}|$)/gi;
  
  const parsedDescriptions = {};
  let lMatch;
  while ((lMatch = langRegex.exec(descSection)) !== null) {
    let code = lMatch[1].toLowerCase();
    if (code === 'kz') code = 'kk';
    if (code === 'by') code = 'be';
    parsedDescriptions[code] = lMatch[2].trim();
  }

  // Fallback if no language tags were used
  if (Object.keys(parsedDescriptions).length === 0 && descSection.length >= 20) {
    parsedDescriptions['en'] = descSection;
  }

  const validLangs = [];
  const invalidLangs = [];
  const missingLangs = [];
  const langTableRows = [];

  for (const code of SUPPORTED_LANGS) {
    const text = parsedDescriptions[code];
    const meta = LANG_METADATA[code] || { flag: '🌐', name: code.toUpperCase() };
    const label = `${meta.flag} **${code.toUpperCase()}** (${meta.name})`;

    // Expanded limit: 20 to 5,000 characters
    if (text && text.length >= 20 && text.length <= 5000) {
      validLangs.push(code);
      langTableRows.push(`| ${label} | ${text.length} chars | ✅ **Included in PR** |`);
    } else if (text) {
      invalidLangs.push(code);
      langTableRows.push(`| ${label} | ${text.length} chars | ⚠️ **Out of bounds** (20–5,000 chars required) |`);
    } else {
      missingLangs.push(code);
      langTableRows.push(`| ${label} | — | ⚪ **Not provided** (can be added later via issue) |`);
    }
  }

  // Auto-fetch YouTube channel metadata (avatar, banner, channelId, description, videos) if category is youtuber
  let ytInfo = null;
  let ytVideos = [];
  if (category === 'youtuber') {
    const ytUrlMatch = (website || body || '').match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)>"]+/i);
    const ytUrl = ytUrlMatch ? ytUrlMatch[0] : (name.startsWith('@') ? `https://www.youtube.com/${name}` : '');
    if (ytUrl) {
      ytInfo = await fetchYoutubeChannelInfo(ytUrl);
      if (ytInfo) {
        if (!website) website = ytUrl;
        if (ytInfo.channelId) {
          ytVideos = await fetchYoutubeLatestVideos(ytInfo.channelId);
        }
        if (validLangs.length === 0) {
          const autoDesc = (ytInfo.description && ytInfo.description.trim().length >= 5)
            ? ytInfo.description.trim()
            : `YouTube-канал ${ytInfo.channelName || name} (${ytUrl})`;
          parsedDescriptions.uk = autoDesc;
          validLangs.push('uk');
          langTableRows.push(`| 🇺🇦 **UK** (Auto from YouTube) | ${autoDesc.length} chars | ✅ **Included in PR** |`);
        }
      }
    }
  }

  if (validLangs.length === 0) {
    await postOrUpdateBotComment(issue.number, [
      `### [MeowProject Bot] Description Required ❌`,
      ``,
      `Could not find a valid description in any supported language. Each description must have between 20 and 5,000 characters.`,
      ``,
      `#### 🌐 Current Verification Status:`,
      `| Language | Length | Status |`,
      `|:---|:---|:---|`,
      ...langTableRows,
      ``,
      `Please edit your issue description and add language headers like:`,
      `\`\`\`markdown`,
      `### Description`,
      `#### UK`,
      `Ваш опис українською мовою...`,
      ``,
      `#### EN`,
      `Your description in English...`,
      `\`\`\``
    ].join('\n'));
    return;
  }

  // Images handling
  const projectDir = path.resolve('Meow/projects', slug);
  const localesDir = path.join(projectDir, 'locales');
  const publicDir = path.resolve('public/projects', slug);

  if (!fs.existsSync(localesDir)) fs.mkdirSync(localesDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  // 1. Icon handling with automated repository probing
  let iconFinal = '/favicon.svg';
  const iconCandidates = [];
  const iconRaw = extractSection(body, 'Icon');
  if (iconRaw && /^https?:\/\//i.test(iconRaw)) {
    iconCandidates.push(iconRaw);
  }
  if (ytInfo && ytInfo.avatarUrl) {
    iconCandidates.push(ytInfo.avatarUrl);
  }

  const ghRepoLink = sourceLinks.find(s => (s.url || '').includes('github.com'));
  if (ghRepoLink) {
    const m = ghRepoLink.url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
    if (m) {
      const baseRaw = `https://raw.githubusercontent.com/${m[1]}/${m[2]}`;
      for (const branch of ['main', 'master']) {
        iconCandidates.push(
          `${baseRaw}/${branch}/Natsurainko.FluentLauncher/Assets/AppIcon.png`,
          `${baseRaw}/${branch}/Assets/AppIcon.png`,
          `${baseRaw}/${branch}/assets/icon.png`,
          `${baseRaw}/${branch}/assets/logo.png`,
          `${baseRaw}/${branch}/src/assets/icon.png`,
          `${baseRaw}/${branch}/icon.png`,
          `${baseRaw}/${branch}/logo.png`,
          `${baseRaw}/${branch}/icon.svg`,
          `${baseRaw}/${branch}/logo.svg`
        );
      }
    }
  }

  for (const cand of iconCandidates) {
    const ext = cand.includes('.svg') ? '.svg' : cand.includes('.webp') ? '.webp' : '.png';
    const localIconPath = path.join(publicDir, `icon${ext}`);
    const downloaded = await downloadImage(cand, localIconPath);
    if (downloaded) {
      iconFinal = `/projects/${slug}/icon${ext}`;
      break;
    }
  }

  // 2. Screenshots handling with automated GitHub link fixing & local bundling
  const screenshotLines = extractSection(body, 'Screenshots')
    .split('\n')
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const screenshotsFinal = [];
  let sIdx = 1;
  for (const sUrl of screenshotLines) {
    if (/^https?:\/\//i.test(sUrl)) {
      const ext = sUrl.endsWith('.webp') ? '.webp' : '.png';
      const localScreenPath = path.join(publicDir, `screen-${sIdx}${ext}`);

      let downloaded = await downloadImage(sUrl, localScreenPath);
      if (!downloaded && sUrl.includes('/raw/')) {
        downloaded = await downloadImage(sUrl.replace('/raw/', '/'), localScreenPath);
      }
      if (!downloaded && sUrl.includes('github.com')) {
        downloaded = await downloadImage(
          sUrl.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/').replace('/raw/', '/'),
          localScreenPath
        );
      }

      if (downloaded) {
        screenshotsFinal.push(`/projects/${slug}/screen-${sIdx}${ext}`);
        sIdx++;
      }
    }
  }

  // Fallback: If no screenshots were downloaded, probe repo docs for hero images
  if (screenshotsFinal.length === 0 && ghRepoLink) {
    const m = ghRepoLink.url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
    if (m) {
      const baseRaw = `https://raw.githubusercontent.com/${m[1]}/${m[2]}`;
      for (const branch of ['main', 'master']) {
        const heroUrl = `${baseRaw}/${branch}/docs/images/Hero_Image.png`;
        const localScreenPath = path.join(publicDir, `screen-1.png`);
        const downloaded = await downloadImage(heroUrl, localScreenPath);
        if (downloaded) {
          screenshotsFinal.push(`/projects/${slug}/screen-1.png`);
          break;
        }
      }
    }
  }

  // Write locales
  for (const lang of validLangs) {
    const localeFile = path.join(localesDir, `${lang}.json`);
    const localeContent = {
      tagline: featureLines[0] || name,
      description: parsedDescriptions[lang],
      features: featureLines,
      screenshotCaptions: captionLines
    };
    fs.writeFileSync(localeFile, JSON.stringify(localeContent, null, 2) + '\n', 'utf8');
  }

  // 3. GitHub License & Developer Probing
  let detectedLicense = 'Open Source';
  let detectedDeveloper = sourceLinks[0]?.label || 'Community';

  if (ghRepoLink) {
    const m = ghRepoLink.url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
    if (m) {
      try {
        const ghRepoRes = await githubApi(`/repos/${m[1]}/${m[2]}`);
        if (ghRepoRes.ok && ghRepoRes.data) {
          if (ghRepoRes.data.license?.spdx_id && ghRepoRes.data.license.spdx_id !== 'NOASSERTION') {
            detectedLicense = ghRepoRes.data.license.spdx_id;
          } else if (ghRepoRes.data.license?.name) {
            detectedLicense = ghRepoRes.data.license.name;
          }
          if (ghRepoRes.data.owner?.login && (!detectedDeveloper || detectedDeveloper.toLowerCase() === 'github' || detectedDeveloper === 'Community')) {
            detectedDeveloper = ghRepoRes.data.owner.login;
          }
        }
      } catch (_) {}
    }
  }

  // Download YouTube channel banner if available
  let ytBannerFinal = null;
  if (ytInfo && ytInfo.bannerUrl) {
    const localBannerPath = path.join(publicDir, 'banner.jpg');
    const ok = await downloadImage(ytInfo.bannerUrl, localBannerPath);
    if (ok) ytBannerFinal = `/projects/${slug}/banner.jpg`;
  }

  // Write project.json
  const projectJsonPath = path.join(projectDir, 'project.json');
  const displayName = (category === 'youtuber' && ytInfo?.channelName && name.startsWith('@')) ? ytInfo.channelName : name;
  const projectMeta = {
    slug,
    name: displayName,
    shortName: displayName,
    category,
    icon: iconFinal,
    country,
    developer: category === 'youtuber' ? displayName : detectedDeveloper,
    license: detectedLicense,
    platforms: category === 'youtuber' ? ['YouTube'] : platforms,
    website: website || sourceLinks[0]?.url || '',
    sourceLinks,
    issueThreadNumber: issue.number,
    issueSearchTerm: displayName,
    tags: [category, ...(category === 'youtuber' ? ['YouTube'] : platforms), country].filter(Boolean),
    screenshots: screenshotsFinal,
    ...(ytInfo?.channelId ? { youtubeChannelId: ytInfo.channelId } : {}),
    ...(ytInfo?.handle ? { youtubeHandle: ytInfo.handle } : {}),
    ...(ytBannerFinal ? { banner: ytBannerFinal } : {}),
    ...(ytVideos.length > 0 ? { latestVideos: ytVideos } : {})
  };
  fs.writeFileSync(projectJsonPath, JSON.stringify(projectMeta, null, 2) + '\n', 'utf8');

  if (category === 'youtuber' && ytInfo?.channelId && ytVideos.length > 0) {
    try {
      const ytFile = path.resolve(process.cwd(), 'public', 'data', 'youtubers.json');
      let ytData = { updatedAt: new Date().toISOString(), channels: {} };
      if (fs.existsSync(ytFile)) {
        try { ytData = readJsonFile(ytFile); } catch (_) {}
      }
      ytData.channels[slug] = {
        youtubeChannelId: ytInfo.channelId,
        banner: ytBannerFinal,
        latestVideos: ytVideos
      };
      ytData.updatedAt = new Date().toISOString();
      fs.writeFileSync(ytFile, JSON.stringify(ytData, null, 2) + '\n', 'utf8');
    } catch (_) {}
  }

  // Git Branch & Commit & Push
  const branchName = `add-project-${slug}-issue-${issue.number}`;
  try {
    configureBotGitAuthor();
    execSync(`git checkout -B ${branchName}`);
    execSync(`git add Meow/projects/${slug}/ public/projects/${slug}/ public/data/youtubers.json wrangler.jsonc`);
    execSync(`git commit -m "feat(catalog): propose ${category} ${name} from issue #${issue.number}"`);
    execSync(`git push origin ${branchName} --force`);
    appendSummary(`✅ Created & pushed branch: \`${branchName}\``);

    // Create GitHub Pull Request
    const prRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `feat(catalog): add ${category} ${name} (#${issue.number})`,
        head: branchName,
        base: 'main',
        body: [
          `### 🚀 New Project Proposal: ${name} (${category})`,
          ``,
          `Automated Pull Request generated by **MeowProject Bot** from issue #${issue.number}.`,
          ``,
          `#### 📋 Project Details:`,
          `- **Name:** **${name}**`,
          `- **Category:** \`${category}\``,
          `- **Country:** ${country}`,
          `- **Platforms:** ${platforms.join(', ')}`,
          `- **Website:** ${website || 'N/A'}`,
          ``,
          `#### 🌐 Localization Status:`,
          `| Language | Characters | Status |`,
          `|:---|:---|:---|`,
          ...langTableRows,
          ``,
          `#### 📁 Files Added:`,
          `- \`Meow/projects/${slug}/project.json\``,
          ...validLangs.map(l => `- \`Meow/projects/${slug}/locales/${l}.json\``),
          ...(fs.existsSync(publicDir) ? [`- Assets in \`public/projects/${slug}/\``] : []),
          ``,
          `---`,
          `Closes #${issue.number}`
        ].join('\n')
      })
    });

    if (!prRes.ok) {
      appendSummary(`❌ Failed to create Pull Request (HTTP ${prRes.status}): ${JSON.stringify(prRes.data)}`);
      
      let errorNote = `**Помилка GitHub API (HTTP ${prRes.status}):** \`${JSON.stringify(prRes.data?.message || prRes.data)}\``;
      if (prRes.status === 403) {
        errorNote += `\n\n> ⚠️ **Потрібен дозвіл у налаштуваннях репозиторію**:\n> GitHub за замовчуванням блокує створення Pull Request через автоматизацію GitHub Actions.\n> **Як увімкнути за 10 секунд**:\n> 1. Перейдіть у вкладку **Settings** репозиторію -> **Actions** -> **General**\n> 2. Прокрутіть до розділу **Workflow permissions**\n> 3. Оберіть **"Read and write permissions"**\n> 4. Поставте галочку: ☑ **"Allow GitHub Actions to create and approve pull requests"**\n> 5. Натисніть **Save**! Після цього бот зможе самостійно відкривати PR без будь-яких ручних дій!`;
      }

      await postOrUpdateBotComment(issue.number, [
        `### [MeowProject Bot] Гілку створено, але створення Pull Request заблоковано GitHub ⚠️`,
        ``,
        `- **Проєкт:** **${name}** (\`${category}\`)`,
        `- **Гілка:** \`${branchName}\` (вже створена та завантажена в репозиторій)`,
        ``,
        `#### 🌐 Статус перевірки мов:`,
        `| Мова | Символи | Статус |`,
        `|:---|:---|:---|`,
        ...langTableRows,
        ``,
        `---`,
        errorNote
      ].join('\n'));
      return;
    }

    const prUrl = prRes.data?.html_url || `branch \`${branchName}\``;
    const prNumber = prRes.data?.number ? `#${prRes.data.number}` : '';

    await postOrUpdateBotComment(issue.number, [
      `### [MeowProject Bot] Project Submission Analyzed & Pull Request Created! 🎉`,
      ``,
      `Thank you for contributing **${name}** to MeowProject!`,
      ``,
      `- **Project:** **${name}** (\`${category}\`)`,
      `- **Country:** ${country}`,
      `- **Platforms:** ${platforms.join(', ')}`,
      `- **Pull Request:** ${prNumber} ([View Pull Request](${prUrl}))`,
      ``,
      `#### 🌐 Language Verification Breakdown:`,
      `| Language | Length | Status |`,
      `|:---|:---|:---|`,
      ...langTableRows,
      ``,
      `---`,
      `> 💡 **Next steps:** The Pull Request **${prNumber}** is open in the [Pull Requests](https://github.com/${GITHUB_REPOSITORY}/pulls) tab. Click **"Merge pull request"** to approve and publish to the live site!`
    ].join('\n'));

    appendSummary(`🎉 Pull Request created successfully: ${prUrl}`);
  } catch (err) {
    appendSummary(`❌ Failed creating PR: ${err.message}`);
  } finally {
    try {
      execSync('git checkout main');
    } catch (_) {}
  }
}

// -----------------------------------------------------------------------------
// D. MAIN DISPATCHER
// -----------------------------------------------------------------------------
async function handleIssues(eventPayload) {
  const issue = eventPayload.issue;
  if (!issue) return;

  const action = eventPayload.action;
  const title = (issue.title || '').trim();
  const lowerTitle = title.toLowerCase();

  appendSummary(`Processing issue #${issue.number} ("${title}") [action: ${action}]`);

  // Catalog projects are discussion threads, NOT new submissions!
  const projectsDir = path.resolve('Meow/projects');
  const catalogThreadNumbers = [1, 2, 3, 4, 5, 11, 12, 13, 14, 15];
  if (fs.existsSync(projectsDir)) {
    try {
      const dirs = fs.readdirSync(projectsDir);
      for (const d of dirs) {
        const pj = path.join(projectsDir, d, 'project.json');
        if (fs.existsSync(pj)) {
          const num = readJsonFile(pj).issueThreadNumber;
          if (num) catalogThreadNumbers.push(num);
        }
      }
    } catch (_) {}
  }
  if (catalogThreadNumbers.includes(issue.number)) {
    console.log(`Issue #${issue.number} is a catalog discussion thread. Skipping proposal processing.`);
    return;
  }

  // 1. Translation Contribution: [i18n: <slug>]
  const i18nMatch = lowerTitle.match(/^(?:\[i18n:\s*([a-z0-9_-]+)\]|translate:\s*([a-z0-9_-]+))/i);
  if (i18nMatch) {
    const slug = (i18nMatch[1] || i18nMatch[2]).toLowerCase().trim();
    const projectDir = path.resolve('Meow/projects', slug);

    if (!fs.existsSync(projectDir)) {
      await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Project Not Found\n\nCould not find a project with slug \`${slug}\` in \`Meow/projects/\`. Please verify the project slug.`);
      return;
    }

    const langRegex = /####\s+([A-Z]{2})\s*\n([\s\S]*?)(?=(?:####\s+[A-Z]{2}|$))/gi;
    let match;
    const submittedTranslations = {};
    while ((match = langRegex.exec(issue.body || '')) !== null) {
      const langCode = match[1].toLowerCase();
      const descText = match[2].trim();
      if (descText.length >= 20) {
        submittedTranslations[langCode] = descText;
      }
    }

    const detectedCodes = Object.keys(submittedTranslations);
    if (detectedCodes.length === 0) {
      await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Translation Template Needed\n\nPlease structure your description using language headers like:\n\n\`\`\`markdown\n#### EN\nYour English description here (at least 20 chars)...\n\n#### DE\nIhre deutsche Beschreibung hier...\n\`\`\``);
      return;
    }

    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: ['i18n', 'automated-pr'] })
    });

    if (action === 'opened' || action === 'edited') {
      const localesDir = path.join(projectDir, 'locales');
      if (!fs.existsSync(localesDir)) fs.mkdirSync(localesDir, { recursive: true });

      for (const [code, desc] of Object.entries(submittedTranslations)) {
        const filePath = path.join(localesDir, `${code}.json`);
        let existing = {
          tagline: '',
          description: desc,
          features: [],
          screenshotCaptions: []
        };
        if (fs.existsSync(filePath)) {
          try {
            const parsed = readJsonFile(filePath);
            existing = { ...existing, ...parsed, description: desc };
          } catch (_) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
      }

      const branchName = `i18n-${slug}-issue-${issue.number}`;
      configureBotGitAuthor();
      execSync(`git checkout -B ${branchName}`);
      execSync(`git add Meow/projects/${slug}/locales/`);
      execSync(`git commit -m "i18n: add/update ${detectedCodes.join(', ')} translation for ${slug} (#${issue.number})"`);
      execSync(`git push origin ${branchName} --force`);

      const prRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `i18n: ${slug} translations (${detectedCodes.join(', ')})`,
          head: branchName,
          base: 'main',
          body: `Automated PR generated from translation submission issue #${issue.number}.\n\nLanguages updated: \`${detectedCodes.join(', ')}\`\nCloses #${issue.number}`
        })
      });

      const prUrl = prRes.data ? prRes.data.html_url : `branch ${branchName}`;
      await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Automated PR Created!\n\nThank you for contributing translations for **${slug}**! 🎉\n\n- **Target Languages:** \`${detectedCodes.join(', ')}\`\n- **Pull Request:** ${prUrl}\n\nOnce reviewed and merged, the site will automatically update!`);

      execSync('git checkout main');
    }
    return;
  }

  // 2. Project Update / Enhancement Proposal: [update: <slug>]
  const updateMatch = lowerTitle.match(/^(?:\[update:\s*([a-z0-9_-]+)\]|update:\s*([a-z0-9_-]+))/i);
  if (updateMatch) {
    const slug = (updateMatch[1] || updateMatch[2]).toLowerCase().trim();
    const projectDir = path.resolve('Meow/projects', slug);

    if (!fs.existsSync(projectDir)) {
      await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Project Not Found ❌\n\nCould not find project with slug \`${slug}\` in the catalog. Please verify the slug in the title.`);
      return;
    }

    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: ['update', 'automated-pr'] })
    });

    if (action === 'opened' || action === 'edited') {
      const projectJsonPath = path.join(projectDir, 'project.json');
      const meta = readJsonFile(projectJsonPath);

      // Extract updated metadata fields
      const newName = extractSection(body, 'Project Name');
      if (newName) meta.name = newName;

      const newCat = extractSection(body, 'Category');
      if (newCat && ['launcher', 'modpack', 'mod', 'client', 'server', 'website', 'project'].includes(newCat.toLowerCase())) {
        meta.category = newCat.toLowerCase();
      }

      const newCountry = extractSection(body, 'Country');
      if (newCountry) meta.country = newCountry;

      const newLic = extractSection(body, 'License');
      if (newLic) meta.license = newLic;

      const newIsOpen = extractSection(body, 'Open Source');
      if (newIsOpen) {
        meta.isOpenSource = /yes|так|true|1/i.test(newIsOpen);
      }

      const newRepo = extractSection(body, 'Repository URL');
      if (newRepo && /^https?:\/\//i.test(newRepo)) {
        const host = newRepo.includes('gitlab.com') ? 'gitlab' :
                     newRepo.includes('gitee.com') ? 'gitee' :
                     newRepo.includes('gitcode.com') ? 'gitcode' :
                     newRepo.includes('cnb.cool') ? 'cnb' : 'github';
        meta.sourceLinks = [{ host, label: host.toUpperCase(), url: newRepo }];
        meta.isOpenSource = true;
      } else if (newRepo && /none|відсутній|немає|proprietary|closed/i.test(newRepo)) {
        meta.sourceLinks = [];
        meta.isOpenSource = false;
      }

      const newWebsite = extractSection(body, 'Website');
      if (newWebsite && /^https?:\/\//i.test(newWebsite)) meta.website = newWebsite;

      const newPlatforms = extractSection(body, 'Platforms');
      if (newPlatforms) {
        meta.platforms = newPlatforms.split(',').map(s => s.trim()).filter(Boolean);
      }

      const newTags = extractSection(body, 'Tags');
      if (newTags) {
        meta.tags = newTags.split(',').map(s => s.replace(/^#/, '').trim()).filter(Boolean);
      }

      const newIp = extractSection(body, 'Server IP');
      if (newIp) meta.serverIp = newIp;

      // Extract new screenshots if provided
      const newScreenshotsRaw = extractSection(body, 'Screenshots');
      const publicDir = path.resolve('public/projects', slug);
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

      if (newScreenshotsRaw) {
        const lines = newScreenshotsRaw.split('\n').map(s => s.replace(/^[-*]\s*/, '').trim()).filter(s => /^https?:\/\//i.test(s));
        let idx = (meta.screenshots || []).length + 1;
        for (const sUrl of lines) {
          const ext = sUrl.endsWith('.webp') ? '.webp' : '.png';
          const localPath = path.join(publicDir, `screen-${idx}${ext}`);
          const ok = await downloadImage(sUrl, localPath);
          if (ok) {
            if (!meta.screenshots) meta.screenshots = [];
            meta.screenshots.push(`/projects/${slug}/screen-${idx}${ext}`);
            idx++;
          }
        }
      }

      // Extract updated descriptions
      const descSection = extractSection(body, 'Description') || body;
      const langRegex = /(?:^|\n)####\s+([A-Za-z]{2})\s*\n([\s\S]*?)(?=\n####\s+[A-Za-z]{2}|$)/gi;
      let lMatch;
      const localesDir = path.join(projectDir, 'locales');
      while ((lMatch = langRegex.exec(descSection)) !== null) {
        let code = lMatch[1].toLowerCase();
        if (code === 'kz') code = 'kk';
        if (code === 'by') code = 'be';
        const text = lMatch[2].trim();
        if (text.length >= 20) {
          const locFile = path.join(localesDir, `${code}.json`);
          let loc = { tagline: meta.name, description: text, features: [], screenshotCaptions: [] };
          if (fs.existsSync(locFile)) {
            try { loc = { ...readJsonFile(locFile), description: text }; } catch (_) {}
          }
          fs.writeFileSync(locFile, JSON.stringify(loc, null, 2) + '\n', 'utf8');
        }
      }

      // Extract screenshot captions if provided
      const newCaptionsRaw = extractSection(body, 'Screenshot Captions');
      if (newCaptionsRaw) {
        const captionsList = newCaptionsRaw.split('\n').map(s => s.trim()).filter(Boolean);
        if (captionsList.length > 0) {
          for (const locCode of ['uk', 'en']) {
            const locFile = path.join(localesDir, `${locCode}.json`);
            if (fs.existsSync(locFile)) {
              try {
                const loc = readJsonFile(locFile);
                loc.screenshotCaptions = captionsList;
                fs.writeFileSync(locFile, JSON.stringify(loc, null, 2) + '\n', 'utf8');
              } catch (_) {}
            }
          }
        }
      }

      fs.writeFileSync(projectJsonPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

      // Create branch and PR
      const branchName = `update-${slug}-issue-${issue.number}`;
      configureBotGitAuthor();
      execSync(`git checkout -B ${branchName}`);
      execSync(`git add Meow/projects/${slug}/ public/projects/${slug}/`);
      execSync(`git commit -m "feat(catalog): propose updates for ${slug} (#${issue.number})"`);
      execSync(`git push origin ${branchName} --force`);

      const prRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `feat(catalog): update project ${slug} (#${issue.number})`,
          head: branchName,
          base: 'main',
          body: `Automated PR generated from project update proposal issue #${issue.number} for **${meta.name}**.\n\nCloses #${issue.number}`
        })
      });

      const prUrl = prRes.data ? prRes.data.html_url : `branch ${branchName}`;
      await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Automated Update PR Created!\n\nThank you for submitting updates for **${meta.name}**!\n\n- **Pull Request:** ${prUrl}\n\nThe repository administrator will review the changes before merging!`);
      execSync('git checkout main');
    }
    return;
  }

  // 2.5. Project Danger / Security Report: [report: <slug>]
  const reportMatch = lowerTitle.match(/^(?:\[report:\s*([a-z0-9_-]+)\]|report:\s*([a-z0-9_-]+))/i);
  if (reportMatch) {
    const slug = (reportMatch[1] || reportMatch[2]).toLowerCase().trim();
    const projectDir = path.resolve('Meow/projects', slug);

    if (!fs.existsSync(projectDir)) {
      await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Project Not Found\n\nCould not find project with slug \`${slug}\` in the catalog. Please verify the project slug.`);
      return;
    }

    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: ['danger-report', 'security', 'automated-pr'] })
    });

    if (action === 'opened' || action === 'edited') {
      const projectJsonPath = path.join(projectDir, 'project.json');
      const meta = readJsonFile(projectJsonPath);

      const summary = extractSection(body, 'Summary') || issue.title.replace(/^\[report:\s*[a-z0-9_-]+\]\s*/i, '').trim();
      const reasonType = extractSection(body, 'Reason Type') || 'Security / Reputation Warning';
      const evidenceMdRaw = extractSection(body, 'Evidence Markdown') || body;
      const evidenceMd = evidenceMdRaw.slice(0, 20000).trim();
      const evidenceLinksRaw = extractSection(body, 'Evidence Links') || '';
      const evidenceLinks = evidenceLinksRaw
        .split('\n')
        .map(s => s.replace(/^[-*]\s*/, '').trim())
        .filter(s => /^https?:\/\//i.test(s));

      meta.dangerReport = {
        summary,
        reasonType,
        reason: evidenceMd,
        evidenceLinks,
        reportedAt: new Date().toISOString().slice(0, 10),
        issueNumber: issue.number
      };

      fs.writeFileSync(projectJsonPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

      const branchName = `report-${slug}-issue-${issue.number}`;
      configureBotGitAuthor();
      execSync(`git checkout -B ${branchName}`);
      execSync(`git add Meow/projects/${slug}/project.json`);
      execSync(`git commit -m "security(catalog): add danger report for ${slug} (#${issue.number})"`);
      execSync(`git push origin ${branchName} --force`);

      const prRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `security(catalog): mark ${slug} as DANGEROUS (#${issue.number})`,
          head: branchName,
          base: 'main',
          body: `Automated Security/Danger Report PR from Issue #${issue.number} for **${meta.name}**.\n\n**Reason Type:** ${reasonType}\n**Summary:** ${summary}\n\nAdmin review is required before merging and displaying the DANGEROUS badge on the live site.\n\nCloses #${issue.number}`
        })
      });

      const prUrl = prRes.data ? prRes.data.html_url : `branch ${branchName}`;
      await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Security Report PR Created\n\nYour report for **${meta.name}** has been packaged into a Pull Request for administrator verification:\n\n- **Pull Request:** ${prUrl}\n\nOnce verified and merged by the administrator, the **DANGEROUS / НЕБЕЗПЕЧНИЙ** badge and full explanation will appear on the catalog.`);
      execSync('git checkout main');
    }
    return;
  }

  // 3. New Project Submission: prefix check
  const validPrefixes = ['launcher:', 'modpack:', 'mod:', 'client:', 'server:', 'website:', 'youtuber:', 'project:'];
  const matchedPrefix = validPrefixes.find(p => lowerTitle.startsWith(p));

  if (!matchedPrefix) {
    await postOrUpdateBotComment(issue.number, `### [MeowProject Bot] Title Format Verification Required\n\nPlease start the issue title with a valid project type prefix:\n- \`launcher: Name\`\n- \`modpack: Name\`\n- \`mod: Name\`\n- \`client: Name\`\n- \`server: Name\`\n- \`website: Name\`\n- \`youtuber: Name\`\n- \`project: Name\``);
    return;
  }

  const typeLabel = matchedPrefix.replace(':', '');
  await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels: [typeLabel, 'verified-submission', 'automated-pr'] })
  });

  // Only run proposal processing when opened or edited
  if (action === 'opened' || action === 'edited') {
    await handleProjectSubmission(issue, matchedPrefix);
  }
}

async function main() {
  console.log(`Starting MeowProject Bot (Event: ${GITHUB_EVENT_NAME}, Repo: ${GITHUB_REPOSITORY})`);

  let eventPayload = {};
  if (GITHUB_EVENT_PATH && fs.existsSync(GITHUB_EVENT_PATH)) {
    try {
      eventPayload = readJsonFile(GITHUB_EVENT_PATH);
    } catch (_) {}
  }

  if (GITHUB_EVENT_NAME === 'push' || GITHUB_EVENT_NAME === 'workflow_dispatch' || GITHUB_EVENT_NAME === 'schedule' || GITHUB_EVENT_NAME === 'discussion' || GITHUB_EVENT_NAME === 'discussion_comment') {
    await handlePushOrDispatch();
  } else if (GITHUB_EVENT_NAME === 'issue_comment') {
    await handleComment();
  } else if (GITHUB_EVENT_NAME === 'issues') {
    await handleIssues(eventPayload);
  } else {
    console.log(`Event ${GITHUB_EVENT_NAME} does not require action.`);
  }
}

main().catch(err => {
  appendSummary(`❌ Fatal error in bot execution: ${err.message}\n\`\`\`\n${err.stack}\n\`\`\``);
  process.exit(1);
});
