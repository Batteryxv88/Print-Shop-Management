import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import cls from './Stock.module.scss';
import StockPartRow from './StockPartRow';
import ClearOrderIcon from '../../../shared/assets/icons/clear-order.svg';
import {
    useAppDispatch,
    useAppSelector,
    useParts,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { updateStock } from '../../../app/providers/StoreProvider/Store/PartSlice';
import { matchesModel } from '../../../shared/lib/printers/printerUtils';
import { sortSections } from '../../../shared/lib/printers/sectionOrder';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

const Stock = () => {
    const dispatch = useAppDispatch();
    const { partsArray } = useParts();
    usePrinters();
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const [search, setSearch] = useState('');
    const [clearingOrder, setClearingOrder] = useState(false);
    const [orderHeadPulse, setOrderHeadPulse] = useState(false);
    const [expandedPartId, setExpandedPartId] = useState<string | null>(null);

    const filteredParts = useMemo(() => {
        const byModel = partsArray.filter((item) =>
            matchesModel(item.part?.model, storageModel)
        );
        const q = search.trim().toLowerCase();
        if (!q) return byModel;
        return byModel.filter((item) => {
            const n = String(item.part?.partN || '').toLowerCase();
            const name = String(item.part?.partName || '').toLowerCase();
            return n.includes(q) || name.includes(q);
        });
    }, [partsArray, storageModel, search]);

    const orderedParts = useMemo(() => {
        const sections = sortSections(
            filteredParts.map((item) => item.part?.section || 'Other')
        );
        const result: typeof filteredParts = [];
        sections.forEach((section) => {
            filteredParts.forEach((item) => {
                if ((item.part.section || 'Other') === section) {
                    result.push(item);
                }
            });
        });
        return result;
    }, [filteredParts]);

    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(orderedParts);

    const totalQty = useMemo(
        () =>
            filteredParts.reduce(
                (sum, item) => sum + (Number(item.part?.quantity) || 0),
                0
            ),
        [filteredParts]
    );

    const lowStock = useMemo(
        () =>
            filteredParts.filter((item) => Number(item.part?.quantity) <= 0)
                .length,
        [filteredParts]
    );

    const partsWithOrderQty = useMemo(
        () =>
            filteredParts.filter(
                (item) => (Number(item.part?.orderQty) || 0) > 0
            ),
        [filteredParts]
    );

    const handleClearOrderQty = useCallback(async () => {
        if (partsWithOrderQty.length === 0 || clearingOrder) return;

        setClearingOrder(true);
        try {
            await Promise.all(
                partsWithOrderQty.map((item) =>
                    dispatch(
                        updateStock({
                            id: item.id,
                            part: { orderQty: 0 },
                        })
                    ).unwrap()
                )
            );
            setOrderHeadPulse(true);
            window.setTimeout(() => setOrderHeadPulse(false), 480);
        } catch (err) {
            console.error('Clear orderQty failed:', err);
        } finally {
            setClearingOrder(false);
        }
    }, [partsWithOrderQty, clearingOrder, dispatch]);

    useEffect(() => {
        setExpandedPartId(null);
    }, [storageModel, search]);

    const handleTogglePartRow = useCallback((id: string) => {
        setExpandedPartId((current) => (current === id ? null : id));
    }, []);

    let lastSection = '';

    return (
        <div className={cls.stock} data-testid="stock-root">
            <header className={cls.header}>
                <div className={cls.headerText}>
                    <div className={cls.stats}>
                        <span className={cls.stat}>
                            <b>{filteredParts.length}</b> позиций
                        </span>
                        <span className={cls.statDot} />
                        <span className={cls.stat}>
                            <b>{totalQty}</b> шт. на складе
                        </span>
                        {lowStock > 0 && (
                            <>
                                <span className={cls.statDot} />
                                <span className={`${cls.stat} ${cls.statWarn}`}>
                                    <b>{lowStock}</b> без остатка
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <label className={cls.searchWrap}>
                    <span className={cls.searchIcon} aria-hidden>
                        ⌕
                    </span>
                    <input
                        className={cls.search}
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Артикул или название…"
                        data-testid="stock-search"
                    />
                </label>
            </header>

            {orderedParts.length > 0 && (
                <div className={cls.titleBox}>
                    <p className={cls.name}>Наименование</p>
                    <p className={cls.number}>Парт номер</p>
                    <p className={cls.life}>Ресурс</p>
                    <p className={cls.installed}>В апп.</p>
                    <p className={cls.quantity}>Склад</p>
                    <div
                        className={classNames(
                            cls.orderQtyHead,
                            orderHeadPulse && cls.orderQtyHeadPulse
                        )}
                    >
                        <span>К заказу</span>
                        {partsWithOrderQty.length > 0 ? (
                            <button
                                type="button"
                                className={classNames(
                                    cls.clearOrderBtn,
                                    clearingOrder && cls.clearOrderBtnBusy
                                )}
                                onClick={() => void handleClearOrderQty()}
                                disabled={clearingOrder}
                                title="Сбросить все «К заказу»"
                                aria-label="Сбросить все поля «К заказу» в текущем списке"
                            >
                                <ClearOrderIcon aria-hidden />
                            </button>
                        ) : null}
                    </div>
                </div>
            )}

            {orderedParts.length === 0 ? (
                <div className={cls.emptyCard}>
                    <strong>
                        {search.trim()
                            ? 'Ничего не найдено'
                            : storageModel
                              ? `Пусто для «${storageModel}»`
                              : 'Выберите модель слева'}
                    </strong>
                    <p>
                        {search.trim()
                            ? 'Попробуйте другой артикул или название.'
                            : 'Загрузите Excel в админке или оформите приход новой детали.'}
                    </p>
                </div>
            ) : (
                <>
                    {visibleItems.map((item) => {
                        const section = item.part.section || 'Other';
                        const showHead = section !== lastSection;
                        lastSection = section;
                        const sectionCount = filteredParts.filter(
                            (p) => (p.part.section || 'Other') === section
                        ).length;

                        return (
                            <div key={item.id}>
                                {showHead ? (
                                    <div className={cls.sectionHead}>
                                        <h3 className={cls.title}>{section}</h3>
                                        <span className={cls.sectionCount}>
                                            {sectionCount}
                                        </span>
                                    </div>
                                ) : null}
                                <StockPartRow
                                    id={item.id}
                                    name={item.part.partName}
                                    number={item.part.partN}
                                    qty={item.part.quantity}
                                    partLife={item.part.partLife}
                                    installedQty={item.part.installedQty}
                                    optionModel={item.part.optionModel}
                                    orderQty={item.part.orderQty}
                                    expanded={expandedPartId === item.id}
                                    onToggle={handleTogglePartRow}
                                />
                            </div>
                        );
                    })}
                    <InfiniteScrollSentinel
                        sentinelRef={sentinelRef}
                        hasMore={hasMore}
                        visibleCount={visibleCount}
                        total={total}
                    />
                </>
            )}
        </div>
    );
};

export default Stock;
