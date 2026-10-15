import { getDataBackend, type DataBackend } from '../../config/dataBackend';

/** Для будущих адаптеров: явно требовать активный бэкенд */
export const requireBackend = (expected: DataBackend): void => {
    const active = getDataBackend();
    if (active !== expected) {
        throw new Error(
            `Ожидался бэкенд «${expected}», сейчас «${active}». Проверьте DATA_BACKEND в .env`
        );
    }
};
