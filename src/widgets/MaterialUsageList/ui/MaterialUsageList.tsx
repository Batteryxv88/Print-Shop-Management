import { useEffect, useMemo, useState } from 'react';
import cls from './MaterialUsageList.module.scss';
import {
    MaterialUsage,
    MaterialUsageKind,
    deleteMaterialUsage,
    subscribeMaterialUsages,
} from '../../../services/materialUsage';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';
import DeleteButton from '../../../shared/ui/DeleteButton/DeleteButton';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

type Props = { kind: MaterialUsageKind };

const MaterialUsageList = ({ kind }: Props) => {
    const [items, setItems] = useState<MaterialUsage[]>([]);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        return subscribeMaterialUsages(setItems);
    }, []);

    const filtered = useMemo(
        () => items.filter((i) => i.kind === kind),
        [items, kind]
    );

    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(filtered);

    const handleDelete = async () => {
        if (!confirmId) return;
        setBusy(true);
        try {
            await deleteMaterialUsage(confirmId);
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
                <p className={cls.colQty}>Кол-во</p>
                <p className={cls.colMan}>Ответственный</p>
                <p className={cls.colDate}>Дата</p>
                <p className={cls.colDel}>Удалить</p>
            </div>

            {visibleItems.length === 0 ? (
                <p className={cls.empty}>Пока нет списаний</p>
            ) : (
                visibleItems.map((item) => {
                    const d = new Date(item.date);
                    const dateLabel = Number.isNaN(d.getTime())
                        ? item.date
                        : d.toLocaleDateString('ru-RU');
                    return (
                        <div key={item.id} className={cls.row}>
                            <div className={cls.colName}>
                                <span className={cls.name}>{item.name}</span>
                                {item.note && (
                                    <span
                                        className={cls.note}
                                        title={item.note}
                                    >
                                        {item.note}
                                    </span>
                                )}
                            </div>
                            <p className={cls.colQty}>{item.qty}</p>
                            <p className={cls.colMan}>{item.man || '—'}</p>
                            <p className={cls.colDate}>{dateLabel}</p>
                            <div className={cls.colDel}>
                                <DeleteButton
                                    label="Сторнировать списание"
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
                title="Сторнировать списание?"
                message="Количество вернётся на склад через FIFO-сторно, запись исчезнет из журнала."
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

export default MaterialUsageList;
