import { describe, expect, it } from 'vitest';

import reducer, {
    loadAppSettings,
    saveStockModuleSettings,
} from './AppSettingsSlice';

describe('AppSettingsSlice', () => {
    it('loadAppSettings.fulfilled merges settings and marks loaded', () => {
        const state = reducer(
            undefined,
            loadAppSettings.fulfilled(
                {
                    counterReadingDay: 15,
                    paperStockEnabled: false,
                    laminationStockEnabled: true,
                    paperFormMode: 'roll',
                },
                '',
                undefined
            )
        );

        expect(state.loaded).toBe(true);
        expect(state.counterReadingDay).toBe(15);
        expect(state.paperStockEnabled).toBe(false);
        expect(state.paperFormMode).toBe('roll');
        expect(state.error).toBeNull();
    });

    it('saveStockModuleSettings toggles saving flag', () => {
        const pending = reducer(
            undefined,
            saveStockModuleSettings.pending('', { paperStockEnabled: false })
        );
        expect(pending.saving).toBe(true);

        const fulfilled = reducer(
            pending,
            saveStockModuleSettings.fulfilled(
                {
                    counterReadingDay: null,
                    paperStockEnabled: false,
                    laminationStockEnabled: true,
                    paperFormMode: 'both',
                },
                '',
                { paperStockEnabled: false }
            )
        );
        expect(fulfilled.saving).toBe(false);
        expect(fulfilled.paperStockEnabled).toBe(false);
    });

    it('loadAppSettings.rejected sets error and loaded', () => {
        const state = reducer(
            undefined,
            loadAppSettings.rejected(
                new Error('fail'),
                '',
                undefined,
                'fail'
            )
        );
        expect(state.loaded).toBe(true);
        expect(state.error).toBe('fail');
    });
});
