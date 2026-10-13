import { useMemo } from 'react';
import { useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';

export interface OrderListItem {
    id: string;
    partN: string;
    partName: string;
    currentQty: number;
    /** Сколько пометили к заказу на складе */
    needToOrder: number;
    section: string;
    model?: string;
}

export const useOrderList = () => {
    const partsArray = useAppSelector((state) => state.parts.partsArray);
    const storageModel = useAppSelector(
        (state) => state.machines.storageModel
    );

    const orderList = useMemo(() => {
        const results: OrderListItem[] = [];

        partsArray.forEach((partData: { id: string; part: any }) => {
            const part = partData.part || {};
            const needToOrder = Math.max(0, Number(part.orderQty) || 0);
            if (needToOrder <= 0) return;

            results.push({
                id: partData.id,
                partN: part.partN || '',
                partName: part.partName || '',
                currentQty: Number(part.quantity) || 0,
                needToOrder,
                section: part.section || 'Other',
                model: part.model || '',
            });
        });

        return results.sort((a, b) => {
            if (a.section !== b.section) {
                return a.section.localeCompare(b.section, 'ru');
            }
            return a.partName.localeCompare(b.partName, 'ru');
        });
    }, [partsArray]);

    /** Список для текущего фильтра модели склада (если выбран) */
    const orderListForModel = useMemo(() => {
        if (!storageModel) return orderList;
        return orderList.filter(
            (item) =>
                !item.model ||
                String(item.model).toLowerCase() ===
                    String(storageModel).toLowerCase()
        );
    }, [orderList, storageModel]);

    return {
        orderList,
        orderListForModel,
        totalItems: orderList.length,
        totalQuantityToOrder: orderList.reduce(
            (sum, item) => sum + item.needToOrder,
            0
        ),
    };
};
