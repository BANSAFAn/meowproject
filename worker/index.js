/**
 * MeowLab Cloudflare Worker
 * ---------------------------------------------------------------------------
 * Serves the static Astro build (./dist) and adds a tiny API that lets people
 * leave a review with a 1-click Discord login (no GitHub/GitLab/Codeberg needed).
 *
 * Flow (no long-lived sessions are stored anywhere):
 *   1. POST /api/review/start   — the site sends {slug, score, text, back}.
 *      The draft is stored in a short-lived (10 min) HttpOnly cookie signed with
 *      HMAC-SHA256 (SESSION_SECRET), and the browser is sent to Discord OAuth.
 *   2. GET /api/auth/discord/callback — Discord returns ?code&state.
 *      The Worker verifies the signed cookie + one-time nonce (CSRF protection),
 *      asks Discord who the user is, checks the account age and posts/updates
 *      a single comment in the project's GitHub issue via GITHUB_BOT_TOKEN.
 *      The draft cookie is deleted immediately.
 *
 * Required secrets (Cloudflare → Workers → meowproject → Settings → Variables):
 *   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, GITHUB_BOT_TOKEN, SESSION_SECRET
 * Optional vars: GITHUB_REPOSITORY (default BANSAFAn/meowproject)
 *
 * Secrets are NEVER stored in this repository.
 */

