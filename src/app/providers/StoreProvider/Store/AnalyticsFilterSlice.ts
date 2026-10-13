import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const pad = (n: number) => String(n).padStart(2, '0');

const toLocalDateInput = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const defaultFrom = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalDateInput(d);
};

type AnalyticsFilterState = {
    from: string;
    to: string;
    /** Инкремент → AnalyticsPage перезагружает данные */
    refreshNonce: number;
    /** Инкремент → AnalyticsPage выгружает Excel */
    exportNonce: number;
};

const initialState: AnalyticsFilterState = {
    from: defaultFrom(),
    to: toLocalDateInput(new Date()),
    refreshNonce: 0,
    exportNonce: 0,
};

const analyticsFilterSlice = createSlice({
    name: 'analyticsFilter',
    initialState,
    reducers: {
        setAnalyticsFrom(state, action: PayloadAction<string>) {
            state.from = action.payload;
        },
        setAnalyticsTo(state, action: PayloadAction<string>) {
            state.to = action.payload;
        },
        requestAnalyticsRefresh(state) {
            state.refreshNonce += 1;
        },
        requestAnalyticsExport(state) {
            state.exportNonce += 1;
        },
    },
});

export const {
    setAnalyticsFrom,
    setAnalyticsTo,
    requestAnalyticsRefresh,
    requestAnalyticsExport,
} = analyticsFilterSlice.actions;

export default analyticsFilterSlice.reducer;
