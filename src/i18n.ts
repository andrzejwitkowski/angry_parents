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
            "dashboard.logout": "Logout",
            "common.confirmDelete": "Are you sure you want to delete this item?",
            "meds.confirmDelete": "Are you sure you want to delete this medication?",
            "note.confirmDelete": "Are you sure you want to delete this note?",
            "attachment.confirmDelete": "Are you sure you want to delete this attachment?",
            "medical.confirmDelete": "Are you sure you want to delete this medical visit?",
            "handover.confirmDelete": "Are you sure you want to delete this handover?",
            "incident.confirmDelete": "Are you sure you want to delete this incident?",
            "vacation.confirmDelete": "Are you sure you want to delete this vacation?"
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
