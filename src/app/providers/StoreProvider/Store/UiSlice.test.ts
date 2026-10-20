import { describe, expect, it } from 'vitest';

import reducer, { closeSidebar, openSidebar, toggleSidebar } from './UiSlice';

describe('UiSlice', () => {
    it('toggles sidebar open state', () => {
        let state = reducer(undefined, openSidebar());
        expect(state.sidebarOpen).toBe(true);

        state = reducer(state, closeSidebar());
        expect(state.sidebarOpen).toBe(false);

        state = reducer(state, toggleSidebar());
        expect(state.sidebarOpen).toBe(true);

        state = reducer(state, toggleSidebar());
        expect(state.sidebarOpen).toBe(false);
    });
});
