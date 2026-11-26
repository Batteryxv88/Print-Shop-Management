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

const PART_ROWS = 4;

type PartLine = { partName: string; partN: string; quantity: number };

const partLabel = (part: PartLine) =>
    part.partN ? `${part.partName} · ${part.partN}` : part.partName;

const Field = ({ label, text }: { label: string; text: string }) => (
    <div className={cls.field}>
        <span className={cls.k}>{label}</span>
        <p className={cls.text}>{text}</p>
    </div>
);

const PartRow = ({ part }: { part: PartLine }) => {
    const nameRef = useRef<HTMLSpanElement>(null);
    const [cut, setCut] = useState(false);
    const label = partLabel(part);

    useLayoutEffect(() => {
        const node = nameRef.current;
        if (!node) return;
        const measure = () => setCut(node.scrollWidth > node.clientWidth + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [label]);

    return (
        <li className={cls.partRow}>
            <span ref={nameRef} className={cls.partName}>
                {label}
            </span>
            <span className={cls.partQty}>× {part.quantity}</span>
            {cut && (
                <div className={cls.pop} role="tooltip">
                    {label} × {part.quantity}
                </div>
            )}
        </li>
    );
};

const PartGroup = ({
    title,
    parts,
    quiet,
    wide,
}: {
    title: string;
    parts: PartLine[];
    quiet?: boolean;
    wide?: boolean;
}) => (
    <div className={quiet ? cls.orderGroup : undefined}>
        <span className={cls.k}>{title}</span>
        <ul className={wide ? `${cls.partList} ${cls.partListWide}` : cls.partList}>
            {parts.map((part, index) => (
                <PartRow key={`${part.partN}-${index}`} part={part} />
            ))}
        </ul>
    </div>
);

const PartsBlock = ({
    replaced,
    needed,
    alone,
}: {
    replaced: PartLine[];
    needed: PartLine[];
    alone: boolean;
}) => {
    const total = replaced.length + needed.length;
    const split =
        replaced.length > 0 && needed.length > 0 && total > PART_ROWS;
    const oneGroup = !split;
    const wideList =
        (replaced.length > PART_ROWS && needed.length === 0) ||
        (needed.length > PART_ROWS && replaced.length === 0);
    return (
        <div
            className={[
                cls.parts,
                alone ? cls.partsAlone : '',
                split ? cls.partsSplit : '',
                wideList ? cls.partsWide : '',
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {replaced.length > 0 && (
                <PartGroup
                    title="Списание"
                    parts={replaced}
                    wide={oneGroup && replaced.length > PART_ROWS}
                />
            )}
            {needed.length > 0 && (
                <PartGroup
                    title="Заказ"
                    parts={needed}
                    quiet
                    wide={oneGroup && needed.length > PART_ROWS}
                />
            )}
        </div>
    );
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

    useEffect(() => {
        return subscribeMaintenanceEntries(
            ticket.id,
            pageSize,
            setEntries,
            (err) => setError(err.message)
        );
    }, [ticket.id, pageSize]);

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
                    <ol className={cls.timeline}>
                        {entries.map((entry) => {
                            const counters = fields.filter(
                                (field) => getFieldValue(entry.counters, field.key) > 0
                            );
                            const problem = entry.problem.trim();
                            const workDone = entry.workDone.trim();
                            const notes = entry.notes.trim();
                            const hasText = Boolean(problem || workDone || notes);
                            const hasParts =
                                entry.replacedParts.length > 0 ||
                                entry.neededParts.length > 0;
                            return (
                                <li
                                    key={entry.id}
                                    className={`${cls.event} ${cls[entry.status]}`}
                                >
                                    <article className={cls.card}>
                                        <header className={cls.eventHead}>
                                            <div className={cls.eventMeta}>
                                                <span className={cls.dot} aria-hidden />
                                                <span className={cls.statusName}>
                                                    {maintenanceStatusLabel(entry.status)}
                                                </span>
                                                <span className={cls.when}>
                                                    {formatWhen(entry.date)}
                                                </span>
                                                <span className={cls.man}>
                                                    {entry.man || '—'}
                                                </span>
                                            </div>
                                            {counters.length > 0 && (
                                                <div className={cls.counters}>
                                                    {counters.map((field) => (
                                                        <span
                                                            key={field.key}
                                                            className={cls.counter}
                                                        >
                                                            <span className={cls.counterLabel}>
                                                                {field.label}
                                                            </span>
                                                            <span className={cls.counterValue}>
                                                                {formatLifeWithCommas(
                                                                    getFieldValue(
                                                                        entry.counters,
                                                                        field.key
                                                                    )
                                                                )}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </header>
                                        {(hasText || hasParts) && (
                                            <div className={cls.bodyRow}>
                                                {hasText && (
                                                    <div className={cls.textCol}>
                                                        {workDone && (
                                                            <Field
                                                                label="Выполнено"
                                                                text={workDone}
                                                            />
                                                        )}
                                                        {problem && (
                                                            <Field
                                                                label="Проблема"
                                                                text={problem}
                                                            />
                                                        )}
                                                        {notes && (
                                                            <Field
                                                                label="Замечания"
                                                                text={notes}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                                {hasParts && (
                                                    <PartsBlock
                                                        replaced={entry.replacedParts}
                                                        needed={entry.neededParts}
                                                        alone={!hasText}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </article>
                                </li>
                            );
                        })}
                    </ol>
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
