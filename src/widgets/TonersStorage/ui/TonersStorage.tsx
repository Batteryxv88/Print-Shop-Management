import { useMemo, useState } from 'react';
import cls from './TonersStorage.module.scss';
import {
    useAppSelector,
    useToners,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import TonerStockRow from './TonerStockRow';
import LoadingPlug from '../../../shared/ui/LoadingPlug/LoadingPlug';
import { matchesModel } from '../../../shared/lib/printers/printerUtils';
import { getColorsForModel } from '../../../shared/lib/printers/tonerColors';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

const TonersStorage = () => {
    const { tonersArr } = useToners();
    const { printers } = usePrinters();
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const [search, setSearch] = useState('');

    const modelColors = useMemo(
        () => getColorsForModel(printers, storageModel),
        [printers, storageModel]
    );

    const filteredToners = useMemo(() => {
        const byModel = tonersArr.filter((item) =>
            matchesModel(item.toner?.model, storageModel)
        );

        const ordered: typeof byModel = [];
        modelColors.forEach((color) => {
            const found = byModel.filter((t) => t.toner.color === color);
            ordered.push(...found);
        });
        byModel.forEach((t) => {
            if (!ordered.some((o) => o.id === t.id)) {
                ordered.push(t);
            }
        });

        const q = search.trim().toLowerCase();
        if (!q) return ordered;
        return ordered.filter((item) =>
            String(item.toner?.color || '')
                .toLowerCase()
                .includes(q)
        );
    }, [tonersArr, storageModel, modelColors, search]);

    const totalQty = useMemo(
        () =>
            filteredToners.reduce(
                (sum, item) => sum + (Number(item.toner?.qty) || 0),
                0
            ),
        [filteredToners]
    );

    const emptyQty = useMemo(
        () => filteredToners.filter((item) => Number(item.toner?.qty) <= 0).length,
        [filteredToners]
    );

    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(filteredToners);

    return (
        <div className={cls.tonerStorage}>
            <header className={cls.header}>
                <div className={cls.headerText}>
                    <div className={cls.stats}>
                        <span className={cls.stat}>
                            <b>{filteredToners.length}</b> цветов
                        </span>
                        <span className={cls.statDot} />
                        <span className={cls.stat}>
                            <b>{totalQty}</b> шт.
                        </span>
                        {emptyQty > 0 && (
                            <>
                                <span className={cls.statDot} />
                                <span className={`${cls.stat} ${cls.statWarn}`}>
                                    <b>{emptyQty}</b> без остатка
                                </span>
                            </>
                        )}
                    </div>
                    {modelColors.length > 0 && (
                        <div className={cls.colorChips}>
                            {modelColors.map((color) => (
                                <span key={color} className={cls.colorChip}>
                                    {color}
                                </span>
                            ))}
                        </div>
                    )}
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
                        placeholder="Поиск по цвету…"
                    />
                </label>
            </header>

            <div className={cls.tonersGrid}>
                {tonersArr.length === 0 ? (
                    <LoadingPlug />
                ) : filteredToners.length > 0 ? (
                    <>
                        {visibleItems.map((item) => (
                            <TonerStockRow
                                key={item.id}
                                id={item.id}
                                color={item.toner.color}
                                qty={item.toner.qty}
                                partLabel={
                                    storageModel
                                        ? `${storageModel} · ${item.toner.color}`
                                        : item.toner.color
                                }
                            />
                        ))}
                        <InfiniteScrollSentinel
                            sentinelRef={sentinelRef}
                            hasMore={hasMore}
                            visibleCount={visibleCount}
                            total={total}
                        />
                    </>
                ) : (
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
                                ? 'Попробуйте другой цвет.'
                                : 'Добавьте принтер и цвета в редакторе переменных — склад создастся сам.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TonersStorage;
