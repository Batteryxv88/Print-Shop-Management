import { matchesModel } from '../../../shared/lib/printers/printerUtils';

type PartLike = {
    partN?: string;
    section?: string;
    model?: string;
};

type UsedLike = {
    part: {
        partN?: string;
        section?: string;
        date?: string;
        machine?: string;
    };
};

/**
 * Секция записи: сначала из UsedParts, иначе из склада по артикулу+модели.
 * Нужно, чтобы фильтр сайдбара совпадал с каталогом машины.
 */
export const resolveUsedPartSection = (
    used: UsedLike,
    stockParts: Array<{ part: PartLike }>,
    machineModel: string
): string => {
    const stored = String(used.part?.section || '').trim();
    if (stored && stored !== 'Unknown section') {
        return stored;
    }

    const partN = String(used.part?.partN || '').trim();
    if (!partN) return stored;

    const hit = stockParts.find((item) => {
        if (String(item.part?.partN || '').trim() !== partN) return false;
        return matchesModel(item.part?.model, machineModel);
    });

    return String(hit?.part?.section || stored || '').trim();
};

export const filteredAndSortedData = (
    array: UsedLike[],
    filter: string,
    stockParts: Array<{ part: PartLike }> = [],
    machineModel = ''
) => {
    const withSection = array.map((item) => ({
        ...item,
        part: {
            ...item.part,
            section: resolveUsedPartSection(item, stockParts, machineModel),
        },
    }));

    const filteredData =
        filter === 'All'
            ? withSection
            : withSection.filter(
                  (item) => String(item.part.section || '') === filter
              );

    if (filteredData.length === 0) {
        return filteredData;
    }

    return filteredData.slice().sort((a, b) => {
        const dateA = new Date(a.part.date || 0).getTime();
        const dateB = new Date(b.part.date || 0).getTime();
        return dateB - dateA;
    });
};
