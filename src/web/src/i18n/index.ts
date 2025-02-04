import i18next from 'i18next'; // ^23.0.0
import { initReactI18next } from 'react-i18next'; // ^13.0.0
import i18nextBrowserLanguageDetector from 'i18next-browser-languagedetector'; // ^7.0.0
import i18nextHttpBackend from 'i18next-http-backend'; // ^2.0.0

// Global constants for i18n configuration
const DEFAULT_LANGUAGE = 'en';
const FALLBACK_LANGUAGE = 'en';
const RTL_LANGUAGES = ['ar', 'he'];
const TRANSLATION_VERSION = '1.0.0';

// Supported languages with display names and RTL settings
export const supportedLanguages = {
  en: 'English',
  es: 'Español',
  fr: 'Français'
} as const;

// Initialize i18next with enhanced configuration
const initializeI18n = async (): Promise<void> => {
  await i18next
    .use(initReactI18next)
    .use(i18nextBrowserLanguageDetector)
    .use(i18nextHttpBackend)
    .init({
      // Core configuration
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: Object.keys(supportedLanguages),
      defaultNS: 'common',
      
      // Enhanced loading configuration
      backend: {
        loadPath: `/locales/{{lng}}/{{ns}}.json?v=${TRANSLATION_VERSION}`,
        allowMultiLoading: false,
        queryStringParams: { v: TRANSLATION_VERSION },
        crossDomain: true,
      },
      
      // Language detection configuration
      detection: {
        order: ['querystring', 'localStorage', 'navigator'],
        lookupQuerystring: 'lng',
        lookupLocalStorage: 'i18nextLng',
        caches: ['localStorage'],
      },
      
      // Interpolation and formatting
      interpolation: {
        escapeValue: false,
        format: (value, format, lng) => {
          if (format === 'date') {
            return new Intl.DateTimeFormat(lng).format(value);
          }
          if (format === 'number') {
            return new Intl.NumberFormat(lng).format(value);
          }
          return value;
        },
      },
      
      // Accessibility enhancements
      react: {
        useSuspense: true,
        bindI18nStore: 'added removed',
        transEmptyNodeValue: 'empty',
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em'],
      },
      
      // Debug and validation settings
      debug: process.env.NODE_ENV === 'development',
      saveMissing: process.env.NODE_ENV === 'development',
      missingKeyHandler: (lng, ns, key) => {
        console.warn(`Missing translation key: ${key} for language: ${lng} in namespace: ${ns}`);
      },
    });
};

// Enhanced language change handler
const changeLanguage = async (language: string): Promise<void> => {
  if (!Object.keys(supportedLanguages).includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  try {
    await i18next.changeLanguage(language);
    
    // Update document attributes
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
    
    // Update meta tags
    const htmlMeta = document.querySelector('meta[property="og:locale"]');
    if (htmlMeta) {
      htmlMeta.setAttribute('content', language);
    }
    
    // Store preference
    localStorage.setItem('i18nextLng', language);
    
    // Announce language change for screen readers
    const announcement = document.getElementById('language-announcement');
    if (announcement) {
      announcement.textContent = i18next.t('language.changed', { lng: language });
    }
    
    // Emit custom event for components
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language } }));
    
  } catch (error) {
    console.error('Failed to change language:', error);
    throw error;
  }
};

// Initialize i18n on module load
initializeI18n().catch(error => {
  console.error('Failed to initialize i18n:', error);
});

// Export configured i18n instance with enhanced features
export const i18n = {
  t: i18next.t.bind(i18next),
  changeLanguage,
  dir: (lng?: string) => RTL_LANGUAGES.includes(lng || i18next.language) ? 'rtl' : 'ltr',
  format: {
    date: (value: Date, lng?: string) => new Intl.DateTimeFormat(lng || i18next.language).format(value),
    number: (value: number, lng?: string) => new Intl.NumberFormat(lng || i18next.language).format(value),
  },
};

export default i18next;