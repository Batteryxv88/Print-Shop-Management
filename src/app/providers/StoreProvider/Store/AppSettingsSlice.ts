import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
    AppSettings,
    PaperFormMode,
    fetchAppSettings,
    saveAppSettings,
} from '../../../../services/appSettings';

type State = AppSettings & {
    loaded: boolean;
    saving: boolean;
    error: string | null;
};

const initialState: State = {
    counterReadingDay: null,
    paperStockEnabled: true,
    laminationStockEnabled: true,
    paperFormMode: 'both',
    loaded: false,
    saving: false,
    error: null,
};

export const loadAppSettings = createAsyncThunk(
    'appSettings/load',
    async () => fetchAppSettings()
);

export const saveStockModuleSettings = createAsyncThunk(
    'appSettings/saveStockModules',
    async (patch: {
        paperStockEnabled?: boolean;
        laminationStockEnabled?: boolean;
        paperFormMode?: PaperFormMode;
    }) => saveAppSettings(patch)
);

const appSettingsSlice = createSlice({
    name: 'appSettings',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(loadAppSettings.fulfilled, (state, action) => {
                Object.assign(state, action.payload);
                state.loaded = true;
                state.error = null;
            })
            .addCase(loadAppSettings.rejected, (state, action) => {
                state.loaded = true;
                state.error = action.error.message || 'Ошибка загрузки настроек';
            })
            .addCase(saveStockModuleSettings.pending, (state) => {
                state.saving = true;
            })
            .addCase(saveStockModuleSettings.fulfilled, (state, action) => {
                Object.assign(state, action.payload);
                state.saving = false;
                state.error = null;
            })
            .addCase(saveStockModuleSettings.rejected, (state, action) => {
                state.saving = false;
                state.error = action.error.message || 'Ошибка сохранения';
            });
    },
});

export default appSettingsSlice.reducer;
