import { useEffect, useRef, useState } from 'react';
import cls from './FifoBreakdownModal.module.scss';
import {
    enrichFifoSlices,
    type EnrichedFifoSlice,
    type FifoLotSlice,
} from '../../../services/stockAccounting';
import {
    formatLotDate,
    formatMoneyRu,
} from '../../lib/stock/formatLotDate';

export type FifoBreakdownModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    qty: number;
    totalCost: number;
    unitPriceAvg: number;
    slices: FifoLotSlice[];
};

const FifoBreakdownModal = ({
    isOpen,
    onClose,
    title,
    subtitle,
    qty,
    totalCost,
    unitPriceAvg,
    slices,
}: FifoBreakdownModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [rows, setRows] = useState<EnrichedFifoSlice[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || slices.length === 0) {
            setRows([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        enrichFifoSlices(slices)
            .then((data) => {
                if (!cancelled) setRows(data);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, slices]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className={cls.overlay} role="presentation">
            <div
                ref={modalRef}
                className={cls.modal}
                role="dialog"
                aria-labelledby="fifo-breakdown-title"
            >
                <h2 id="fifo-breakdown-title" className={cls.title}>
                    {title}
                </h2>
                {subtitle ? <p className={cls.subtitle}>{subtitle}</p> : null}
                <p className={cls.hint}>
                    Списание по FIFO: сначала самая старая партия прихода, затем
                    следующая.
                </p>

                {loading ? (
                    <p className={cls.loading}>Загрузка партий…</p>
                ) : (
                    <div className={cls.tableWrap}>
                        <table className={cls.table}>
                            <thead>
                                <tr>
                                    <th>Приход</th>
                                    <th>Поставщик</th>
                                    <th>Кол-во</th>
                                    <th>Цена</th>
                                    <th>Сумма</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.lotId}>
                                        <td>
                                            {formatLotDate(
                                                r.purchasedAt || ''
                                            )}
                                        </td>
                                        <td>{r.supplier?.trim() || '—'}</td>
                                        <td>{r.qty}</td>
                                        <td>{formatMoneyRu(r.unitPrice)} ₽</td>
                                        <td>{formatMoneyRu(r.cost)} ₽</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2}>
                                        <strong>Итого</strong>
                                    </td>
                                    <td>
                                        <strong>{qty}</strong>
                                    </td>
                                    <td>
                                        <strong>
                                            {formatMoneyRu(unitPriceAvg)} ₽
                                        </strong>
                                        <span className={cls.avgHint}>
                                            {' '}
                                            ср.
                                        </span>
                                    </td>
                                    <td>
                                        <strong>
                                            {formatMoneyRu(totalCost)} ₽
                                        </strong>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                <div className={cls.actions}>
                    <button
                        type="button"
                        className={cls.okBtn}
                        onClick={onClose}
                    >
                        Понятно
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FifoBreakdownModal;
