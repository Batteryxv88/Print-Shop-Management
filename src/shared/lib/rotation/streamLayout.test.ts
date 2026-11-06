import { describe, expect, it } from 'vitest';

import { streamLayout } from './streamLayout';

describe('streamLayout', () => {
    it('turns the label when W к ручью matches the height', () => {
        expect(streamLayout(25, 12, 12)).toEqual({ across: 12, along: 25 });
    });

    it('keeps the label when W к ручью matches the width', () => {
        expect(streamLayout(25, 12, 25)).toEqual({ across: 25, along: 12 });
    });

    it('does not swap a square or a circle', () => {
        expect(streamLayout(30, 30, 30)).toEqual({ across: 30, along: 30 });
    });

    it('uses the nominal sides when W к ручью is missing', () => {
        expect(streamLayout(25, 12, 0)).toEqual({ across: 25, along: 12 });
    });

    it('keeps the exact stream width when it is only close to one side', () => {
        expect(streamLayout(30, 20, 19)).toEqual({ across: 19, along: 30 });
    });
});
