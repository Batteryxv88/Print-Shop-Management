import { TonerArray } from '../../../app/providers/StoreProvider/Store/TonerSlice';
import type { Printer } from '../../../services/printers';
import { usageMatchesSelectedPrinter } from '../../../shared/lib/printers/printerIdentity';

export const sortAndFilterToners = (
    records: TonerArray[],
    selectedPrinterId: string,
    printers: Printer[]
): TonerArray[] => {
    if (!records || records.length === 0) {
        return [];
    }

    const filteredRecords = selectedPrinterId
        ? records.filter((record) =>
              usageMatchesSelectedPrinter(
                  record.toner,
                  selectedPrinterId,
                  printers
              )
          )
        : records;

    return [...filteredRecords].sort(
        (a, b) =>
            new Date(b.toner.date).getTime() - new Date(a.toner.date).getTime()
    );
};
