import { ReactNode, useEffect } from 'react';
import {
    useParts,
    useToners,
    useUsedParts,
    useTonerHistory,
    usePrinters,
    useAppDispatch,
} from '../StoreProvider/Store/hooks';
import { loadAppSettings } from '../StoreProvider/Store/AppSettingsSlice';

/**
 * Поднимает общие подписки Firestore один раз для всего авторизованного приложения.
 * Хуки внутри всё равно безопасны (shared subscription), но так данные
 * прогреты сразу после входа.
 */
export const FirebaseDataProvider = ({ children }: { children: ReactNode }) => {
    const dispatch = useAppDispatch();
    usePrinters();
    useParts();
    useToners();
    useUsedParts();
    useTonerHistory();

    useEffect(() => {
        dispatch(loadAppSettings());
    }, [dispatch]);

    return <>{children}</>;
};
