import type { Printer } from '../../../services/printers';
import type { UsedPartData } from '../../../services/usedParts';
import { usageMatchesSelectedPrinter } from '../../../shared/lib/printers/printerIdentity';

/** @param selectedPrinterId id документа Printers */
export const filterByMachine = (
    array: UsedPartData[],
    selectedPrinterId: string,
    printers: Printer[]
) => {
    const filteredData = array.filter((item) =>
        usageMatchesSelectedPrinter(item.part || {}, selectedPrinterId, printers)
    );

    if (filteredData.length === 0) {
        return filteredData;
    }

    return filteredData.slice().sort((a, b) => {
        const dateA = new Date(a.part?.date || '').getTime();
        const dateB = new Date(b.part?.date || '').getTime();
        return dateB - dateA;
    });
};
