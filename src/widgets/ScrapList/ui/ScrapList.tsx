import { useEffect, useState } from 'react';
import cls from './ScrapList.module.scss';
import { useAuth } from '../../../contexts/AuthContext';
import {
    reverseStockMovement,
    subscribeScrapMovements,
    type StockMovement,
} from '../../../services/stockAccounting';
import {
    SCRAP_TYPE_LABELS,
    scrapItemLabel,
    type ScrapItemType,
} from '../../../shared/lib/stock/scrapLabels';
import DeleteButton from '../../../shared/ui/DeleteButton/DeleteButton';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

const typeLabel = (type: string) => {
    const key = type as ScrapItemType;
    return SCRAP_TYPE_LABELS[key] || type;
};

const ScrapList = () => {
    const { userData } = useAuth();
    const [items, setItems] = useState<StockMovement[]>([]);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        return subscribeScrapMovements(setItems);
    }, []);

    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(items);

    const handleDelete = async () => {
        if (!confirmId) return;
        setBusy(true);
        try {
            await reverseStockMovement(confirmId, {
                man: userData?.displayName || '',
                reason: 'Сторно списания брака',
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
                <p className={cls.colName}>Наименование</p>
                <p className={cls.colType}>Тип</p>
                <p className={cls.colQty}>Кол-во</p>
                <p className={cls.colAmount}>Сумма</p>
                <p className={cls.colMachine}>Машина</p>
                <p className={cls.colMan}>Ответственный</p>
                <p className={cls.colDate}>Дата</p>
                <p className={cls.colDel}>Удалить</p>
            </div>

            {visibleItems.length === 0 ? (
                <p className={cls.empty}>Списаний брака пока нет</p>
            ) : (
                visibleItems.map((item) => {
                    const d = new Date(item.date);
                    const dateLabel = Number.isNaN(d.getTime())
                        ? item.date
                        : d.toLocaleDateString('ru-RU');
                    const title = scrapItemLabel(
                        item.type,
                        item.partName || item.partN
                    );
                    return (
                        <div key={item.id} className={cls.row}>
                            <div className={cls.colName}>
                                <span className={cls.name}>{title}</span>
                                {item.comment ? (
                                    <span className={cls.sub}>
                                        {item.comment}
                                    </span>
                                ) : null}
                            </div>
                            <p className={cls.colType}>
                                {typeLabel(item.type)}
                            </p>
                            <p className={cls.colQty}>{item.qty}</p>
                            <p className={cls.colAmount}>
                                {Number(item.totalCost || 0).toLocaleString(
                                    'ru-RU',
                                    { maximumFractionDigits: 0 }
                                )}{' '}
                                ₽
                            </p>
                            <p className={cls.colMachine}>
                                {item.machine || '—'}
                            </p>
                            <p className={cls.colMan}>{item.man || '—'}</p>
                            <p className={cls.colDate}>{dateLabel}</p>
                            <div className={cls.colDel}>
                                <DeleteButton
                                    label="Сторнировать брак"
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
                title="Сторнировать брак?"
                message="Количество вернётся на склад (FIFO), сумма уйдёт из «Брак и потери»."
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

export default ScrapList;
