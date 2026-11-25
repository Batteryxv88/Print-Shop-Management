export type MaintenanceType = 'incident' | 'maintenance' | 'audit';

export type MaintenanceStatus =
    | 'new'
    | 'in_progress'
    | 'waiting_parts'
    | 'done'
    | 'paused';

export const MAINTENANCE_TYPES: MaintenanceType[] = [
    'incident',
    'maintenance',
    'audit',
];

export const MAINTENANCE_STATUSES: MaintenanceStatus[] = [
    'new',
    'in_progress',
    'waiting_parts',
    'done',
    'paused',
];

export const maintenanceTypeLabel = (type: MaintenanceType): string => {
    if (type === 'incident') return 'Инцидент';
    if (type === 'audit') return 'Аудит';
    return 'ТО';
};

export const maintenanceStatusLabel = (status: MaintenanceStatus): string => {
    if (status === 'in_progress') return 'В работе';
    if (status === 'waiting_parts') return 'Ожидает детали';
    if (status === 'done') return 'Выполнено';
    if (status === 'paused') return 'Приостановлено';
    return 'Новая';
};

const SUMMARY_LIMIT = 140;

/** Короткий текст для строки списка. Берётся из первой записи и больше не меняется. */
export const problemSummaryOf = (
    problem: string,
    workDone: string,
    notes: string
): string => {
    const source = problem.trim() || workDone.trim() || notes.trim();
    if (source.length <= SUMMARY_LIMIT) return source;
    return `${source.slice(0, SUMMARY_LIMIT - 1)}…`;
};

export const maintenanceDraftError = (draft: {
    problem: string;
    workDone: string;
    notes: string;
    status: MaintenanceStatus;
    neededCount: number;
}): string => {
    const problem = draft.problem.trim();
    const workDone = draft.workDone.trim();
    const notes = draft.notes.trim();
    if (!problem && !workDone && !notes) {
        return 'Заполните описание, выполненные работы или замечания';
    }
    if (draft.status === 'done' && !workDone) {
        return 'Для статуса «Выполнено» укажите выполненные работы';
    }
    if (draft.status === 'waiting_parts' && draft.neededCount < 1) {
        return 'Для статуса «Ожидает детали» укажите хотя бы одну деталь';
    }
    return '';
};
