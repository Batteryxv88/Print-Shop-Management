import { useEffect, useMemo, useState } from 'react';
import cls from './PriceDriftModal.module.scss';
import {
    fetchPriceDriftRecent,
    type PriceDriftPoint,
} from '../../../services/stockAccounting';
import { formatLotDate } from '../../lib/stock/formatLotDate';
import PriceDriftChart from './PriceDriftChart';
import PriceDriftDetailModal from './PriceDriftDetailModal';

const CHART_LOTS = 10;

type Props = {
    isOpen: boolean;
    onClose: () => void;
    stockId: string;
    title?: string;
};

const PriceDriftModal = ({ isOpen, onClose, stockId, title }: Props) => {
    const [points, setPoints] = useState<PriceDriftPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [allOpen, setAllOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        setPoints([]);
        fetchPriceDriftRecent(stockId, CHART_LOTS)
            .then((data) => {
                if (!cancelled) setPoints(data);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Не удалось загрузить дрейф цены'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, stockId]);

    useEffect(() => {
        if (!isOpen) setAllOpen(false);
    }, [isOpen]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !allOpen) onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, allOpen, onClose]);

    const chartPoints = useMemo(
        () =>
            points.map((p) => ({
                key: p.lotId,
                label: formatLotDate(p.purchasedAt),
                purchasedAt: p.purchasedAt,
                unitPrice: p.unitPrice,
            })),
        [points]
    );

    if (!isOpen) return null;

    return (
        <>
            <div
                className={cls.overlay}
                role="presentation"
                onClick={onClose}
            >
                <div
                    className={cls.modal}
                    role="dialog"
                    aria-labelledby="price-drift-title"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 id="price-drift-title" className={cls.title}>
                        Дрейф цены
                    </h2>
                    {title ? (
                        <p className={cls.subtitle}>{title}</p>
                    ) : null}
                    <p className={cls.hint}>
                        Последние {CHART_LOTS} приходов. Наведите на точку —
                        детали в строке под графиком.
                    </p>

                    {loading ? (
                        <p className={cls.status}>Загрузка…</p>
                    ) : error ? (
                        <p className={cls.error}>{error}</p>
                    ) : points.length === 0 ? (
                        <p className={cls.status}>
                            Нет истории приходов — дрейф появится после первой
                            закупки.
                        </p>
                    ) : (
                        <div className={cls.chartWrap}>
                            <PriceDriftChart
                                points={chartPoints}
                                size="modal"
                            />
                        </div>
                    )}

                    <div className={cls.actions}>
                        <button
                            type="button"
                            className={cls.secondaryBtn}
                            disabled={points.length === 0}
                            onClick={() => setAllOpen(true)}
                        >
                            Все приходы
                        </button>
                        <button
                            type="button"
                            className={cls.okBtn}
                            onClick={onClose}
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>

            <PriceDriftDetailModal
                isOpen={allOpen}
                onClose={() => setAllOpen(false)}
                stockId={stockId}
            />
        </>
    );
};

export default PriceDriftModal;
