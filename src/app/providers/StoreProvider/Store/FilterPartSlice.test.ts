import { describe, expect, it } from 'vitest';

import reducer, { changeFilter } from './FilterPartSlice';

describe('FilterPartSlice', () => {
    it('starts with section All', () => {
        const state = reducer(undefined, { type: '@@init' });
        expect(state.filter.section).toBe('All');
    });

    it('changeFilter updates section', () => {
        const state = reducer(undefined, changeFilter('Feed'));
        expect(state.filter.section).toBe('Feed');
    });
});
