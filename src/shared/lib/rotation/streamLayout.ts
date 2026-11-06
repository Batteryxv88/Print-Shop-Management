export interface StreamLayout {
    /** Ширина одного ручья, мм. Всегда «W к ручью», если оно задано. */
    across: number;
    /** Размер этикетки вдоль рядов, мм. */
    along: number;
}

/**
 * Ручей рисуется шириной sizeForColumn.
 * В ряд уходит другая сторона этикетки: та, что дальше от «W к ручью».
 * Если стороны равны или размер к ручью не задан, ручей = width, ряд = height.
 */
export const streamLayout = (
    width: number,
    height: number,
    sizeForColumn: number
): StreamLayout => {
    const labelWidth = Number(width);
    const labelHeight = Number(height);
    const stream = Number(sizeForColumn);

    if (!Number.isFinite(stream) || stream <= 0) {
        return { across: labelWidth, along: labelHeight };
    }

    const widthDistance = Math.abs(labelWidth - stream);
    const heightDistance = Math.abs(labelHeight - stream);
    const along = heightDistance < widthDistance ? labelWidth : labelHeight;

    return { across: stream, along };
};
