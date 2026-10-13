import { useMemo } from 'react';
import cls from './Calendar.module.scss';
import ReplacedPart from '../../shared/ui/replacedPart/ReplacedPart';
import { filteredAndSortedData } from './lib/filteredAndSortedData';
import {
    useAppSelector,
    useParts,
    usePrinters,
    useUsedParts,
} from '../../app/providers/StoreProvider/Store/hooks';
import { filterByMachine } from './lib/filterByMachine';
import { UsedPartData } from '../../services/usedParts';
import { useInfiniteList } from '../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';
import { getModelByPrinterName } from '../../shared/lib/printers/printerUtils';

const Calendar = () => {
    const { usedPartsArray } = useUsedParts();
    const { partsArray } = useParts();
    const { printers } = usePrinters();
    const filterOption = useAppSelector(
        (state) => state.filteredParts.filter.section
    );
    const machineState = useAppSelector((state) => state.machines.machine);

    const machineModel = useMemo(
        () => getModelByPrinterName(printers, machineState),
        [printers, machineState]
    );

    const filterAndSortData = useMemo(() => {
        const filteredDataByMachine = filterByMachine(
            usedPartsArray,
            machineState
        );
        return filteredAndSortedData(
            filteredDataByMachine,
            filterOption,
            partsArray,
            machineModel
        );
    }, [
        usedPartsArray,
        machineState,
        filterOption,
        partsArray,
        machineModel,
    ]);

    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(filterAndSortData);

    return (
        <div className={cls.calendar}>
            <div className={cls.box}>
                <p className={cls.name}>Наименование</p>
                <p className={cls.number}>Парт номер</p>
                <p className={cls.man}>Ответственный</p>
                <p className={cls.qty}>Кол-во</p>
                <p className={cls.res}>Ресурс</p>
                <p className={cls.date}>Дата</p>
                <p className={cls.delete}>Удалить</p>
            </div>
            {visibleItems.length === 0 ? (
                <p className={cls.emptyHint}>
                    {filterOption === 'All'
                        ? 'Нет замен для этого принтера'
                        : `Нет замен в секции «${filterOption}»`}
                </p>
            ) : (
                visibleItems.map((item: UsedPartData) => (
                    <ReplacedPart
                        id={item.id}
                        name={item.part.partName}
                        number={item.part.partN}
                        qty={item.part.quantity}
                        man={item.part.man}
                        date={item.part.date}
                        life={item.part.serviceLife}
                        percent={item.part.percent}
                        key={item.id}
                    />
                ))
            )}
            <InfiniteScrollSentinel
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                visibleCount={visibleCount}
                total={total}
            />
        </div>
    );
};

export default Calendar;
