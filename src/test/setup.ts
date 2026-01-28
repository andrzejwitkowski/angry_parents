import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
    cleanup();
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
    // @ts-ignore
    globalThis.PointerEvent = PointerEventMock;
}
