/**
 * Один onSnapshot на коллекцию на всё приложение,
 * даже если хук вызван из нескольких компонентов.
 */
export type SharedSubscription = {
    count: number;
    unsubscribe: (() => void) | null;
};

export const createSharedSubscription = (): SharedSubscription => ({
    count: 0,
    unsubscribe: null,
});

export const retainSharedSubscription = (
    shared: SharedSubscription,
    start: () => () => void
): (() => void) => {
    shared.count += 1;
    if (!shared.unsubscribe) {
        shared.unsubscribe = start();
    }

    return () => {
        shared.count -= 1;
        if (shared.count <= 0) {
            shared.unsubscribe?.();
            shared.unsubscribe = null;
            shared.count = 0;
        }
    };
};
