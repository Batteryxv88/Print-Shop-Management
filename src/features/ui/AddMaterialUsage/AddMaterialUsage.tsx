import { useMemo, useState } from 'react';
import cls from './AddMaterialUsage.module.scss';
import {
    useMaterials,
    useLaminations,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import { writeOffFifo } from '../../../services/stockAccounting';
import {
    MaterialUsageKind,
    addMaterialUsage,
} from '../../../services/materialUsage';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';

type Props = {
    kind: MaterialUsageKind;
};

const AddMaterialUsage = ({ kind }: Props) => {
    const { userData } = useAuth();
    const { materials } = useMaterials();
    const { laminations } = useLaminations();
    const [stockId, setStockId] = useState('');
    const [qty, setQty] = useState('1');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const options = useMemo(() => {
        if (kind === 'paper') {
            return materials
                .filter((m) => m.status !== 'defective')
                .map((m) => ({
                    id: m.id,
                    label: `${m.name || m.type} (${m.qty})`,
                    qty: Number(m.qty) || 0,
                    name: m.name || m.type,
                }));
        }
        return laminations
            .filter((l) => l.status !== 'defective')
            .map((l) => ({
                id: l.id,
                label: `${l.name || l.type} (${l.qty})`,
                qty: Number(l.qty) || 0,
                name: l.name || l.type,
            }));
    }, [kind, materials, laminations]);

    const handleSubmit = async () => {
        setError('');
        const item = options.find((o) => o.id === stockId);
        const q = Number(qty);
        if (!item) {
            setError('Выберите позицию');
            return;
        }
        if (!(q > 0)) {
            setError('Укажите количество');
            return;
        }
        if (q > item.qty) {
            setError(`Недостаточно на складе (доступно ${item.qty})`);
            return;
        }

        setBusy(true);
        try {
            const date = new Date().toISOString();
            const writeOff = await writeOffFifo({
                type: kind,
                stockId: item.id,
                partName: item.name,
                partN: item.name,
                costCategory: kind === 'paper' ? 'paper' : 'lamination',
                qty: q,
                date,
                man: userData?.displayName || '',
                currentStockQty: item.qty,
            });

            await addMaterialUsage({
                kind,
                stockId: item.id,
                name: item.name,
                qty: q,
                date,
                man: userData?.displayName || '',
                note: note.trim(),
                movementId: writeOff.movementId,
                totalCost: writeOff.totalCost,
                unitPriceAvg: writeOff.unitPriceAvg,
            });

            setStockId('');
            setQty('1');
            setNote('');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={cls.bar}>
            <select
                className={cls.select}
                value={stockId}
                onChange={(e) => setStockId(e.target.value)}
                disabled={busy}
            >
                <option value="">
                    {kind === 'paper' ? 'Бумага…' : 'Ламинация…'}
                </option>
                {options.map((o) => (
                    <option key={o.id} value={o.id}>
                        {o.label}
                    </option>
                ))}
            </select>
            <input
                className={cls.qty}
                type="number"
                min={0}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                disabled={busy}
                aria-label="Количество"
            />
            <input
                className={cls.note}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Примечание"
                disabled={busy}
            />
            <button
                type="button"
                className={cls.btn}
                onClick={handleSubmit}
                disabled={busy}
            >
                {busy ? '…' : 'Списать'}
            </button>

            <NotificationModal
                isOpen={Boolean(error)}
                onClose={() => setError('')}
                title="Не удалось списать"
                message={error}
                type="error"
            />
        </div>
    );
};

export default AddMaterialUsage;
