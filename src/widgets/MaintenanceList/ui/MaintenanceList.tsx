import { useEffect, useState } from 'react';
import cls from './MaintenanceList.module.scss';
import Calendar from '../../Calendar/Calendar';
import MaintenanceForm from '../../../features/ui/MaintenanceForm/MaintenanceForm';
import MaintenanceChain from '../../MaintenanceChain';
import { useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';
import {
    MAINTENANCE_STATUSES,
    MAINTENANCE_TYPES,
    maintenanceStatusLabel,
    maintenanceTypeLabel,
    type MaintenanceStatus,
    type MaintenanceType,
} from '../../../shared/lib/maintenance/draft';
import {
    subscribeMaintenanceTickets,
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

type FormState =
    | { mode: 'create'; printerId: string }
    | {
          mode: 'append';
          ticketId: string;
          printerId: string;
          ticketType: MaintenanceType;
      }
    | null;

const MaintenanceList = ({
    onFormOpenChange,
    bindClose,
    onChainOpenChange,
    bindChainClose,
}: {
    onFormOpenChange?: (open: boolean) => void;
    bindClose?: (close: () => void) => void;
    onChainOpenChange?: (open: boolean) => void;
    bindChainClose?: (close: () => void) => void;
}) => {
    const printerId = useAppSelector((state) => state.machines.machine);
    const [type, setType] = useState<MaintenanceType | ''>('');
    const [status, setStatus] = useState<MaintenanceStatus | ''>('');
    const [pageSize, setPageSize] = useState(PAGE);
    const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
    const [error, setError] = useState('');
    const [form, setForm] = useState<FormState>(null);
    const [chain, setChain] = useState<MaintenanceTicket | null>(null);
    const [archiveOpen, setArchiveOpen] = useState(false);

    useEffect(() => {
        onFormOpenChange?.(form !== null);
    }, [form, onFormOpenChange]);

    useEffect(() => {
        bindClose?.(() => setForm(null));
    }, [bindClose]);

    useEffect(() => () => onFormOpenChange?.(false), [onFormOpenChange]);

    useEffect(() => {
        onChainOpenChange?.(chain !== null);
    }, [chain, onChainOpenChange]);

    useEffect(() => {
        bindChainClose?.(() => setChain(null));
    }, [bindChainClose]);

    useEffect(() => () => onChainOpenChange?.(false), [onChainOpenChange]);

    useEffect(() => {
        if (!chain || chain.printerId !== printerId) return;
        const fresh = tickets.find((item) => item.id === chain.id);
        if (fresh && fresh !== chain) setChain(fresh);
    }, [tickets, chain, printerId]);

    useEffect(() => {
        setPageSize(PAGE);
        setChain(null);
    }, [printerId, type, status]);

    useEffect(() => {
        if (!printerId) {
            setTickets([]);
            return;
        }
        return subscribeMaintenanceTickets(
            { printerId, type, status, pageSize },
            setTickets,
            (err) => setError(err.message)
        );
    }, [printerId, type, status, pageSize]);

    return (
        <div
            className={`${cls.list} ${form || chain ? cls.listFill : ''}`}
            data-testid="maintenance-list"
        >
            {form && (
                <MaintenanceForm
                    mode={form.mode}
                    printerId={form.printerId}
                    ticketId={form.mode === 'append' ? form.ticketId : undefined}
                    ticketType={
                        form.mode === 'append' ? form.ticketType : undefined
                    }
                    onClose={() => setForm(null)}
                />
            )}
            {!form && chain && (
                <MaintenanceChain
                    ticket={chain}
                    onClose={() => setChain(null)}
                    onAdd={() =>
                        setForm({
                            mode: 'append',
                            ticketId: chain.id,
                            printerId: chain.printerId,
                            ticketType: chain.type,
                        })
                    }
                />
            )}
            {!form && !chain && (
            <>
            <div className={cls.toolbar}>
                <button
                    type="button"
                    className={cls.primary}
                    data-testid="maintenance-new"
                    disabled={!printerId}
                    onClick={() =>
                        printerId && setForm({ mode: 'create', printerId })
                    }
                >
                    Новая заявка
                </button>
                <div className={cls.filters}>
                <label className={cls.filter}>
                    <span>Тип</span>
                    <select
                        value={type}
                        aria-label="Фильтр по типу"
                        onChange={(e) =>
                            setType(e.target.value as MaintenanceType | '')
                        }
                    >
                        <option value="">Все типы</option>
                        {MAINTENANCE_TYPES.map((item) => (
                            <option key={item} value={item}>
                                {maintenanceTypeLabel(item)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={cls.filter}>
                    <span>Статус</span>
                    <select
                        value={status}
                        aria-label="Фильтр по статусу"
                        onChange={(e) =>
                            setStatus(e.target.value as MaintenanceStatus | '')
                        }
                    >
                        <option value="">Все статусы</option>
                        {MAINTENANCE_STATUSES.map((item) => (
                            <option key={item} value={item}>
                                {maintenanceStatusLabel(item)}
                            </option>
                        ))}
                    </select>
                </label>
                </div>
            </div>

            {error && <p className={cls.error}>{error}</p>}
            {!printerId && <p className={cls.muted}>Выберите принтер</p>}
            {printerId && tickets.length === 0 && !error && (
                <p className={cls.muted}>Нет заявок для этого принтера</p>
            )}

            <div className={cls.rows}>
                {tickets.map((ticket) => (
                    <article className={cls.ticket} key={ticket.id}>
                        <button
                            type="button"
                            className={cls.ticketBtn}
                            onClick={() => setChain(ticket)}
                        >
                            <span className={cls.when}>
                                {formatWhen(ticket.updatedAt)}
                            </span>
                            <span className={cls.type}>
                                {maintenanceTypeLabel(ticket.type)}
                            </span>
                            <span className={`${cls.badge} ${cls[ticket.status]}`}>
                                {maintenanceStatusLabel(ticket.status)}
                            </span>
                            <span className={cls.summary}>
                                {ticket.problemSummary || 'Без описания'}
                            </span>
                            <span className={cls.chevron} aria-hidden>
                                ›
                            </span>
                        </button>
                    </article>
                ))}
            </div>

            {tickets.length >= pageSize && (
                <button
                    type="button"
                    className={cls.more}
                    onClick={() => setPageSize((size) => size + PAGE)}
                >
                    Ещё
                </button>
            )}

            <div className={cls.archive}>
                <button
                    type="button"
                    className={cls.archiveBtn}
                    aria-expanded={archiveOpen}
                    onClick={() => setArchiveOpen((open) => !open)}
                >
                    {archiveOpen ? '▾' : '›'} Прежние замены
                </button>
                {archiveOpen && <Calendar legacyOnly />}
            </div>
            </>
            )}
        </div>
    );
};

export default MaintenanceList;
