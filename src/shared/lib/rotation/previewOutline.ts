export type PreviewOutline = 'circle' | 'ellipse' | 'square' | 'rectangle' | 'figured';

const normalizeShape = (shape: string): string =>
    shape
        .replace(/\u00a0/g, ' ')
        .replace(/ё/g, 'е')
        .trim()
        .toLowerCase();

/** Круг и квадрат — когда стороны равны, овал и прямоугольник — когда нет. */
export const previewOutline = (
    shape: string,
    width: number,
    height: number
): PreviewOutline => {
    const normalized = normalizeShape(shape);
    const round = normalized.startsWith('круг') || normalized.startsWith('овал');
    const equal = width > 0 && height > 0 && width === height;

    if (normalized.startsWith('фигурн')) return 'figured';
    if (round) return equal ? 'circle' : 'ellipse';
    return equal ? 'square' : 'rectangle';
};

export const previewBorderRadius = (outline: PreviewOutline): string => {
    if (outline === 'circle' || outline === 'ellipse') return '50%';
    if (outline === 'figured') return '0';
    return '3px';
};

/** Силуэт морды собаки. Растягивается по ширине и высоте фигурной этикетки. */
export const FIGURED_LABEL_PATH =
    'M18 4C12 4 8 12 8 22C8 30 12 36 20 40C12 48 12 60 20 70C26 80 32 86 38 90C42 96 46 99 50 99C54 99 58 96 62 90C68 86 74 80 80 70C88 60 88 48 80 40C88 36 92 30 92 22C92 12 88 4 82 4C76 12 72 22 68 32C62 24 56 20 50 20C44 20 38 24 32 32C28 22 24 12 18 4Z';

export const FIGURED_DOG_FACE =
    'M34.5 47a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M57.5 47a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M45.5 73a4.5 5.5 0 1 0 9 0a4.5 5.5 0 1 0 -9 0';

export const FIGURED_DOG_MOUTH = 'M40 86Q50 94 60 86';
