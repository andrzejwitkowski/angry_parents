import { JSDOM } from 'jsdom';
import { jest } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = globalThis as any;

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost',
});

globalAny.document = dom.window.document;
globalAny.window = dom.window;
globalAny.navigator = dom.window.navigator;

globalAny.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0);
globalAny.cancelAnimationFrame = (id: number) => clearTimeout(id);

// Mock fetch
globalAny.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve([]),
        ok: true,
        status: 200,
        headers: new Headers(),
    })
);

globalAny.getComputedStyle = dom.window.getComputedStyle;
globalAny.MutationObserver = dom.window.MutationObserver;
globalAny.TextEncoder = dom.window.TextEncoder;
globalAny.TextDecoder = dom.window.TextDecoder;
globalAny.Event = dom.window.Event;
globalAny.CustomEvent = dom.window.CustomEvent;
globalAny.NodeFilter = dom.window.NodeFilter;
globalAny.HTMLInputElement = dom.window.HTMLInputElement;
globalAny.HTMLElement = dom.window.HTMLElement;
globalAny.Element = dom.window.Element;
globalAny.Node = dom.window.Node;
globalAny.localStorage = dom.window.localStorage;
globalAny.sessionStorage = dom.window.sessionStorage;


// Polyfill crypto - Force overwrite to ensure full WebCrypto (subtle) support
Object.defineProperty(globalAny.window, 'crypto', {
    value: globalAny.crypto,
    writable: true,
    configurable: true,
});
