import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import pl from './locales/pl.json';

// Detect if we are in a test environment
const isTest = typeof (globalThis as any).describe !== 'undefined' ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'test');

const resources = {
    en,
    pl
};

const savedLanguage = typeof window !== 'undefined' ? (localStorage.getItem('i18nextLng') || 'en') : 'en';
// Always default to English in tests to ensure consistent UI testing
const initialLanguage = isTest ? 'en' : savedLanguage;

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: initialLanguage,
        fallbackLng: "en",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
