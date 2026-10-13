import { TonerArray } from '../../../app/providers/StoreProvider/Store/TonerSlice';

export const sortAndFilterToners = (
  records: TonerArray[],
  machine: string
): TonerArray[] => {
  if (!records || records.length === 0) {
    return [];
  }

  const filteredRecords = machine
    ? records.filter((record) => record.toner.machine === machine)
    : records;

  return [...filteredRecords].sort(
    (a, b) =>
      new Date(b.toner.date).getTime() - new Date(a.toner.date).getTime()
  );
};
