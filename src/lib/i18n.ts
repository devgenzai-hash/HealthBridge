/**
 * Internationalization (i18n) module.
 * MVP: English fully implemented, other languages stubbed for v2.
 */

export interface Language {
  code: string
  name: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
]

export const DEFAULT_LANGUAGE = 'en'

/** Get translated string. Falls back to English in MVP. */
export function t(key: string, _lang: string = DEFAULT_LANGUAGE): string {
  return STRINGS_EN[key] || key
}

const STRINGS_EN: Record<string, string> = {
  'app.name': 'HealthBridge',
  'nav.home': 'Home',
  'nav.reports': 'Reports',
  'nav.appointments': 'Appointments',
  'nav.profile': 'Profile',
  'auth.login': 'Log In',
  'auth.register': 'Register',
  'auth.sendOtp': 'Send OTP',
  'auth.verifyOtp': 'Verify OTP',
  'common.loading': 'Loading...',
  'common.error': 'Something went wrong',
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
}
