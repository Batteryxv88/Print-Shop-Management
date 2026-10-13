import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const SETTINGS_DOC = doc(db, 'AppSettings', 'main');

export type PaperFormMode = 'sheet' | 'roll' | 'both';

export type AppSettings = {
    /** День месяца для снятия счётчиков (1–31) */
    counterReadingDay: number | null;
    /** Склад бумаги включён */
    paperStockEnabled: boolean;
    /** Склад ламинации включён */
    laminationStockEnabled: boolean;
    /** Режим склада бумаги: лист / рулон / оба */
    paperFormMode: PaperFormMode;
};

const DEFAULTS: AppSettings = {
    counterReadingDay: null,
    paperStockEnabled: true,
    laminationStockEnabled: true,
    paperFormMode: 'both',
};

const normalizePaperFormMode = (raw: unknown): PaperFormMode => {
    if (raw === 'sheet' || raw === 'roll' || raw === 'both') return raw;
    return DEFAULTS.paperFormMode;
};

export const fetchAppSettings = async (): Promise<AppSettings> => {
    const snap = await getDoc(SETTINGS_DOC);
    if (!snap.exists()) return { ...DEFAULTS };
    const data = snap.data() as Partial<AppSettings>;
    const day = Number(data.counterReadingDay);
    return {
        counterReadingDay:
            Number.isFinite(day) && day >= 1 && day <= 31 ? day : null,
        paperStockEnabled:
            data.paperStockEnabled === undefined
                ? DEFAULTS.paperStockEnabled
                : Boolean(data.paperStockEnabled),
        laminationStockEnabled:
            data.laminationStockEnabled === undefined
                ? DEFAULTS.laminationStockEnabled
                : Boolean(data.laminationStockEnabled),
        paperFormMode: normalizePaperFormMode(data.paperFormMode),
    };
};

export const saveAppSettings = async (
    patch: Partial<AppSettings>
): Promise<AppSettings> => {
    const current = await fetchAppSettings();
    const next: AppSettings = { ...current, ...patch };

    if (next.counterReadingDay != null) {
        const day = Number(next.counterReadingDay);
        if (!Number.isFinite(day) || day < 1 || day > 31) {
            throw new Error('День месяца должен быть от 1 до 31');
        }
        next.counterReadingDay = Math.round(day);
    }

    next.paperFormMode = normalizePaperFormMode(next.paperFormMode);
    next.paperStockEnabled = Boolean(next.paperStockEnabled);
    next.laminationStockEnabled = Boolean(next.laminationStockEnabled);

    await setDoc(SETTINGS_DOC, next, { merge: true });
    return next;
};
