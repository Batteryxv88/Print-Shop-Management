import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const CATALOG_DOC = doc(db, 'AppSettings', 'materialCatalog');

/** Справочники выпадающих списков для бумаги / ламинации */
export type MaterialCatalog = {
    paperTypes: string[];
    paperSubtypes: string[];
    adhesives: string[];
    thicknesses: string[];
    densities: string[];
    formats: string[];
    colors: string[];
    coatings: string[];
    laminationTypes: string[];
    laminationSubtypes: string[];
};

export type MaterialCatalogKey = keyof MaterialCatalog;

export const EMPTY_CATALOG: MaterialCatalog = {
    paperTypes: ['Бумага', 'Плёнка'],
    paperSubtypes: ['С тиснением', 'С покрытием', 'Металлизированная'],
    adhesives: ['Акрил', 'Каучук'],
    thicknesses: [],
    densities: [],
    formats: ['SRA3', 'A3', 'A4'],
    colors: [],
    coatings: [],
    laminationTypes: ['Глянцевая', 'Матовая'],
    laminationSubtypes: [],
};

const asStringList = (raw: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(raw)) return [...fallback];
    const out: string[] = [];
    raw.forEach((item) => {
        const s = String(item || '').trim();
        if (s && !out.includes(s)) out.push(s);
    });
    return out.length ? out : [...fallback];
};

export const fetchMaterialCatalog = async (): Promise<MaterialCatalog> => {
    const snap = await getDoc(CATALOG_DOC);
    if (!snap.exists()) return { ...EMPTY_CATALOG };
    const data = snap.data() as Partial<MaterialCatalog>;
    return {
        paperTypes: asStringList(data.paperTypes, EMPTY_CATALOG.paperTypes),
        paperSubtypes: asStringList(
            data.paperSubtypes,
            EMPTY_CATALOG.paperSubtypes
        ),
        adhesives: asStringList(data.adhesives, EMPTY_CATALOG.adhesives),
        thicknesses: asStringList(data.thicknesses, EMPTY_CATALOG.thicknesses),
        densities: asStringList(data.densities, EMPTY_CATALOG.densities),
        formats: asStringList(data.formats, EMPTY_CATALOG.formats),
        colors: asStringList(data.colors, EMPTY_CATALOG.colors),
        coatings: asStringList(data.coatings, EMPTY_CATALOG.coatings),
        laminationTypes: asStringList(
            data.laminationTypes,
            EMPTY_CATALOG.laminationTypes
        ),
        laminationSubtypes: asStringList(
            data.laminationSubtypes,
            EMPTY_CATALOG.laminationSubtypes
        ),
    };
};

export const saveMaterialCatalog = async (
    catalog: MaterialCatalog
): Promise<MaterialCatalog> => {
    const normalized: MaterialCatalog = {
        paperTypes: asStringList(catalog.paperTypes, []),
        paperSubtypes: asStringList(catalog.paperSubtypes, []),
        adhesives: asStringList(catalog.adhesives, []),
        thicknesses: asStringList(catalog.thicknesses, []),
        densities: asStringList(catalog.densities, []),
        formats: asStringList(catalog.formats, []),
        colors: asStringList(catalog.colors, []),
        coatings: asStringList(catalog.coatings, []),
        laminationTypes: asStringList(catalog.laminationTypes, []),
        laminationSubtypes: asStringList(catalog.laminationSubtypes, []),
    };
    await setDoc(CATALOG_DOC, normalized, { merge: true });
    return normalized;
};

/** Добавить значение в список справочника (если ещё нет) */
export const addCatalogValue = async (
    key: MaterialCatalogKey,
    value: string
): Promise<MaterialCatalog> => {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('Пустое значение');
    const current = await fetchMaterialCatalog();
    const list = current[key];
    if (list.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
        return current;
    }
    return saveMaterialCatalog({
        ...current,
        [key]: [...list, trimmed],
    });
};

export const CATALOG_LABELS: Record<MaterialCatalogKey, string> = {
    paperTypes: 'Тип (бумага)',
    paperSubtypes: 'Свойства (рулонная бумага)',
    adhesives: 'Клей',
    thicknesses: 'Толщина',
    densities: 'Плотность',
    formats: 'Формат',
    colors: 'Цвет',
    coatings: 'Покрытие',
    laminationTypes: 'Тип (ламинация)',
    laminationSubtypes: 'Подтип (ламинация)',
};
