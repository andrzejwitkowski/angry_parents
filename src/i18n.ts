import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Placeholder translations
const resources = {
    en: {
        translation: {
            "landing.title": "Co-Parenting Without the Drama",
            "landing.subtitle": "A secure and transparent platform for divorced parents to communicate for the sake of their children.",
            "landing.getStarted": "Get Started",
            "auth.login": "Login",
            "auth.register": "Register",
            "auth.email": "Email",
            "auth.username": "Username",
            "auth.password": "Password",
            "auth.submit": "Submit",
            "dashboard.welcome": "Hello World",
            "dashboard.logout": "Logout"
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "en",
        fallbackLng: "en",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
