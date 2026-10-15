import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getAuth } from 'firebase/auth';
import { saveAppSettings } from '../../../../services/appSettings';
import { loadAppSettings } from './AppSettingsSlice';
import {
    CounterReadingPrinterEntry,
    CounterReadingSaveMode,
    fetchLastCounterReading,
    markCounterReadingDone,
} from '../../../../services/counterReadings';
import {
    getActivePeriodKey,
    isCounterReadingDoneForPeriod,
} from '../../../../shared/lib/utils/counterReading';

export type CounterReadingState = {
    counterReadingDay: number | null;
    lastPeriodKey: string | null;
    settingsLoaded: boolean;
    readingLoaded: boolean;
    showReminder: boolean;
    saving: boolean;
    error: string | null;
};

const initialState: CounterReadingState = {
    counterReadingDay: null,
    lastPeriodKey: null,
    settingsLoaded: false,
    readingLoaded: false,
    showReminder: false,
    saving: false,
    error: null,
};

const recomputeShow = (state: CounterReadingState) => {
    const active = getActivePeriodKey(state.counterReadingDay);
    const done = isCounterReadingDoneForPeriod(state.lastPeriodKey, active);
    state.showReminder = Boolean(active && !done);
};

export const saveCounterReadingDay = createAsyncThunk(
    'counterReading/saveDay',
    async (day: number | null) =>
        saveAppSettings({ counterReadingDay: day })
);

export const loadLastCounterReading = createAsyncThunk(
    'counterReading/loadLast',
    async () => fetchLastCounterReading()
);

export const completeCounterReading = createAsyncThunk(
    'counterReading/complete',
    async (input: {
        periodKey: string;
        mode: CounterReadingSaveMode;
        printers: CounterReadingPrinterEntry[];
    }) => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) throw new Error('Нужна авторизация');
        return markCounterReadingDone({
            periodKey: input.periodKey,
            mode: input.mode,
            printers: input.printers,
            userId: user.uid,
            userName: user.displayName || user.email || 'user',
        });
    }
);

const counterReadingSlice = createSlice({
    name: 'counterReading',
    initialState,
    reducers: {
        clearCounterReadingError(state) {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadAppSettings.fulfilled, (state, action) => {
                state.counterReadingDay = action.payload.counterReadingDay;
                state.settingsLoaded = true;
                state.error = null;
                recomputeShow(state);
            })
            .addCase(loadAppSettings.rejected, (state, action) => {
                state.settingsLoaded = true;
                state.error = action.error.message || 'Ошибка настроек';
            })
            .addCase(saveCounterReadingDay.pending, (state) => {
                state.saving = true;
                state.error = null;
            })
            .addCase(saveCounterReadingDay.fulfilled, (state, action) => {
                state.saving = false;
                state.counterReadingDay = action.payload.counterReadingDay;
                recomputeShow(state);
            })
            .addCase(saveCounterReadingDay.rejected, (state, action) => {
                state.saving = false;
                state.error = action.error.message || 'Не удалось сохранить';
            })
            .addCase(loadLastCounterReading.fulfilled, (state, action) => {
                state.lastPeriodKey = action.payload?.periodKey || null;
                state.readingLoaded = true;
                recomputeShow(state);
            })
            .addCase(loadLastCounterReading.rejected, (state) => {
                state.readingLoaded = true;
                recomputeShow(state);
            })
            .addCase(completeCounterReading.pending, (state) => {
                state.saving = true;
                state.error = null;
            })
            .addCase(completeCounterReading.fulfilled, (state, action) => {
                state.saving = false;
                // Правка прошлого месяца не должна «откатывать» последний период
                const saved = action.payload.periodKey;
                if (!state.lastPeriodKey || saved > state.lastPeriodKey) {
                    state.lastPeriodKey = saved;
                }
                recomputeShow(state);
            })
            .addCase(completeCounterReading.rejected, (state, action) => {
                state.saving = false;
                state.error = action.error.message || 'Не удалось сохранить';
            });
    },
});

export const { clearCounterReadingError } = counterReadingSlice.actions;
export default counterReadingSlice.reducer;
