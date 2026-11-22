import uk from '../../nigagagagagagagagaga/uk.json';
import en from '../../nigagagagagagagagaga/en.json';
import de from '../../nigagagagagagagagaga/de.json';
import pl from '../../nigagagagagagagagaga/pl.json';
import be from '../../nigagagagagagagagaga/be.json';
import kk from '../../nigagagagagagagagaga/kk.json';
import cs from '../../nigagagagagagagagaga/cs.json';
import ro from '../../nigagagagagagagagaga/ro.json';
import mo from '../../nigagagagagagagagaga/mo.json';
import hu from '../../nigagagagagagagagaga/hu.json';
import fr from '../../nigagagagagagagagaga/fr.json';
import es from '../../nigagagagagagagagaga/es.json';
import tr from '../../nigagagagagagagagaga/tr.json';

export const LANGUAGES = {
  uk: { code: 'uk', label: 'Українська', short: 'UA', ogLocale: 'uk_UA' },
  en: { code: 'en', label: 'English', short: 'EN', ogLocale: 'en_US' },
  de: { code: 'de', label: 'Deutsch', short: 'DE', ogLocale: 'de_DE' },
  pl: { code: 'pl', label: 'Polski', short: 'PL', ogLocale: 'pl_PL' },
  be: { code: 'be', label: 'Беларуская', short: 'BY', ogLocale: 'be_BY' },
  kk: { code: 'kk', label: 'Қазақша', short: 'KZ', ogLocale: 'kk_KZ' },
  cs: { code: 'cs', label: 'Čeština', short: 'CS', ogLocale: 'cs_CZ' },
  ro: { code: 'ro', label: 'Română', short: 'RO', ogLocale: 'ro_RO' },
  mo: { code: 'mo', label: 'Moldovenească', short: 'MD', ogLocale: 'ro_MD' },
  hu: { code: 'hu', label: 'Magyar', short: 'HU', ogLocale: 'hu_HU' },
  fr: { code: 'fr', label: 'Français', short: 'FR', ogLocale: 'fr_FR' },
  es: { code: 'es', label: 'Español', short: 'ES', ogLocale: 'es_ES' },
  tr: { code: 'tr', label: 'Türkçe', short: 'TR', ogLocale: 'tr_TR' },
} as const;

export type LangCode = keyof typeof LANGUAGES;

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export const DEFAULT_LANG: LangCode = 'uk';

/**
 * UI strings live in `nigagagagagagagagaga/<lang>.json`.
 * The Ukrainian file is the reference: every key from it must exist in other locales.
 * Missing keys automatically fall back to Ukrainian.
 */
export type UITranslations = typeof uk;

const RAW: Record<LangCode, Partial<UITranslations>> = {
  uk,
  en,
  de,
  pl,
  be,
  kk,
  cs,
  ro,
  mo,
  hu,
  fr,
  es,
  tr,
};

export const UI_TRANSLATIONS = Object.fromEntries(
  LANG_CODES.map((code) => [code, { ...uk, ...RAW[code] } as UITranslations]),
) as Record<LangCode, UITranslations>;
