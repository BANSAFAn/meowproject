import { execSync } from 'node:child_process';
import fs from 'node:fs';
import nodePath from 'node:path';
import addedDatesJson from './added-dates.json';
import { LANG_CODES, type LangCode } from '../i18n/translations';

/**
 * Every catalog entry lives in its own folder:
 *
 *   src/projects/<slug>/project.json        – language-independent data
 *   src/projects/<slug>/locales/<lang>.json – tagline, description, features, screenshot captions
 *   public/projects/<slug>/                 – icon + screenshots
 *
 * Folders are discovered automatically, nothing has to be registered here.
 */

export type ProjectCategory = 'launcher' | 'client' | 'modpack' | 'mod' | 'server' | 'website' | 'youtuber' | 'project';
export const PREFIXES = ['launcher', 'modpack', 'mod', 'client', 'server', 'website', 'youtuber', 'project'] as const;
export type SourceHost = 'github' | 'gitlab' | 'gitea' | 'sourceforge' | 'gitee' | 'cnb';

export interface ProjectSourceLink {
  host: SourceHost;
  label: string;
  url: string;
}

export interface ProjectDangerReport {
  summary?: string;
  reasonType?: string;
  reason: string;
  evidenceLinks?: string[];
  reportedAt?: string;
  issueNumber?: number;
}

export interface ProjectMeta {
  slug: string;
  name: string;
  shortName: string;
  category: ProjectCategory;
  icon: string;
  /** ISO 3166-1 alpha-2 code (e.g. "CN", "US") or "GLOBAL" when there is no single country */
  country: string;
  developer: string;
  license: string;
  archived?: boolean;
  sponsor?: boolean;
  forkOf?: {
    name: string;
    slug?: string;
    url: string;
  };
  platforms: string[];
  website?: string;
  /** YouTuber-specific metadata */
  banner?: string | null;
  youtubeUrl?: string;
  youtubeChannelId?: string;
  latestVideos?: { id: string; title: string; published?: string }[];
  /** Server-specific metadata */
  serverIp?: string;
  serverOnline?: string;
  primaryLang?: string;
  licenseRequired?: boolean;
  /** Empty array = proprietary / closed source */
  sourceLinks: ProjectSourceLink[];
  issueThreadNumber: number;
  issueSearchTerm: string;
  tags: string[];
  screenshots: string[];
  order?: number;
  verified?: boolean;
  dangerReport?: ProjectDangerReport;
}

export interface ProjectLocale {
  tagline: string;
  description: string;
  features: string[];
  screenshotCaptions: string[];
}

export interface ProjectEntry extends ProjectMeta {
  isOpenSource: boolean;
  primaryLink: string;
  addedAt: number;
  locales: Record<LangCode, ProjectLocale>;
  availableLangs: LangCode[];
}

export const SITE_REPO = 'BANSAFAn/meowproject';
export const SITE_REPO_URL = `https://github.com/${SITE_REPO}`;

const metaFiles = import.meta.glob<ProjectMeta>('../projects/*/project.json', {
  eager: true,
  import: 'default',
});
const localeFiles = import.meta.glob<ProjectLocale>('../projects/*/locales/*.json', {
  eager: true,
  import: 'default',
});

function slugFromPath(path: string) {
  return path.split('/projects/')[1].split('/')[0];
}

function loadProjectAddedTimestamps(): Record<string, number> {
  const map: Record<string, number> = { ...(addedDatesJson as Record<string, number>) };
  try {
    const out = execSync(
      'git log --format="COMMIT:%ct" --diff-filter=A --name-only -- "Meow/projects/*/project.json"',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    let currentTs = 0;
    for (const rawLine of out.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('COMMIT:')) {
        currentTs = Number(line.slice(7)) || 0;
        continue;
      }
      const m = line.match(/^Meow\/projects\/([^/]+)\/project\.json$/);
      if (m && currentTs > 0 && !(m[1] in map)) {
        map[m[1]] = currentTs;
      }
    }
  } catch {
    // Fallback handled per-project via fs.statSync below
  }
  return map;
}

const PROJECT_ADDED_AT = loadProjectAddedTimestamps();

const DEFAULT_ORDER = ['xmcl', 'hmcl', 'atm9', 'sodium', 'lunarclient'];

export const PROJECTS: ProjectEntry[] = Object.entries(metaFiles)
  .map(([path, meta]) => {
    const slug = slugFromPath(path);
    const base = localeFiles[`../projects/${slug}/locales/uk.json`] ??
      localeFiles[`../projects/${slug}/locales/en.json`];
    if (!base) throw new Error(`Project "${slug}" has no locales/uk.json or locales/en.json`);

    const minDescLen = meta.category === 'youtuber' ? 1 : 20;
    const availableLangs: LangCode[] = LANG_CODES.filter((code) => {
      const loc = localeFiles[`../projects/${slug}/locales/${code}.json`];
      return Boolean(loc && loc.description && loc.description.trim().length >= minDescLen);
    });

    const enFallback = localeFiles[`../projects/${slug}/locales/en.json`] ?? base;
    const locales = Object.fromEntries(
      LANG_CODES.map((code) => {
        const loc = localeFiles[`../projects/${slug}/locales/${code}.json`];
        return [code, loc ?? (code === 'uk' ? base : enFallback)];
      }),
    ) as Record<LangCode, ProjectLocale>;

    let addedAt = PROJECT_ADDED_AT[slug] || 0;
    if (!addedAt) {
      try {
        const stat = fs.statSync(nodePath.resolve(process.cwd(), 'Meow', 'projects', slug, 'project.json'));
        addedAt = Math.floor(stat.mtimeMs / 1000);
      } catch {
        addedAt = 0;
      }
    }

    const sourceLinks = meta.sourceLinks ?? [];
    return {
      ...meta,
      slug,
      sourceLinks,
      isOpenSource: sourceLinks.length > 0,
      primaryLink: meta.website || sourceLinks[0]?.url || SITE_REPO_URL,
      addedAt,
      locales,
      availableLangs,
    } satisfies ProjectEntry;
  })
  .sort((a, b) => {
    const ao = a.order ?? (DEFAULT_ORDER.indexOf(a.slug) + 1 || 999);
    const bo = b.order ?? (DEFAULT_ORDER.indexOf(b.slug) + 1 || 999);
    return ao - bo || a.name.localeCompare(b.name);
  });
