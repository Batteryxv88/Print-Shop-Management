import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import cls from './MaintenanceChain.module.scss';
import { usePrinters } from '../../../app/providers/StoreProvider/Store/hooks';
import {
    getCounterFieldsForPrinter,
    getFieldValue,
} from '../../../shared/lib/counterReading/fields';
import { formatLifeWithCommas } from '../../../shared/lib/formatLifeInput';
import {
    maintenanceStatusLabel,
    maintenanceTypeLabel,
} from '../../../shared/lib/maintenance/draft';
import { getPrinterById } from '../../../shared/lib/printers/printerIdentity';
import {
    subscribeMaintenanceEntries,
    type MaintenanceEntry,
    type MaintenanceTicket,
} from '../../../services/maintenance';

const PAGE = 20;

const formatWhen = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

type Segment = { d: string };

const measureSegments = (board: HTMLElement): Segment[] => {
    const tiles = Array.from(board.querySelectorAll<HTMLElement>('[data-tile]'));
    const segments: Segment[] = [];
    for (let i = 0; i < tiles.length - 1; i += 1) {
        const from = tiles[i];
        const to = tiles[i + 1];
        const fromMid = from.offsetTop + from.offsetHeight / 2;
        const sameRow = Math.abs(from.offsetTop - to.offsetTop) < 8;
        if (sameRow) {
            segments.push({
                d: `M ${from.offsetLeft} ${fromMid} L ${to.offsetLeft + to.offsetWidth} ${to.offsetTop + to.offsetHeight / 2}`,
            });
            continue;
        }
        const laneY =
            from.offsetTop +
            from.offsetHeight +
            (to.offsetTop - from.offsetTop - from.offsetHeight) / 2;
        const endX = to.offsetLeft + to.offsetWidth / 2;
        segments.push({
            d: `M ${from.offsetLeft} ${fromMid} H 8 V ${laneY} H ${endX} V ${to.offsetTop}`,
        });
    }
    return segments;
};

