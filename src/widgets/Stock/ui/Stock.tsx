import { useMemo, useState } from 'react';
import cls from './Stock.module.scss';
import Part from '../../../shared/ui/Part/Part';
import {
    useAppSelector,
    useParts,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { matchesModel } from '../../../shared/lib/printers/printerUtils';
import { sortSections } from '../../../shared/lib/printers/sectionOrder';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

const Stock = () => {
    const { partsArray } = useParts();
    usePrinters();
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const [search, setSearch] = useState('');

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

    let lastSection = '';

    return (
        <div className={cls.stock}>
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
                    />
                </label>
            </header>

            {orderedParts.length > 0 && (
                <div className={cls.titleBox} aria-hidden>
                    <p className={cls.name}>Наименование</p>
                    <p className={cls.number}>Парт номер</p>
                    <p className={cls.life}>Ресурс</p>
                    <p className={cls.installed}>В апп.</p>
                    <p className={cls.quantity}>Склад</p>
                    <p className={cls.orderQty}>К заказу</p>
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
                                <Part
                                    name={item.part.partName}
                                    number={item.part.partN}
                                    qty={item.part.quantity}
                                    partLife={item.part.partLife}
                                    installedQty={item.part.installedQty}
                                    optionModel={item.part.optionModel}
                                    orderQty={item.part.orderQty}
                                    id={item.id}
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
