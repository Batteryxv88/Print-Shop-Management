import { useCallback, useState } from 'react';
import type { FifoLotSlice } from '../../../services/stockAccounting';

export type FifoBreakdownPayload = {
    title: string;
    subtitle?: string;
    qty: number;
    totalCost: number;
    unitPriceAvg: number;
    slices: FifoLotSlice[];
};

export const useFifoBreakdown = () => {
    const [breakdown, setBreakdown] = useState<FifoBreakdownPayload | null>(
        null
    );

    const openBreakdown = useCallback((payload: FifoBreakdownPayload) => {
        setBreakdown(payload);
    }, []);

    const closeBreakdown = useCallback(() => {
        setBreakdown(null);
    }, []);

    return { breakdown, openBreakdown, closeBreakdown };
};
