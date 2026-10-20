import { describe, expect, it } from 'vitest';

import reducer, { changePage } from './ChangePageSlice';

describe('ChangePageSlice', () => {
    it('changePage sets route key', () => {
        const state = reducer(undefined, changePage('stock'));
        expect(state.page).toBe('stock');
    });
});
