import { Ref } from 'react';
import cls from './InfiniteScrollSentinel.module.scss';

type Props = {
    sentinelRef: Ref<HTMLDivElement>;
    hasMore: boolean;
    visibleCount: number;
    total: number;
};

const InfiniteScrollSentinel = ({
    sentinelRef,
    hasMore,
    visibleCount,
    total,
}: Props) => {
    if (total <= 0) return null;

    return (
        <>
            {hasMore ? (
                <div ref={sentinelRef} className={cls.sentinel} aria-hidden />
            ) : null}
            {total > visibleCount || visibleCount > 35 ? (
                <p className={cls.hint}>
                    Показано {visibleCount} из {total}
                    {hasMore ? ' · прокрутите ниже' : ''}
                </p>
            ) : null}
        </>
    );
};

export default InfiniteScrollSentinel;
