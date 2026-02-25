import i18next from "i18next";
import * as plTranslations from "../../../src/locales/pl.json";

// Initialize i18next
await i18next.init({
    lng: "pl",
    fallbackLng: "pl",
    resources: {
        pl: {
            translation: plTranslations.translation
        }
    },
    interpolation: {
        escapeValue: false
    }
});

export const t = (key: string, options?: any) => i18next.t(key, options);
export default i18next;
