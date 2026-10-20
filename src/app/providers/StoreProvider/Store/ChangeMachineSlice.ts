import { createSlice } from "@reduxjs/toolkit";

export type JournalKind =
    | 'toner'
    | 'part'
    | 'engineer'
    | 'scrap'
    | 'paper'
    | 'lamination'
    | 'counters';

const ChangePageSlice = createSlice({
    name: 'ChangeMachineSlice',
    initialState: {
        machine: "C71cf",
        tonerMachine: "C71cf",
        storage: 'Детали',
        storageModel: '',
        /** Режим инвентаризации внутри текущего раздела склада */
        storageInventorizationOpen: false,
        reportEditorMachine: '',
        /** Режим журнала учёта */
        journalKind: 'toner' as JournalKind,
    },
    reducers: {
        changeMachine(state, action) {
            state.machine = action.payload
        },
        changeTonerMachine(state, action) {
            state.tonerMachine = action.payload
        },
        changeStorage(state, action) {
            state.storage = action.payload;
            state.storageInventorizationOpen = false;
        },
        setStorageInventorizationOpen(state, action) {
            state.storageInventorizationOpen = Boolean(action.payload);
        },
        changeStorageModel(state, action) {
            state.storageModel = action.payload
        },
        changeReportEditorMachine(state, action) {
            state.reportEditorMachine = action.payload
        },
        changeJournalKind(state, action) {
            state.journalKind = action.payload
        },
    }
})

export default ChangePageSlice.reducer
export const {
    changeMachine,
    changeTonerMachine,
    changeStorage,
    setStorageInventorizationOpen,
    changeStorageModel,
    changeReportEditorMachine,
    changeJournalKind,
} = ChangePageSlice.actions
