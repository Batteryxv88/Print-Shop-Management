import { describe, expect, it } from 'vitest';

import reducer, {
    requestAnalyticsExport,
    requestAnalyticsRefresh,
    setAnalyticsFrom,
    setAnalyticsTo,
} from './AnalyticsFilterSlice';

describe('AnalyticsFilterSlice', () => {
    it('updates date range', () => {
        let state = reducer(undefined, setAnalyticsFrom('2024-01-01'));
        state = reducer(state, setAnalyticsTo('2024-01-31'));

        expect(state.from).toBe('2024-01-01');
        expect(state.to).toBe('2024-01-31');
    });

    it('increments refresh and export nonces', () => {
        let state = reducer(undefined, { type: '@@init' });
        const refresh0 = state.refreshNonce;
        const export0 = state.exportNonce;

        state = reducer(state, requestAnalyticsRefresh());
        state = reducer(state, requestAnalyticsExport());

        expect(state.refreshNonce).toBe(refresh0 + 1);
        expect(state.exportNonce).toBe(export0 + 1);
    });
});
