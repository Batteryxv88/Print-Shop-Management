import { describe, expect, it } from 'vitest';

import reducer, {
    changeJournalKind,
    changeStorage,
    changeStorageModel,
    setStorageInventorizationOpen,
} from './ChangeMachineSlice';

describe('ChangeMachineSlice', () => {
    it('changeStorageModel sets warehouse model filter', () => {
        const state = reducer(undefined, changeStorageModel('Versant'));
        expect(state.storageModel).toBe('Versant');
    });

    it('changeStorage updates active storage tab', () => {
        const state = reducer(undefined, changeStorage('Тонеры'));
        expect(state.storage).toBe('Тонеры');
    });

    it('changeStorage closes inventorization mode', () => {
        let state = reducer(undefined, setStorageInventorizationOpen(true));
        state = reducer(state, changeStorage('Бумага'));
        expect(state.storageInventorizationOpen).toBe(false);
    });

    it('changeJournalKind updates journal mode', () => {
        const state = reducer(undefined, changeJournalKind('part'));
        expect(state.journalKind).toBe('part');
    });
});
