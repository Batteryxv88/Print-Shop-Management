import { parsePartLife } from './printers/parsePartLife';
import { parseLifeExact } from './formatLifeInput';

const sameColorParts = [
    "A5WH0Y0C",
    "A5WH0Y0M",
    "A5WH0Y0Y",
    "A5WH0Y0K",
    "A50UR70323C",
    "A50UR70323M",
    "A50UR70323Y",
    "A50UR70323K",
    "A50UR70244C",
    "A50UR70244M",
    "A50UR70244Y",
    "A50UR70244K",
];

export const lifePercent = (partNumber: any, array: any, life: any): number => {
    if (array.length <= 0 || !life) {
        return 0;
    }

    const LifeOfPart = array.filter((item: any) => {
        if (sameColorParts.includes(partNumber)) {
            return item.part.partN === partNumber.slice(0, -1);
        }
        return item.part.partN === partNumber;
    });

    const maxLife = parsePartLife(LifeOfPart[0]?.part?.partLife);
    if (!maxLife) return 0;

    // Пройденный ресурс при замене — точное число (1,028,400), без «K»
    const usedLife =
        typeof life === 'number'
            ? life
            : parseLifeExact(life) || parsePartLife(life);
    if (!usedLife) return 0;

    return Math.round((usedLife * 100) / maxLife);
};
