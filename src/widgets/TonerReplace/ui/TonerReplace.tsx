import { useMemo } from 'react';
import cls from './TonerReplace.module.scss';
import TonerPart from '../../../shared/ui/tonerPart/TonerPart';
import { sortAndFilterToners } from '../lib/sortTonersByDate';
import {
    useAppSelector,
    useTonerHistory,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

const TonerReplace = () => {
    const machineTonerState = useAppSelector(
        (state) => state.machines.tonerMachine
    );
    const { tonersArray } = useTonerHistory();

    const sortedToners = useMemo(
        () => sortAndFilterToners(tonersArray, machineTonerState),
        [tonersArray, machineTonerState]
    );
    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(sortedToners);

    return (
        <div className={cls.toners}>
            <div className={cls.box}>
                <p className={cls.color}>Цвет</p>
                <p className={cls.man}>Ответственный</p>
                <p className={cls.date}>Дата</p>
                <p className={cls.delete}>Удалить</p>
            </div>
            {visibleItems.map((item) => (
                <TonerPart
                    color={item.toner.color}
                    man={item.toner.man}
                    date={item.toner.date}
                    id={item.id}
                    key={item.id}
                />
            ))}
            <InfiniteScrollSentinel
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                visibleCount={visibleCount}
                total={total}
            />
        </div>
    );
};

export default TonerReplace;
