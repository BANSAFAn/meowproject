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

export type ProjectCategory = 'launcher' | 'client' | 'modpack' | 'mod' | 'service' | 'website' | 'project';
export type SourceHost = 'github' | 'gitlab' | 'gitea' | 'sourceforge' | 'gitee' | 'cnb';

export interface ProjectSourceLink {
  host: SourceHost;
  label: string;
  url: string;
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
  platforms: string[];
  website?: string;
  /** Empty array = proprietary / closed source */
  sourceLinks: ProjectSourceLink[];
  issueThreadNumber: number;
  issueSearchTerm: string;
  tags: string[];
  screenshots: string[];
  order?: number;
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

const DEFAULT_ORDER = ['xmcl', 'hmcl', 'atm9', 'sodium', 'lunarclient'];

export const PROJECTS: ProjectEntry[] = Object.entries(metaFiles)
  .map(([path, meta]) => {
    const slug = slugFromPath(path);
    const base = localeFiles[`../projects/${slug}/locales/uk.json`] ??
      localeFiles[`../projects/${slug}/locales/en.json`];
    if (!base) throw new Error(`Project "${slug}" has no locales/uk.json or locales/en.json`);

    const availableLangs: LangCode[] = LANG_CODES.filter((code) => {
      const loc = localeFiles[`../projects/${slug}/locales/${code}.json`];
      return Boolean(loc && loc.description && loc.description.trim().length >= 20);
    });

    const locales = Object.fromEntries(
      LANG_CODES.map((code) => {
        const loc = localeFiles[`../projects/${slug}/locales/${code}.json`];
        return [code, loc ?? base];
      }),
    ) as Record<LangCode, ProjectLocale>;

    const sourceLinks = meta.sourceLinks ?? [];
    return {
      ...meta,
      slug,
      sourceLinks,
      isOpenSource: sourceLinks.length > 0,
      primaryLink: meta.website || sourceLinks[0]?.url || SITE_REPO_URL,
      locales,
      availableLangs,
    } satisfies ProjectEntry;
  })
  .sort((a, b) => {
    const ao = a.order ?? (DEFAULT_ORDER.indexOf(a.slug) + 1 || 999);
    const bo = b.order ?? (DEFAULT_ORDER.indexOf(b.slug) + 1 || 999);
    return ao - bo || a.name.localeCompare(b.name);
  });
