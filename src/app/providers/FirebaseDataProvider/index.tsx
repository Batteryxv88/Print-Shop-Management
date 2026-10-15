import { ReactNode, useEffect } from 'react';
import { useAppDispatch } from '../StoreProvider/Store/hooks';
import { loadAppSettings } from '../StoreProvider/Store/AppSettingsSlice';

/**
 * Глобальная инициализация без лишних подписок Firestore.
 * Коллекции подключаются через хуки только на нужных экранах
 * (shared subscription — один listener на коллекцию).
 */
export const FirebaseDataProvider = ({ children }: { children: ReactNode }) => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(loadAppSettings());
    }, [dispatch]);

    return <>{children}</>;
};
