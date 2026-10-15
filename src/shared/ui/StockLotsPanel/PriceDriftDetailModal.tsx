import { useCallback, useEffect, useRef, useState } from 'react';
import cls from './PriceDriftDetailModal.module.scss';
import {
    fetchPriceDriftPage,
    type PriceDriftPoint,
} from '../../../services/stockAccounting';
import {
    formatLotDate,
    formatMoneyRu,
} from '../../lib/stock/formatLotDate';

const PAGE_SIZE = 25;

type Row = PriceDriftPoint & { deltaPct: number | null };

type Props = {
    isOpen: boolean;
    onClose: () => void;
    stockId: string;
};

const PriceDriftDetailModal = ({ isOpen, onClose, stockId }: Props) => {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState('');
    const hasMoreRef = useRef(true);
    const offsetRef = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const prevPriceRef = useRef<number | null>(null);
    const inFlightRef = useRef(false);

    const appendPage = useCallback(
        (points: PriceDriftPoint[], more: boolean) => {
            let prev = prevPriceRef.current;
            const chunk: Row[] = points.map((p) => {
                let deltaPct: number | null = null;
                if (prev != null && prev > 0) {
                    deltaPct = ((p.unitPrice - prev) / prev) * 100;
                }
                prev = p.unitPrice;
                return { ...p, deltaPct };
            });
            prevPriceRef.current = prev;
            setRows((r) => [...r, ...chunk]);
            hasMoreRef.current = more;
            setHasMore(more);
        },
        []
    );

    const loadNext = useCallback(async () => {
        if (!isOpen || !hasMoreRef.current || inFlightRef.current) return;
        inFlightRef.current = true;
        const isFirst = offsetRef.current === 0;
        if (isFirst) setLoading(true);
        else setLoadingMore(true);
        setError('');
        try {
            const page = await fetchPriceDriftPage(
                stockId,
                PAGE_SIZE,
                offsetRef.current
            );
            offsetRef.current = page.nextOffset;
            appendPage(page.points, page.hasMore);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось загрузить приходы'
            );
        } finally {
            inFlightRef.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    }, [appendPage, isOpen, stockId]);

    useEffect(() => {
        if (!isOpen) return;
        setRows([]);
        hasMoreRef.current = true;
        setHasMore(true);
        setError('');
        offsetRef.current = 0;
        prevPriceRef.current = null;
        inFlightRef.current = false;
        void loadNext();
    }, [isOpen, stockId, loadNext]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const root = scrollRef.current;
        const target = sentinelRef.current;
        if (!root || !target) return;
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    void loadNext();
                }
            },
            { root, rootMargin: '120px', threshold: 0 }
        );
        obs.observe(target);
        return () => obs.disconnect();
    }, [isOpen, loadNext, rows.length, hasMore]);

    const formatPct = (n: number | null) => {
        if (n == null || !Number.isFinite(n)) return '—';
        const sign = n > 0 ? '+' : '';
        return `${sign}${n.toFixed(0)}%`;
    };

    if (!isOpen) return null;

    return (
        <div className={cls.overlay} role="presentation" onClick={onClose}>
            <div
                className={cls.modal}
                role="dialog"
                aria-labelledby="price-drift-detail-title"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="price-drift-detail-title" className={cls.title}>
                    Все приходы
                </h2>
                <p className={cls.hint}>
                    Список в порядке поступления. При прокрутке вниз
                    подгружаются следующие строки.
                </p>

                {error ? <p className={cls.error}>{error}</p> : null}

                <div ref={scrollRef} className={cls.scroll}>
                    {loading && rows.length === 0 ? (
                        <p className={cls.status}>Загрузка…</p>
                    ) : rows.length === 0 ? (
                        <p className={cls.status}>Нет приходов</p>
                    ) : (
                        <table className={cls.table}>
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Кол-во</th>
                                    <th>Цена</th>
                                    <th>Δ</th>
                                    <th>Поставщик</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((p) => (
                                    <tr key={p.lotId}>
                                        <td>{formatLotDate(p.purchasedAt)}</td>
                                        <td>
                                            {p.qtyLeft > 0
                                                ? `${p.qtyLeft} / ${p.qtyInitial}`
                                                : `${p.qtyInitial} (закрыта)`}
                                        </td>
                                        <td>
                                            {formatMoneyRu(p.unitPrice)} ₽
                                        </td>
                                        <td
                                            className={
                                                p.deltaPct != null
                                                    ? p.deltaPct > 0
                                                        ? cls.up
                                                        : p.deltaPct < 0
                                                          ? cls.down
                                                          : undefined
                                                    : undefined
                                            }
                                        >
                                            {formatPct(p.deltaPct)}
                                        </td>
                                        <td>{p.supplier?.trim() || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <div ref={sentinelRef} className={cls.sentinel} />
                    {loadingMore ? (
                        <p className={cls.status}>Загрузка…</p>
                    ) : null}
                    {!hasMore && rows.length > 0 ? (
                        <p className={cls.end}>Конец списка</p>
                    ) : null}
                </div>

                <div className={cls.actions}>
                    <button type="button" className={cls.okBtn} onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PriceDriftDetailModal;
