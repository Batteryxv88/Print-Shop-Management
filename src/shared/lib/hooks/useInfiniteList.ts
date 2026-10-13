import { useEffect, useMemo, useRef, useState } from 'react';

export const INFINITE_PAGE_SIZE = 35;

const findScrollRoot = (el: HTMLElement): Element | null => {
    let parent = el.parentElement;
    while (parent) {
        const { overflowY } = getComputedStyle(parent);
        if (overflowY === 'auto' || overflowY === 'scroll') {
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
};

const itemKey = (item: unknown): string => {
    if (item == null) return '';
    if (typeof item !== 'object') return String(item);
    const row = item as Record<string, unknown>;
    if (typeof row.id === 'string' || typeof row.id === 'number') {
        return String(row.id);
    }
    return '';
};

/** Стабильный ключ набора — не зависит от новой ссылки массива каждый рендер */
const listSignature = (items: unknown[]): string => {
    if (!items.length) return '0';
    return `${items.length}:${itemKey(items[0])}:${itemKey(items[items.length - 1])}`;
};

/**
 * Показывает первые `pageSize` элементов, при приближении к низу списка
 * подгружает ещё `pageSize` (IntersectionObserver по scroll-контейнеру).
 */
export function useInfiniteList<T>(
    items: T[],
    pageSize: number = INFINITE_PAGE_SIZE
) {
    const [visibleCount, setVisibleCount] = useState(pageSize);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const signature = listSignature(items as unknown[]);

    useEffect(() => {
        setVisibleCount(pageSize);
    }, [signature, pageSize]);

    const visibleItems = useMemo(
        () => items.slice(0, visibleCount),
        [items, visibleCount]
    );

    const hasMore = visibleCount < items.length;

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !hasMore) return;

        const root = findScrollRoot(node);
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                setVisibleCount((prev) => {
                    const total = itemsRef.current.length;
                    if (prev >= total) return prev;
                    return Math.min(prev + pageSize, total);
                });
            },
            { root, rootMargin: '180px 0px', threshold: 0 }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, pageSize, visibleCount, signature]);

    return {
        visibleItems,
        sentinelRef,
        hasMore,
        total: items.length,
        visibleCount: Math.min(visibleCount, items.length),
    };
}
