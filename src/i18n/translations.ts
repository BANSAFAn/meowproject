import uk from './locales/uk.json';
import en from './locales/en.json';
import de from './locales/de.json';
import pl from './locales/pl.json';
import be from './locales/be.json';
import kk from './locales/kk.json';

export const LANGUAGES = {
  uk: { code: 'uk', label: 'Українська', short: 'UA', ogLocale: 'uk_UA' },
  en: { code: 'en', label: 'English', short: 'EN', ogLocale: 'en_US' },
  de: { code: 'de', label: 'Deutsch', short: 'DE', ogLocale: 'de_DE' },
  pl: { code: 'pl', label: 'Polski', short: 'PL', ogLocale: 'pl_PL' },
  be: { code: 'be', label: 'Беларуская', short: 'BY', ogLocale: 'be_BY' },
  kk: { code: 'kk', label: 'Қазақша', short: 'KZ', ogLocale: 'kk_KZ' },
} as const;

export type LangCode = keyof typeof LANGUAGES;

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export const DEFAULT_LANG: LangCode = 'uk';

/**
 * UI strings live in `src/i18n/locales/<lang>.json`.
 * The Ukrainian file is the reference: every key from it must exist in other locales.
 * Missing keys automatically fall back to Ukrainian.
 */
export type UITranslations = typeof uk;

const RAW: Record<LangCode, Partial<UITranslations>> = { uk, en, de, pl, be, kk };

export const UI_TRANSLATIONS = Object.fromEntries(
  LANG_CODES.map((code) => [code, { ...uk, ...RAW[code] } as UITranslations]),
) as Record<LangCode, UITranslations>;