const MaintenanceChain = ({
    ticket,
    onClose,
    onAdd,
}: {
    ticket: MaintenanceTicket;
    onClose: () => void;
    onAdd: () => void;
}) => {
    const { printers } = usePrinters();
    const printer = getPrinterById(printers, ticket.printerId);
    const fields = printer
        ? getCounterFieldsForPrinter(printer)
        : [{ key: 'total' as const, label: 'Общий' }];
    const [pageSize, setPageSize] = useState(PAGE);
    const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
    const [error, setError] = useState('');
    const [segments, setSegments] = useState<Segment[]>([]);
    const boardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return subscribeMaintenanceEntries(
            ticket.id,
            pageSize,
            setEntries,
            (err) => setError(err.message)
        );
    }, [ticket.id, pageSize]);

    useLayoutEffect(() => {
        const board = boardRef.current;
        if (!board) return;
        const measure = () => {
            const next = measureSegments(board);
            setSegments((current) => {
                if (
                    current.length === next.length &&
                    current.every((item, index) => item.d === next[index]?.d)
                ) {
                    return current;
                }
                return next;
            });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(board);
        board
            .querySelectorAll<HTMLElement>('[data-tile]')
            .forEach((tile) => observer.observe(tile));
        return () => observer.disconnect();
    }, [entries]);

    return (
        <section className={cls.sheet} data-testid="maintenance-chain">
            <header className={cls.head}>
                <div className={cls.headText}>
                    <div className={cls.headRow}>
                        <span className={cls.type}>
                            {maintenanceTypeLabel(ticket.type)}
                        </span>
                        <span className={`${cls.badge} ${cls[ticket.status]}`}>
                            {maintenanceStatusLabel(ticket.status)}
                        </span>
                    </div>
                    <p className={cls.summary}>
                        {ticket.problemSummary || 'Без описания'}
                    </p>
                </div>
                <div className={cls.actions}>
                    <button type="button" className={cls.back} onClick={onClose}>
                        К списку
                    </button>
                    <button type="button" className={cls.add} onClick={onAdd}>
                        Новая запись
                    </button>
                </div>
            </header>

            <div className={cls.body}>
                {error && <p className={cls.error}>{error}</p>}
                {entries.length === 0 && !error && (
                    <p className={cls.muted}>Записей пока нет</p>
                )}
                {entries.length > 0 && (
                    <div className={cls.board} ref={boardRef}>
                        <svg className={cls.links} aria-hidden>
                            <defs>
                                <marker
                                    id="maintenance-chain-arrow"
                                    markerWidth="8"
                                    markerHeight="8"
                                    refX="7"
                                    refY="4"
                                    orient="auto"
                                >
                                    <path d="M0,0 L8,4 L0,8 Z" className={cls.arrow} />
                                </marker>
                            </defs>
                            {segments.map((segment) => (
                                <path
                                    key={segment.d}
                                    d={segment.d}
                                    className={cls.link}
                                    markerEnd="url(#maintenance-chain-arrow)"
                                />
                            ))}
                        </svg>
                        {entries.map((entry) => {
                            const counters = fields.filter(
                                (field) => getFieldValue(entry.counters, field.key) > 0
                            );
                            const texts = [
                                entry.problem.trim()
                                    ? { label: 'Проблема', value: entry.problem.trim() }
                                    : null,
                                entry.workDone.trim()
                                    ? { label: 'Выполнено', value: entry.workDone.trim() }
                                    : null,
                                entry.notes.trim()
                                    ? { label: 'Замечания', value: entry.notes.trim() }
                                    : null,
                            ].filter(
                                (item): item is { label: string; value: string } =>
                                    item !== null
                            );
                            return (
                                <article
                                    key={entry.id}
                                    className={`${cls.tile} ${cls[entry.status]}`}
                                    data-tile
                                >
                                    <header className={cls.tileHead}>
                                        <span className={cls.status}>
                                            {maintenanceStatusLabel(entry.status)}
                                        </span>
                                        <span className={cls.meta}>
                                            <span className={cls.when}>
                                                {formatWhen(entry.date)}
                                            </span>
                                            <span className={cls.man}>
                                                {entry.man || '—'}
                                            </span>
                                        </span>
                                    </header>
                                    {counters.length > 0 && (
                                        <div className={cls.counters}>
                                            {counters.map((field) => (
                                                <div key={field.key} className={cls.counter}>
                                                    <span className={cls.k}>
                                                        {field.label}
                                                    </span>
                                                    <span>
                                                        {formatLifeWithCommas(
                                                            getFieldValue(
                                                                entry.counters,
                                                                field.key
                                                            )
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {texts.length > 0 && (
                                        <div className={cls.texts}>
                                            {texts.map((item, index) => {
                                                const alone =
                                                    texts.length === 1 ||
                                                    (texts.length % 2 === 1 &&
                                                        index === texts.length - 1);
                                                return (
                                                    <div
                                                        key={item.label}
                                                        className={`${cls.block} ${alone ? cls.blockWide : ''}`}
                                                    >
                                                        <span className={cls.k}>
                                                            {item.label}
                                                        </span>
                                                        <p>{item.value}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {(entry.neededParts.length > 0 ||
                                        entry.replacedParts.length > 0) && (
                                        <div className={cls.partRow}>
                                            {entry.neededParts.length > 0 && (
                                                <div className={cls.block}>
                                                    <span className={cls.k}>Заказ</span>
                                                    {entry.neededParts.map((part, index) => (
                                                        <p
                                                            key={`${part.stockId}-${part.partN}-${index}`}
                                                        >
                                                            {part.partName} · {part.partN} ×{' '}
                                                            {part.quantity}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                            {entry.replacedParts.length > 0 && (
                                                <div className={cls.block}>
                                                    <span className={cls.k}>Списание</span>
                                                    {entry.replacedParts.map((part, index) => (
                                                        <p
                                                            key={`${part.movementId}-${part.partN}-${index}`}
                                                        >
                                                            {part.partName} · {part.partN} ×{' '}
                                                            {part.quantity}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
                {entries.length >= pageSize && (
                    <button
                        type="button"
                        className={cls.more}
                        onClick={() => setPageSize((size) => size + PAGE)}
                    >
                        Более ранние
                    </button>
                )}
            </div>
        </section>
    );
};

export default MaintenanceChain;
