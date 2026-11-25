import {
    addDoc,
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
    writeBatch,
    type QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PrinterCounterValues } from '../shared/lib/counterReading/fields';
import {
    problemSummaryOf,
    type MaintenanceStatus,
    type MaintenanceType,
} from '../shared/lib/maintenance/draft';

export type ReplacedPartLine = {
    stockId: string;
    partN: string;
    partName: string;
    section: string;
    quantity: number;
    actualLife: number;
    percent: number;
    factoryLife: number;
    movementId: string;
    totalCost: number;
    unitPriceAvg: number;
    costCategory: string;
    economyAmount: number;
    usedPartId?: string;
};

export type NeededPartLine = {
    stockId: string;
    partN: string;
    partName: string;
    section: string;
    quantity: number;
};

export type MaintenanceTicket = {
    id: string;
    printerId: string;
    machine: string;
    type: MaintenanceType;
    status: MaintenanceStatus;
    openedAt: string;
    openedBy: string;
    updatedAt: string;
    problemSummary: string;
};

export type MaintenanceEntry = {
    id: string;
    date: string;
    man: string;
    status: MaintenanceStatus;
    problem: string;
    workDone: string;
    notes: string;
    counters: PrinterCounterValues;
    replacedParts: ReplacedPartLine[];
    neededParts: NeededPartLine[];
};

export type MaintenanceEntryInput = {
    man: string;
    status: MaintenanceStatus;
    problem: string;
    workDone: string;
    notes: string;
    counters: PrinterCounterValues;
    replacedParts: ReplacedPartLine[];
    neededParts: NeededPartLine[];
    /** Уже известные id журнала замен, если списание прошло до записи заявки */
    date?: string;
};

const TICKETS = 'MaintenanceTickets';

const asType = (value: unknown): MaintenanceType =>
    value === 'incident' || value === 'audit' || value === 'maintenance'
        ? value
        : 'maintenance';

const asStatus = (value: unknown): MaintenanceStatus => {
    if (
        value === 'new' ||
        value === 'in_progress' ||
        value === 'waiting_parts' ||
        value === 'done' ||
        value === 'paused'
    ) {
        return value;
    }
    return 'new';
};

const asCounters = (value: unknown): PrinterCounterValues => {
    const raw = (value || {}) as PrinterCounterValues;
    const counters: PrinterCounterValues = {
        total: Number(raw.total) || 0,
    };
    if (raw.mono != null) counters.mono = Number(raw.mono) || 0;
    if (raw.color != null) counters.color = Number(raw.color) || 0;
    if (raw.special && typeof raw.special === 'object') {
        const special: Record<string, number> = {};
        Object.entries(raw.special).forEach(([code, qty]) => {
            special[code] = Number(qty) || 0;
        });
        if (Object.keys(special).length > 0) counters.special = special;
    }
    return counters;
};

const asReplaced = (value: unknown): ReplacedPartLine[] => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
        const row = item as ReplacedPartLine;
        return {
            stockId: String(row.stockId || ''),
            partN: String(row.partN || ''),
            partName: String(row.partName || ''),
            section: String(row.section || ''),
            quantity: Number(row.quantity) || 0,
            actualLife: Number(row.actualLife) || 0,
            percent: Number(row.percent) || 0,
            factoryLife: Number(row.factoryLife) || 0,
            movementId: String(row.movementId || ''),
            totalCost: Number(row.totalCost) || 0,
            unitPriceAvg: Number(row.unitPriceAvg) || 0,
            costCategory: String(row.costCategory || ''),
            economyAmount: Number(row.economyAmount) || 0,
            ...(row.usedPartId ? { usedPartId: String(row.usedPartId) } : {}),
        };
    });
};

const asNeeded = (value: unknown): NeededPartLine[] => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
        const row = item as NeededPartLine;
        return {
            stockId: String(row.stockId || ''),
            partN: String(row.partN || ''),
            partName: String(row.partName || ''),
            section: String(row.section || ''),
            quantity: Number(row.quantity) || 0,
        };
    });
};

const mapTicket = (
    id: string,
    data: Record<string, unknown>
): MaintenanceTicket => ({
    id,
    printerId: String(data.printerId || ''),
    machine: String(data.machine || ''),
    type: asType(data.type),
    status: asStatus(data.status),
    openedAt: String(data.openedAt || ''),
    openedBy: String(data.openedBy || ''),
    updatedAt: String(data.updatedAt || ''),
    problemSummary: String(data.problemSummary || ''),
});

const mapEntry = (
    id: string,
    data: Record<string, unknown>
): MaintenanceEntry => ({
    id,
    date: String(data.date || ''),
    man: String(data.man || ''),
    status: asStatus(data.status),
    problem: String(data.problem || ''),
    workDone: String(data.workDone || ''),
    notes: String(data.notes || ''),
    counters: asCounters(data.counters),
    replacedParts: asReplaced(data.replacedParts),
    neededParts: asNeeded(data.neededParts),
});