const DRAFT_COOKIE = 'ml_review_draft';
const DRAFT_TTL_SEC = 600;
const MAX_TEXT = 1000;
const MIN_TEXT = 3;
const MIN_ACCOUNT_AGE_DAYS = 14;
const DISCORD_EPOCH = 1420070400000n;
const MARKER_PREFIX = 'meowlab-discord:';

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function b64urlEncode(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecodeToString(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(secret, data) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlEncode(sig);
}

async function verify(secret, data, signature) {
  const expected = await sign(secret, data);
  if (expected.length !== signature.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return b64urlEncode(arr);
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function safeBackPath(back) {
  if (typeof back !== 'string') return '/';
  if (!back.startsWith('/') || back.startsWith('//') || back.includes('\\')) return '/';
  return back.slice(0, 300);
}

function withResult(backPath, result, code) {
  const url = new URL(backPath, 'https://x.invalid');
  url.searchParams.set('mlreview', result);
  if (code) url.searchParams.set('mlcode', code);
  return url.pathname + url.search + '#reviews';
}

function redirect(location, clearCookie = false) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  if (clearCookie) {
    headers.append('Set-Cookie', `${DRAFT_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }
  return new Response(null, { status: 302, headers });
}

function sanitizeText(str, max) {
  return String(str || '')
    .replace(/\r\n?/g, '\n')
    // strip control chars except newline/tab
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // never allow fake markers / bot tags / HTML comments inside the review text
    .replace(/<!--|-->/g, '')
    .replace(/\[MeowProject Bot\]/gi, '')
    .replace(/meowlab-discord:/gi, '')
    .replace(/@(?=[A-Za-z0-9-])/g, '@\u200B') // don't ping GitHub users
    .trim()
    .slice(0, max);
}

function sanitizeName(str) {
  return String(str || '')
    .replace(/[<>`*_~|\[\]()#\\]/g, '')
    .replace(/--/g, '-')
    .trim()
    .slice(0, 40) || 'discord-user';
}

function reviewAuthor(env) {
  // GitHub login that owns GITHUB_BOT_TOKEN (defaults to the repository owner)
  return String(env.DISCORD_REVIEW_AUTHOR || (env.GITHUB_REPOSITORY || 'BANSAFAn/meowproject').split('/')[0]).toLowerCase();
}

function hasConfig(env) {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.GITHUB_BOT_TOKEN && env.SESSION_SECRET);
}

async function loadReviewsIndex(env, origin) {
  try {
    const res = await env.ASSETS.fetch(new Request(`${origin}/data/reviews.json`));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function githubApi(env, path, init = {}) {
  const repo = env.GITHUB_REPOSITORY || 'BANSAFAn/meowproject';
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_BOT_TOKEN}`,
      'User-Agent': 'MeowLab-Review-Worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// 1. Start: store a signed draft and redirect to Discord
// ---------------------------------------------------------------------------
async function handleStart(request, env, url) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  if (!hasConfig(env)) return json({ ok: false, error: 'not_configured' }, 503);

  // Same-origin only (prevents other sites from abusing the endpoint)
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ ok: false, error: 'origin' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  const slug = String(body.slug || '').toLowerCase();
  const score = Number(body.score);
  const text = sanitizeText(body.text, MAX_TEXT);
  const back = safeBackPath(body.back);

  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(slug)) return json({ ok: false, error: 'bad_slug' }, 400);
  if (!Number.isInteger(score) || score < 0 || score > 100) return json({ ok: false, error: 'bad_score' }, 400);
  if (text.length < MIN_TEXT) return json({ ok: false, error: 'text_short' }, 400);

  const index = await loadReviewsIndex(env, url.origin);
  const proj = index?.projects?.[slug];
  if (!proj || !proj.issueNumber) return json({ ok: false, error: 'no_issue' }, 404);

  const nonce = randomToken(18);
  const payload = b64urlEncode(JSON.stringify({
    s: slug,
    r: score,
    t: text,
    b: back,
    n: nonce,
    e: Date.now() + DRAFT_TTL_SEC * 1000,
  }));
  const cookieValue = `${payload}.${await sign(env.SESSION_SECRET, payload)}`;

  const authUrl = new URL('https://discord.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'identify');
  authUrl.searchParams.set('redirect_uri', `${url.origin}/api/auth/discord/callback`);
  authUrl.searchParams.set('state', nonce);
  authUrl.searchParams.set('prompt', 'none');

  return json({ ok: true, url: authUrl.toString() }, 200, {
    'Set-Cookie': `${DRAFT_COOKIE}=${cookieValue}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${DRAFT_TTL_SEC}`,
  });
}

// ---------------------------------------------------------------------------
// 2. Callback: verify, identify the Discord user, publish the review
// ---------------------------------------------------------------------------
async function handleCallback(request, env, url) {
  if (!hasConfig(env)) return redirect(withResult('/', 'error', 'not_configured'), true);

  const raw = getCookie(request, DRAFT_COOKIE);
  if (!raw || !raw.includes('.')) return redirect(withResult('/', 'error', 'expired'), true);

  const [payload, signature] = raw.split('.');
  if (!(await verify(env.SESSION_SECRET, payload, signature))) {
    return redirect(withResult('/', 'error', 'bad_signature'), true);
  }

  let draft;
  try {
    draft = JSON.parse(b64urlDecodeToString(payload));
  } catch {
    return redirect(withResult('/', 'error', 'expired'), true);
  }
  const back = safeBackPath(draft.b);

  if (!draft.e || Date.now() > draft.e) return redirect(withResult(back, 'error', 'expired'), true);

  const state = url.searchParams.get('state') || '';
  if (!state || state !== draft.n) return redirect(withResult(back, 'error', 'bad_state'), true);

  if (url.searchParams.get('error')) return redirect(withResult(back, 'error', 'cancelled'), true);
  const code = url.searchParams.get('code');
  if (!code) return redirect(withResult(back, 'error', 'cancelled'), true);

  // Exchange the code for an access token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${url.origin}/api/auth/discord/callback`,
    }),
  });
  if (!tokenRes.ok) return redirect(withResult(back, 'error', 'discord_token'), true);
  const token = await tokenRes.json();

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) return redirect(withResult(back, 'error', 'discord_user'), true);
  const user = await userRes.json();

  // Revoke the token right away — we only needed it once.
  try {
    await fetch('https://discord.com/api/oauth2/token/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        token: token.access_token,
      }),
    });
  } catch { /* not critical */ }

  if (!user?.id || !/^\d{15,22}$/.test(String(user.id))) return redirect(withResult(back, 'error', 'discord_user'), true);
  if (user.bot) return redirect(withResult(back, 'error', 'bot'), true);

  // Anti-spam: the account must be older than N days (creation date is encoded in the Discord ID)
  const createdAt = Number((BigInt(user.id) >> 22n) + DISCORD_EPOCH);
  if (Date.now() - createdAt < MIN_ACCOUNT_AGE_DAYS * 86400000) {
    return redirect(withResult(back, 'error', 'account_young'), true);
  }

  const index = await loadReviewsIndex(env, url.origin);
  const issueNumber = index?.projects?.[draft.s]?.issueNumber;
  if (!issueNumber) return redirect(withResult(back, 'error', 'no_issue'), true);

  const name = sanitizeName(user.global_name || user.username);
  const meta = {
    id: String(user.id),
    name,
    avatar: typeof user.avatar === 'string' && /^(a_)?[0-9a-f]{32}$/.test(user.avatar) ? user.avatar : '',
  };
  const marker = `<!-- ${MARKER_PREFIX}${b64urlEncode(JSON.stringify(meta))} -->`;
  const text = sanitizeText(draft.t, MAX_TEXT);
  const score = Math.max(0, Math.min(100, Math.round(Number(draft.r) || 0)));
  const commentBody = `${marker}\n[rating](${score})\n\n${text}\n\n— via MeowLab · Discord: ${name}`;

  // One Discord account = one review per project: update the existing comment if present
  let existingId = null;
  for (let page = 1; page <= 5 && !existingId; page++) {
    const list = await githubApi(env, `/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!list.ok || !Array.isArray(list.data)) break;
    for (const c of list.data) {
      // Only trust markers inside comments written by the review bot account itself
      if (String(c.user?.login || '').toLowerCase() !== reviewAuthor(env)) continue;
      const m = String(c.body || '').match(/<!--\s*meowlab-discord:([A-Za-z0-9_-]+)\s*-->/);
      if (!m) continue;
      try {
        const parsed = JSON.parse(b64urlDecodeToString(m[1]));
        if (parsed?.id === meta.id) { existingId = c.id; break; }
      } catch { /* ignore */ }
    }
    if (list.data.length < 100) break;
  }

  const result = existingId
    ? await githubApi(env, `/issues/comments/${existingId}`, { method: 'PATCH', body: JSON.stringify({ body: commentBody }) })
    : await githubApi(env, `/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: commentBody }) });

  if (!result.ok) return redirect(withResult(back, 'error', 'github'), true);
  return redirect(withResult(back, existingId ? 'updated' : 'ok'), true);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/review/start') {
      try { return await handleStart(request, env, url); }
      catch { return json({ ok: false, error: 'internal' }, 500); }
    }
    if (url.pathname === '/api/auth/discord/callback') {
      try { return await handleCallback(request, env, url); }
      catch { return redirect(withResult('/', 'error', 'internal'), true); }
    }
    if (url.pathname === '/api/review/status') {
      return json({ ok: true, enabled: hasConfig(env) });
    }
    if (url.pathname.startsWith('/api/')) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
