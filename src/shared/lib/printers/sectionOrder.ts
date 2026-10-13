/** Предпочтительный порядок секций на складе */
export const DEFAULT_SECTION_ORDER = [
    'External section',
    'Photo conductor section',
    'Charging section',
    'Developing section',
    'Intermediate transfer section',
    '2nd transfer section',
    'Fusing section',
    'Toner collection section',
    'Paper feed section',
    'Paper exit section',
    'Conveyance section',
    'RW-101',
    'Other',
];

export const sortSections = (sections: string[]): string[] => {
    const unique = Array.from(new Set(sections.filter(Boolean)));
    return unique.sort((a, b) => {
        const ai = DEFAULT_SECTION_ORDER.indexOf(a);
        const bi = DEFAULT_SECTION_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
};
