/**
 * Internationalization (i18n) system for HealthBridge.
 * All user-facing strings go through this module.
 *
 * To add a new language:
 * 1. Create a new file in this directory (e.g., hi.ts for Hindi)
 * 2. Export the same structure as en.ts
 * 3. Add the language to SUPPORTED_LANGUAGES
 *
 * Components never have hardcoded strings — always use t('key').
 */

import { en } from './en'

export type Language = 'en' | 'hi' | 'ta' | 'te' | 'bn'

export const SUPPORTED_LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
]

type TranslationStrings = typeof en

const translations: Record<Language, TranslationStrings> = {
  en,
  // Other languages fall back to English until translation files are added
  hi: en,
  ta: en,
  te: en,
  bn: en,
}

/**
 * Get a translation function for the given language.
 *
 * @example
 * const t = getTranslations('en')
 * t.common.loading // "Loading..."
 * t.patient.home.greeting // "Good morning"
 */
export function getTranslations(lang: Language = 'en'): TranslationStrings {
  return translations[lang] || translations.en
}

/**
 * Nested key accessor for dot-notation access.
 * Useful for dynamic key lookup.
 *
 * @example
 * t('patient.home.greeting', 'en') // "Good morning"
 */
export function t(key: string, lang: Language = 'en'): string {
  const strings = getTranslations(lang)
  const keys = key.split('.')
  let result: unknown = strings

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = (result as Record<string, unknown>)[k]
    } else {
      return key // Return the key itself as fallback
    }
  }

  return typeof result === 'string' ? result : key
}
