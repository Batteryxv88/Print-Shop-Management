/**
 * Какой бэкенд данных использует сборка.
 * По умолчанию — Firebase; Appwrite подключается позже через адаптеры в src/data/.
 */
export type DataBackend = 'firebase' | 'appwrite';

declare const process: {
    env: {
        DATA_BACKEND?: string;
        APPWRITE_ENDPOINT?: string;
        APPWRITE_PROJECT_ID?: string;
        APPWRITE_DATABASE_ID?: string;
    };
};

export const getDataBackend = (): DataBackend =>
    process.env.DATA_BACKEND === 'appwrite' ? 'appwrite' : 'firebase';

export const isFirebaseBackend = (): boolean =>
    getDataBackend() === 'firebase';

export const isAppwriteBackend = (): boolean =>
    getDataBackend() === 'appwrite';

export const getAppwritePublicConfig = () => ({
    endpoint: process.env.APPWRITE_ENDPOINT || '',
    projectId: process.env.APPWRITE_PROJECT_ID || '',
    databaseId: process.env.APPWRITE_DATABASE_ID || 'print_shop',
});
