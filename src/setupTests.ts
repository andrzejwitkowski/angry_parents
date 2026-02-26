import { mock, jest, afterEach, expect, beforeEach } from 'bun:test';

// Mock Polish translations to prevent leakage into English tests
// Must be at the very top before any imports that use i18n
mock.module("./locales/pl.json", () => ({
    translation: {}
}));

import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import i18n from './i18n';

expect.extend(matchers);

import en from './locales/en.json';

beforeEach(async () => {
    // Clear localStorage to prevent cross-test leakage (e.g. i18nextLng)
    localStorage.clear();

    // Forcefully re-initialize/reset the i18n instance for every test
    // This is the only way to be 100% sure the singleton is clean
    await i18n.init({
        resources: {
            en,
            pl: { translation: {} } // Use empty mock for pl
        },
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

    // Ensure it's definitely 'en'
    if (i18n.language !== 'en') {
        await i18n.changeLanguage('en');
    }
});

afterEach(() => {
    cleanup();
    jest.clearAllMocks();
});



