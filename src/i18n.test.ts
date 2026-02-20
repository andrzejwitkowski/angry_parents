import { expect, test, describe } from "bun:test";
import i18n from "./i18n";

describe("i18n configuration", () => {
    test("initializes with english as fallback language", () => {
        expect(i18n.language).toBe("en");
        expect(i18n.options.fallbackLng).toEqual(["en"]);
    });

    test("contains english translations", () => {
        const enWelcome = i18n.getResource("en", "translation", "landing.title");
        expect(enWelcome).toBe("Co-Parenting Without the Drama");
    });

    test("contains polish translations", () => {
        const plWelcome = i18n.getResource("pl", "translation", "landing.title");
        expect(plWelcome).toBe("Współrodzicielstwo bez Dramatów");
    });

    test("can switch to polish language", async () => {
        await i18n.changeLanguage("pl");
        expect(i18n.language).toBe("pl");
        const t = i18n.getFixedT("pl");
        expect(t("landing.title")).toBe("Współrodzicielstwo bez Dramatów");

        // Switch back to en for other tests
        await i18n.changeLanguage("en");
    });
});
