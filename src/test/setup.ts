import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import pl from '../locales/pl.json';

expect.extend(matchers);

afterEach(() => {
    cleanup();
});

// Initialize i18n for tests
i18n
    .use(initReactI18next)
    .init({
        resources: {
            en,
            pl
        },
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

// Radix/shadcn mocks
class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}

globalThis.ResizeObserver = ResizeObserverMock;

// Mock PointerEvent for Radix
if (!globalThis.PointerEvent) {
    class PointerEventMock extends MouseEvent {
        constructor(type: string, params: PointerEventInit = {}) {
            super(type, params);
        }
    }
    // @ts-expect-error - mock property not on window type
    globalThis.PointerEvent = PointerEventMock;
}

