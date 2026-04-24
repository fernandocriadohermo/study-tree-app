import { describe, expect, it } from 'vitest';
import { isRectFullyVisibleWithinContainer } from './selectionVisibility';

describe('isRectFullyVisibleWithinContainer', () => {
    it('devuelve true cuando el rectángulo está cómodamente dentro del contenedor', () => {
        const container = {
            top: 0,
            right: 1000,
            bottom: 800,
            left: 0,
        };

        const rect = {
            top: 120,
            right: 420,
            bottom: 280,
            left: 180,
        };

        expect(isRectFullyVisibleWithinContainer(rect, container, 24)).toBe(true);
    });

    it('devuelve false cuando el rectángulo queda fuera o demasiado pegado al borde', () => {
        const container = {
            top: 0,
            right: 1000,
            bottom: 800,
            left: 0,
        };

        const rect = {
            top: 20,
            right: 420,
            bottom: 180,
            left: 10,
        };

        expect(isRectFullyVisibleWithinContainer(rect, container, 24)).toBe(false);
    });
});