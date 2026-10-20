import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
    changeStorage,
    setStorageInventorizationOpen,
} from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';

/** Старый URL `/inventorization` → склад, вкладка «Инвентаризация». */
const InventorizationRedirect = () => {
    const dispatch = useAppDispatch();
    useEffect(() => {
        dispatch(changeStorage('Детали'));
        dispatch(setStorageInventorizationOpen(true));
    }, [dispatch]);
    return <Navigate to="/" replace />;
};

export default InventorizationRedirect;
