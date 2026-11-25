import type { JournalKind } from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';

type Ask = (next?: JournalKind) => boolean;

let ask: Ask | null = null;

export const bindMaintenanceLeave = (fn: Ask | null) => {
    ask = fn;
};

/** true, если заявка открыта и вопрос уже показан. */
export const askMaintenanceLeave = (next?: JournalKind): boolean => {
    if (!ask) return false;
    return ask(next);
};
