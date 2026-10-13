import { useEffect } from 'react';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import {
    loadCounterReadingSettings,
    loadLastCounterReading,
} from '../../../app/providers/StoreProvider/Store/CounterReadingSlice';

/** Загружает настройки и статус снятия для напоминалки в шапке */
export const useCounterReadingReminder = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(loadCounterReadingSettings());
        dispatch(loadLastCounterReading());
    }, [dispatch]);
};
