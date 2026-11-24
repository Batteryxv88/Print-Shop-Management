import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../app/providers/StoreProvider/Store';
import {
    fetchQuantityToOrder,
    updateOrderQuantity,
    updateOrderUse,
    updateOrderQtyAndUse,
    setOrders,
    setLoading,
    setError
} from '../../../app/providers/StoreProvider/Store/QuantityToOrderSlice';
import {
    QuantityToOrder,
    subscribeToQuantityToOrder,
} from '../../../services/quantityToOrder';
import {
    createSharedSubscription,
    retainSharedSubscription,
} from '../firebase/sharedSubscription';

const quantityToOrderSub = createSharedSubscription();

/** Один onSnapshot на коллекцию, даже если хук вызван с главной и со склада. */
export const useQuantityToOrderLive = () => {
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        const starting = !quantityToOrderSub.unsubscribe;
        if (starting) {
            dispatch(setLoading(true));
        }
        return retainSharedSubscription(quantityToOrderSub, () =>
            subscribeToQuantityToOrder(
                (orders) => {
                    dispatch(setOrders(orders));
                    dispatch(setLoading(false));
                    dispatch(setError(null));
                },
                (error) => {
                    dispatch(setLoading(false));
                    dispatch(setError(error.message));
                }
            )
        );
    }, [dispatch]);
};

export const useQuantityToOrder = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { orders, isLoading, error } = useSelector((state: RootState) => state.quantityToOrder);

    const handleFetchOrders = () => {
        dispatch(fetchQuantityToOrder());
    };

    const handleUpdateQuantity = (id: string, qty: number) => {
        dispatch(updateOrderQuantity({ id, qty }));
    };

    const handleUpdateUse = (id: string, use: boolean) => {
        dispatch(updateOrderUse({ id, use }));
    };

    const handleUpdateQtyAndUse = (id: string, qty: number, use: boolean) => {
        dispatch(updateOrderQtyAndUse({ id, qty, use }));
    };

    const handleSetOrders = (orders: QuantityToOrder[]) => {
        dispatch(setOrders(orders));
    };

    const handleSetLoading = (loading: boolean) => {
        dispatch(setLoading(loading));
    };

    const handleSetError = (error: string | null) => {
        dispatch(setError(error));
    };

    return {
        // State
        orders,
        isLoading,
        error,
        
        // Actions
        fetchOrders: handleFetchOrders,
        updateQuantity: handleUpdateQuantity,
        updateUse: handleUpdateUse,
        updateQtyAndUse: handleUpdateQtyAndUse,
        setOrders: handleSetOrders,
        setLoading: handleSetLoading,
        setError: handleSetError,
    };
}; 