import fs from 'node:fs';
import path from 'node:path';

const PROJECTS_DIR = path.resolve(process.cwd(), 'Meow', 'projects');
const YT_FILE = path.resolve(process.cwd(), 'public', 'data', 'youtubers.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+667',
};

function decodeXml(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchChannelLiveAndSubs(channelId) {
  let subscribers = null;
  let isLive = false;
  let liveVideoId = null;
  let liveTitle = null;

  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}`, { headers: HEADERS });
    if (res.ok) {
      const html = await res.text();
      const subMatch =
        html.match(/"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/) ||
        html.match(/"metadataParts"\s*:\s*\[[^\]]*?"content"\s*:\s*"([^"]*?subscribers?)"/i) ||
        html.match(/"content"\s*:\s*"([\d.,]+\s*[KMB]?\s*subscribers?)"/i);
      if (subMatch && subMatch[1]) {
        subscribers = subMatch[1].replace(/\s*subscribers?\s*/i, '').trim();
      }
    }
  } catch (_) {}

  try {
    const resLive = await fetch(`https://www.youtube.com/channel/${channelId}/live`, { headers: HEADERS });
    if (resLive.ok) {
      const liveHtml = await resLive.text();
      const liveNow =
        /"isLiveNow"\s*:\s*true/.test(liveHtml) ||
        /"liveBroadcastDetails"\s*:\s*\{[^}]*"isLiveNow"\s*:\s*true/.test(liveHtml);
      if (liveNow) {
        isLive = true;
        liveVideoId =
          liveHtml.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/)?.[1] ||
          liveHtml.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/)?.[1] ||
          null;
        const ogTitle = liveHtml.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
        liveTitle = ogTitle ? decodeXml(ogTitle).trim() : null;
      }
    }
  } catch (_) {}

  return { subscribers, isLive, liveVideoId, liveTitle };
}

async function fetchLatestVideos(channelId) {
  const uulf = 'UULF' + channelId.slice(2);
  try {
    let res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${uulf}`);
    if (!res.ok) res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    if (!res.ok) return [];
    const rss = await res.text();
    return [...rss.matchAll(/<entry>[\s\S]*?<yt:videoId>([^<]+)<\/yt:videoId>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<published>([^<]+)<\/published>[\s\S]*?<\/entry>/g)]
      .slice(0, 3)
      .map((m) => ({ id: m[1], title: decodeXml(m[2]), published: m[3].slice(0, 10) }));
  } catch (_) {
    return [];
  }
}

async function main() {
  let ytData = { updatedAt: new Date().toISOString(), channels: {} };
  if (fs.existsSync(YT_FILE)) {
    try {
      ytData = JSON.parse(fs.readFileSync(YT_FILE, 'utf8'));
    } catch (_) {}
  }
  if (!ytData.channels) ytData.channels = {};

  const slugs = fs.readdirSync(PROJECTS_DIR).filter((d) =>
    fs.existsSync(path.join(PROJECTS_DIR, d, 'project.json'))
  );

  let changed = false;

  for (const slug of slugs) {
    const metaPath = path.join(PROJECTS_DIR, slug, 'project.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.category !== 'youtuber' || !meta.youtubeChannelId || !meta.youtubeChannelId.startsWith('UC')) continue;

    const prev = ytData.channels[slug] || {};
    const [liveInfo, vids] = await Promise.all([
      fetchChannelLiveAndSubs(meta.youtubeChannelId),
      fetchLatestVideos(meta.youtubeChannelId),
    ]);

    const nextEntry = {
      youtubeChannelId: meta.youtubeChannelId,
      banner: meta.banner || prev.banner || null,
      subscribers: liveInfo.subscribers || prev.subscribers || null,
      isLive: Boolean(liveInfo.isLive),
      liveVideoId: liveInfo.isLive ? liveInfo.liveVideoId : null,
      liveTitle: liveInfo.isLive ? liveInfo.liveTitle : null,
      latestVideos: vids.length > 0 ? vids : (prev.latestVideos || meta.latestVideos || []),
    };

    if (JSON.stringify(prev) !== JSON.stringify(nextEntry)) {
      ytData.channels[slug] = nextEntry;
      changed = true;
    }

    // Keep project.json latestVideos synced if changed
    if (vids.length > 0) {
      const prevIds = (meta.latestVideos || []).map((v) => v.id).join(',');
      const nextIds = vids.map((v) => v.id).join(',');
      if (prevIds !== nextIds) {
        meta.latestVideos = vids;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      }
    }

    console.log(`${slug}: subs=${nextEntry.subscribers || '?'} | live=${nextEntry.isLive} | vids=${nextEntry.latestVideos.length}`);
  }

  if (changed) {
    ytData.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(YT_FILE), { recursive: true });
    fs.writeFileSync(YT_FILE, JSON.stringify(ytData, null, 2) + '\n', 'utf8');
    console.log('Updated public/data/youtubers.json');
  } else {
    console.log('No changes in YouTubers live data.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