const entryPayload = (input: MaintenanceEntryInput, date: string) => ({
    date,
    man: input.man,
    status: input.status,
    problem: input.problem.trim(),
    workDone: input.workDone.trim(),
    notes: input.notes.trim(),
    counters: asCounters(input.counters),
    replacedParts: asReplaced(input.replacedParts),
    neededParts:
        input.status === 'waiting_parts' ? asNeeded(input.neededParts) : [],
});

export type TicketQuery = {
    printerId: string;
    type?: MaintenanceType | '';
    status?: MaintenanceStatus | '';
    pageSize: number;
};

/** Слушатель только шапок выбранного принтера, не больше pageSize. */
export const subscribeMaintenanceTickets = (
    params: TicketQuery,
    onData: (tickets: MaintenanceTicket[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const constraints: QueryConstraint[] = [
        where('printerId', '==', params.printerId),
    ];
    if (params.type) constraints.push(where('type', '==', params.type));
    if (params.status) constraints.push(where('status', '==', params.status));
    constraints.push(orderBy('updatedAt', 'desc'));
    constraints.push(limit(params.pageSize));

    const ticketsQuery = query(collection(db, TICKETS), ...constraints);
    return onSnapshot(
        ticketsQuery,
        (snap) => {
            onData(
                snap.docs.map((item) =>
                    mapTicket(item.id, item.data() as Record<string, unknown>)
                )
            );
        },
        (error) => onError(error)
    );
};

/** Слушатель записей одной раскрытой заявки, новые сверху. */
export const subscribeMaintenanceEntries = (
    ticketId: string,
    pageSize: number,
    onData: (entries: MaintenanceEntry[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    const entriesQuery = query(
        collection(db, TICKETS, ticketId, 'entries'),
        orderBy('date', 'desc'),
        limit(pageSize)
    );
    return onSnapshot(
        entriesQuery,
        (snap) => {
            onData(
                snap.docs.map((item) =>
                    mapEntry(item.id, item.data() as Record<string, unknown>)
                )
            );
        },
        (error) => onError(error)
    );
};

export const createMaintenanceTicket = async (input: {
    printerId: string;
    machine: string;
    type: MaintenanceType;
    openedBy: string;
    entry: MaintenanceEntryInput;
}): Promise<{ ticketId: string; entryId: string }> => {
    const now = input.entry.date || new Date().toISOString();
    const ticketRef = doc(collection(db, TICKETS));
    const entryRef = doc(collection(db, TICKETS, ticketRef.id, 'entries'));
    const batch = writeBatch(db);
    batch.set(ticketRef, {
        printerId: input.printerId,
        machine: input.machine,
        type: input.type,
        status: input.entry.status,
        openedAt: now,
        openedBy: input.openedBy,
        updatedAt: now,
        problemSummary: problemSummaryOf(
            input.entry.problem,
            input.entry.workDone,
            input.entry.notes
        ),
    });
    batch.set(entryRef, entryPayload(input.entry, now));
    await batch.commit();
    return { ticketId: ticketRef.id, entryId: entryRef.id };
};

export const appendMaintenanceEntry = async (
    ticketId: string,
    input: MaintenanceEntryInput
): Promise<{ entryId: string }> => {
    const now = input.date || new Date().toISOString();
    const ticketRef = doc(db, TICKETS, ticketId);
    const entryRef = doc(collection(db, TICKETS, ticketId, 'entries'));
    const batch = writeBatch(db);
    batch.set(entryRef, entryPayload(input, now));
    batch.update(ticketRef, {
        status: input.status,
        updatedAt: now,
    });
    await batch.commit();
    return { entryId: entryRef.id };
};

export type UsedPartLink = {
    partN: string;
    partName: string;
    quantity: number;
    section: string;
    man: string;
    machine: string;
    printerId: string;
    date: string;
    totalCost: number;
    unitPriceAvg: number;
    movementId: string;
    costCategory: string;
    economyAmount: number;
    factoryLife: number;
    actualLife: number;
    percent: number;
    ticketId?: string;
    entryId?: string;
};

/** Строка журнала замен для аналитики. Пишется отдельно от пачки заявки. */
export const addLinkedUsedPart = async (
    part: UsedPartLink
): Promise<string> => {
    const { ticketId, entryId, ...rest } = part;
    const ref = await addDoc(collection(db, 'UsedParts'), {
        ...rest,
        serviceLife: part.actualLife,
        ...(ticketId ? { ticketId, entryId: entryId || '' } : {}),
    });
    return ref.id;
};
