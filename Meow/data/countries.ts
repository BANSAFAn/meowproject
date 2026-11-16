import { LANG_CODES, type LangCode } from '../i18n/translations';

/** ISO 3166-1 alpha-2 codes of all countries / territories */
export const ISO_COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

/** Regions that are accepted instead of a single country */
export const REGION_VALUES = ['Europa', 'USA', 'Asia', 'Africa', 'Global'];

const REGION_ALIASES = [
  'europa', 'europe', 'європа', 'европа', 'еўропа', 'eu',
  'usa', 'сша', 'зша', 'ақш',
  'asia', 'азія', 'азия', 'азія', 'азия', 'azja', 'asien',
  'africa', 'африка', 'afryka', 'afrika', 'афрыка',
  'global', 'глобальний', 'глабальны', 'globalny', 'international', 'міжнародний', 'жаһандық',
];

function displayNames(lang: string) {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' });
  } catch {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  }
}

/** Map non-ISO region names / aliases to UN M.49 numerical region codes or ISO codes for Intl.DisplayNames */
const REGION_TO_ISO_OR_UN: Record<string, string> = {
  europa: '150',
  europe: '150',
  європа: '150',
  европа: '150',
  еўропа: '150',
  eu: '150',
  asia: '142',
  азія: '142',
  азия: '142',
  azja: '142',
  asien: '142',
  africa: '002',
  африка: '002',
  afryka: '002',
  afrika: '002',
  афрыка: '002',
  usa: 'US',
  сша: 'US',
  зша: 'US',
  ақш: 'US',
  global: '001',
  світ: '001',
  мир: '001',
  world: '001',
};

/** Localized country name by ISO code / region (or the "Global" label) */
export function countryName(code: string, lang: LangCode, globalLabel: string) {
  if (!code || code.toUpperCase() === 'GLOBAL') return globalLabel;
  const lookup = REGION_TO_ISO_OR_UN[code.toLowerCase()] || code.toUpperCase();
  try {
    return displayNames(lang).of(lookup) ?? code;
  } catch {
    return code;
  }
}

/** Country names for the <datalist> in the current UI language */
export function countryOptions(lang: LangCode) {
  const dn = displayNames(lang);
  return ISO_COUNTRY_CODES.map((c) => {
    try {
      return dn.of(c) ?? c;
    } catch {
      return c;
    }
  }).sort((a, b) => a.localeCompare(b, lang));
}

/** Every accepted lowercase value: country names in all 6 languages, ISO codes and regions */
export function acceptedCountryValues() {
  const set = new Set<string>(REGION_ALIASES);
  for (const lang of [...LANG_CODES, 'ru']) {
    const dn = displayNames(lang);
    for (const c of ISO_COUNTRY_CODES) {
      set.add(c.toLowerCase());
      try {
        const name = dn.of(c);
        if (name) set.add(name.toLowerCase());
      } catch {}
    }
  }
  ['united states', 'america', 'uk', 'england', 'china', 'prc'].forEach((v) => set.add(v));
  return [...set];
}
