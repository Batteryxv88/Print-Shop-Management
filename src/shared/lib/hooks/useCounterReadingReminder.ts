import { useEffect } from 'react';
import {
    useAppDispatch,
    useAppSelector,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { loadAppSettings } from '../../../app/providers/StoreProvider/Store/AppSettingsSlice';
import { loadLastCounterReading } from '../../../app/providers/StoreProvider/Store/CounterReadingSlice';

/** Загружает настройки и статус снятия для напоминалки в шапке */
export const useCounterReadingReminder = () => {
    const dispatch = useAppDispatch();
    const appSettingsLoaded = useAppSelector((s) => s.appSettings.loaded);
    const readingLoaded = useAppSelector((s) => s.counterReading.readingLoaded);

    useEffect(() => {
        if (!appSettingsLoaded) {
            dispatch(loadAppSettings());
        }
    }, [dispatch, appSettingsLoaded]);

    useEffect(() => {
        if (!readingLoaded) {
            dispatch(loadLastCounterReading());
        }
    }, [dispatch, readingLoaded]);
};
