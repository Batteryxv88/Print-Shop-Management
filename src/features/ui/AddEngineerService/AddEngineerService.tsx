import { useEffect, useMemo, useRef, useState } from 'react';
import cls from './AddEngineerService.module.scss';
import {
    useAppSelector,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import {
    fetchKnownSuppliers,
    recordEngineerService,
} from '../../../services/stockAccounting';
import { getModelByPrinterName } from '../../../shared/lib/printers/printerUtils';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';

const todayLocalDate = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const AddEngineerService = () => {
    const { userData } = useAuth();
    const { printers } = usePrinters();
    const machine = useAppSelector((state) => state.machines.machine);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(todayLocalDate);
    const [supplier, setSupplier] = useState('');
    const [comment, setComment] = useState('');
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [suggestOpen, setSuggestOpen] = useState(false);
    const suggestRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchKnownSuppliers()
            .then(setSuppliers)
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (
                suggestRef.current &&
                !suggestRef.current.contains(e.target as Node)
            ) {
                setSuggestOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const suggestions = useMemo(() => {
        const q = supplier.trim().toLowerCase();
        if (!q) return suppliers.slice(0, 8);
        return suppliers
            .filter((s) => s.toLowerCase().includes(q))
            .slice(0, 8);
    }, [supplier, suppliers]);

    const resetForm = () => {
        setAmount('');
        setComment('');
        setSupplier('');
        setDate(todayLocalDate());
        setSuggestOpen(false);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!machine) {
            setError('Выберите принтер');
            return;
        }
        const totalCost = Number(amount);
        if (!(totalCost > 0)) {
            setError('Укажите сумму');
            return;
        }

        setSubmitting(true);
        try {
            const model = getModelByPrinterName(printers, machine) || '';
            const at = date
                ? new Date(`${date}T12:00:00`).toISOString()
                : new Date().toISOString();

            await recordEngineerService({
                machine,
                model,
                totalCost,
                date: at,
                man: userData?.displayName || '',
                supplier: supplier.trim(),
                comment: comment.trim(),
            });
            resetForm();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : 'Не удалось сохранить'
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <form className={cls.bar} onSubmit={onSubmit}>
                <input
                    className={cls.amount}
                    type="number"
                    min={1}
                    step={0.01}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Сумма, ₽"
                    disabled={submitting}
                    required
                    aria-label="Сумма"
                />
                <input
                    className={cls.date}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={submitting}
                    required
                    aria-label="Дата"
                />
                <div className={cls.suggestWrap} ref={suggestRef}>
                    <input
                        className={cls.supplier}
                        value={supplier}
                        autoComplete="off"
                        onChange={(e) => {
                            setSupplier(e.target.value);
                            setSuggestOpen(true);
                        }}
                        onFocus={() => setSuggestOpen(true)}
                        placeholder="Подрядчик"
                        disabled={submitting}
                        aria-label="Подрядчик"
                    />
                    {suggestOpen && suggestions.length > 0 && (
                        <ul className={cls.suggestList}>
                            {suggestions.map((s) => (
                                <li key={s}>
                                    <button
                                        type="button"
                                        className={cls.suggestItem}
                                        onMouseDown={(ev) => ev.preventDefault()}
                                        onClick={() => {
                                            setSupplier(s);
                                            setSuggestOpen(false);
                                        }}
                                    >
                                        {s}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <input
                    className={cls.comment}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Что ремонтировали"
                    disabled={submitting}
                    aria-label="Комментарий"
                />
                <button
                    className={cls.btn}
                    type="submit"
                    disabled={submitting || !machine}
                >
                    {submitting ? '…' : 'Добавить'}
                </button>
            </form>

            <NotificationModal
                isOpen={Boolean(error)}
                onClose={() => setError('')}
                title="Не удалось сохранить"
                message={error}
                type="error"
            />
        </>
    );
};

export default AddEngineerService;
