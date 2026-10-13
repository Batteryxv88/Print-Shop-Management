import { useEffect, useMemo, useState } from 'react';
import cls from './EngineerServiceList.module.scss';
import { useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import {
    reverseStockMovement,
    subscribeEngineerMovements,
    type StockMovement,
} from '../../../services/stockAccounting';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';
import DeleteButton from '../../../shared/ui/DeleteButton/DeleteButton';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

const formatMoney = (n: number) =>
    `${n.toLocaleString('ru-RU', {
        maximumFractionDigits: 2,
    })} ₽`;

const EngineerServiceList = () => {
    const { userData } = useAuth();
    const machine = useAppSelector((state) => state.machines.machine);
    const [items, setItems] = useState<StockMovement[]>([]);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        return subscribeEngineerMovements(setItems);
    }, []);

    const filtered = useMemo(
        () => items.filter((m) => (m.machine || '').trim() === machine),
        [items, machine]
    );

    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(filtered);

    const handleDelete = async () => {
        if (!confirmId) return;
        setBusy(true);
        try {
            await reverseStockMovement(confirmId, {
                man: userData?.displayName || '',
                reason: 'Сторно вызова инженера',
            });
            setConfirmId(null);
        } catch (err) {
            setConfirmId(null);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={cls.list}>
            <div className={cls.head}>
                <p className={cls.colName}>Комментарий</p>
                <p className={cls.colSupplier}>Подрядчик</p>
                <p className={cls.colAmount}>Сумма</p>
                <p className={cls.colMan}>Ответственный</p>
                <p className={cls.colDate}>Дата</p>
                <p className={cls.colDel}>Удалить</p>
            </div>

            {visibleItems.length === 0 ? (
                <p className={cls.empty}>
                    Нет расходов на инженера для этого принтера
                </p>
            ) : (
                visibleItems.map((item) => {
                    const d = new Date(item.date);
                    const dateLabel = Number.isNaN(d.getTime())
                        ? item.date
                        : d.toLocaleDateString('ru-RU');
                    return (
                        <div key={item.id} className={cls.row}>
                            <div className={cls.colName}>
                                <span className={cls.name}>
                                    {item.comment || 'Вызов инженера'}
                                </span>
                            </div>
                            <p className={cls.colSupplier}>
                                {item.supplier || '—'}
                            </p>
                            <p className={cls.colAmount}>
                                {formatMoney(Number(item.totalCost) || 0)}
                            </p>
                            <p className={cls.colMan}>{item.man || '—'}</p>
                            <p className={cls.colDate}>{dateLabel}</p>
                            <div className={cls.colDel}>
                                <DeleteButton
                                    label="Сторнировать расход"
                                    onClick={() => setConfirmId(item.id)}
                                />
                            </div>
                        </div>
                    );
                })
            )}

            <InfiniteScrollSentinel
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                visibleCount={visibleCount}
                total={total}
            />

            <NotificationModal
                isOpen={Boolean(confirmId)}
                onClose={() => {
                    if (!busy) setConfirmId(null);
                }}
                title="Сторнировать расход?"
                message="Запись пропадёт из журнала и не будет учитываться в аналитике."
                type="warning"
                onConfirm={handleDelete}
                confirmLabel="Сторнировать"
                cancelLabel="Отмена"
                confirmLoading={busy}
            />

            <NotificationModal
                isOpen={Boolean(error)}
                onClose={() => setError('')}
                title="Ошибка"
                message={error}
                type="error"
            />
        </div>
    );
};

export default EngineerServiceList;
