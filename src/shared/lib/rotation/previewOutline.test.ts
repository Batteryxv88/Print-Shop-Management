import { describe, expect, it } from 'vitest';

import { previewBorderRadius, previewOutline } from './previewOutline';

describe('previewOutline', () => {
    it('uses a circle when a round label has equal sides', () => {
        expect(previewOutline('круг', 30, 30)).toBe('circle');
        expect(previewOutline('овал', 35, 35)).toBe('circle');
    });

    it('uses an ellipse when a round label has different sides', () => {
        expect(previewOutline('овал', 30, 20)).toBe('ellipse');
        expect(previewOutline('Круг', 40, 28)).toBe('ellipse');
    });

    it('uses a square or a rectangle from the side sizes', () => {
        expect(previewOutline('квадрат', 23, 23)).toBe('square');
        expect(previewOutline('прямоугольник', 23, 23)).toBe('square');
        expect(previewOutline('квадрат', 12, 25)).toBe('rectangle');
        expect(previewOutline('прямоугольник', 12, 65)).toBe('rectangle');
    });

    it('uses one figured outline for every custom label', () => {
        expect(previewOutline('фигурная', 40, 18)).toBe('figured');
        expect(previewOutline('Фигурная (РЫБКА)', 30, 30)).toBe('figured');
    });

    it('rounds only circle and ellipse', () => {
        expect(previewBorderRadius('circle')).toBe('50%');
        expect(previewBorderRadius('ellipse')).toBe('50%');
        expect(previewBorderRadius('square')).toBe('3px');
        expect(previewBorderRadius('rectangle')).toBe('3px');
        expect(previewBorderRadius('figured')).toBe('0');
    });
});