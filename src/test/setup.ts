import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { clearMocks } from '@tauri-apps/api/mocks';
import { afterEach, beforeAll } from 'vitest';

class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}

beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
        writable: true,
        configurable: true,
        value: ResizeObserverMock,
    });
});

afterEach(() => {
    cleanup();
    clearMocks();
});