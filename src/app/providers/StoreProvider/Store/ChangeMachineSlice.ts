import { createSlice } from "@reduxjs/toolkit";

export type JournalKind =
    | 'toner'
    | 'part'
    | 'engineer'
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
            state.storage = action.payload
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
    changeStorageModel,
    changeReportEditorMachine,
    changeJournalKind,
} = ChangePageSlice.actions
