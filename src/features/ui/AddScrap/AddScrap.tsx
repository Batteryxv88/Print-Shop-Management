import { useMemo, useState } from 'react';
import cls from './AddScrap.module.scss';
import {
    useAppSelector,
    useMaterials,
    useLaminations,
    useParts,
    usePrinters,
    useToners,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import { writeOffFifo } from '../../../services/stockAccounting';
import { inferPartCostCategory } from '../../../shared/lib/stock/costCategory';
import {
    findTonerStock,
    getModelByPrinterName,
    matchesModel,
} from '../../../shared/lib/printers/printerUtils';
import { getColorsForPrinterName } from '../../../shared/lib/printers/tonerColors';
import type { ScrapItemType } from '../../../shared/lib/stock/scrapLabels';
import { SCRAP_TYPE_LABELS } from '../../../shared/lib/stock/scrapLabels';
import PartPicker, {
    type PartPickerOption,
} from '../PurchaseStock/PartPicker';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';

const AddScrap = () => {
    const { userData } = useAuth();
    const { paperStockEnabled, laminationStockEnabled } = useAppSelector(
        (s) => s.appSettings
    );
    const machine = useAppSelector((state) => state.machines.machine);
    const { printers } = usePrinters();
    const { partsArray } = useParts();
    const { tonersArr } = useToners();
    const { materials } = useMaterials();
    const { laminations } = useLaminations();

    const printerModel = getModelByPrinterName(printers, machine);

    const allowedTypes = useMemo(() => {
        const list: ScrapItemType[] = ['part', 'toner'];
        if (paperStockEnabled) list.push('paper');
        if (laminationStockEnabled) list.push('lamination');
        return list;
    }, [paperStockEnabled, laminationStockEnabled]);

    const [itemType, setItemType] = useState<ScrapItemType>('part');
    const [stockId, setStockId] = useState('');
    const [partQuery, setPartQuery] = useState('');
    const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
    const [tonerColor, setTonerColor] = useState('K');
    const [qty, setQty] = useState('1');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const effectiveType = allowedTypes.includes(itemType)
        ? itemType
        : allowedTypes[0];

    const partOptions: PartPickerOption[] = useMemo(
        () =>
            partsArray
                .filter((p) =>
                    matchesModel(p.part?.model, printerModel)
                )
                .filter((p) => Number(p.part?.quantity) > 0)
                .map((p) => ({
                    id: p.id,
                    partN: String(p.part?.partN || ''),
                    partName: String(p.part?.partName || ''),
                    section: String(p.part?.section || 'Other'),
                    qty: Number(p.part?.quantity) || 0,
                }))
                .sort((a, b) => a.partName.localeCompare(b.partName, 'ru')),
        [partsArray, printerModel]
    );

    const tonerColors = useMemo(
        () => getColorsForPrinterName(printers, machine),
        [printers, machine]
    );

    const materialOptions = useMemo(() => {
        if (effectiveType === 'paper') {
            return materials
                .filter((m) => Number(m.qty) > 0)
                .map((m) => ({
                    id: m.id,
                    label: `${m.name || m.type} (${m.qty})${m.status === 'defective' ? ' · брак' : ''}`,
                    qty: Number(m.qty) || 0,
                    name: m.name || m.type,
                }));
        }
        if (effectiveType === 'lamination') {
            return laminations
                .filter((l) => Number(l.qty) > 0)
                .map((l) => ({
                    id: l.id,
                    label: `${l.name || l.type} (${l.qty})${l.status === 'defective' ? ' · брак' : ''}`,
                    qty: Number(l.qty) || 0,
                    name: l.name || l.type,
                }));
        }
        return [];
    }, [effectiveType, materials, laminations]);

    const resetItemFields = () => {
        setStockId('');
        setPartQuery('');
        setSelectedPartId(null);
        setQty('1');
    };

    const onTypeChange = (t: ScrapItemType) => {
        setItemType(t);
        resetItemFields();
        setError('');
    };

    const handleSubmit = async () => {
        setError('');
        const q = Number(qty);
        if (!(q > 0)) {
            setError('Укажите количество');
            return;
        }

        const man = userData?.displayName || '';
        const date = new Date().toISOString();
        const machineOpt = machine?.trim() || '';
        const comment = note.trim();

        setBusy(true);
        try {
            if (effectiveType === 'part') {
                const part =
                    partOptions.find((p) => p.id === selectedPartId) ||
                    partOptions.find(
                        (p) =>
                            p.partN.toLowerCase() ===
                            partQuery.trim().toLowerCase()
                    );
                if (!part) {
                    setError('Выберите деталь со склада');
                    return;
                }
                const row = partsArray.find((p) => p.id === part.id);
                if (!row) {
                    setError('Позиция не найдена');
                    return;
                }
                await writeOffFifo({
                    type: 'part',
                    stockId: part.id,
                    partN: part.partN,
                    partName: part.partName,
                    model: row.part.model || printerModel || '',
                    costCategory: inferPartCostCategory(row.part || {}),
                    qty: q,
                    date,
                    machine: machineOpt,
                    man,
                    currentStockQty: part.qty,
                    writeoffReason: 'scrap',
                    comment,
                });
            } else if (effectiveType === 'toner') {
                const color = tonerColor || tonerColors[0] || 'K';
                const stockToner = findTonerStock(
                    tonersArr,
                    color,
                    printerModel
                );
                if (!stockToner) {
                    setError(
                        `Тонер «${color}» не найден на складе модели «${printerModel || '—'}»`
                    );
                    return;
                }
                if (q !== 1) {
                    setError('Тонер списывается по 1 шт.');
                    return;
                }
                await writeOffFifo({
                    type: 'toner',
                    stockId: stockToner.id,
                    color,
                    model: stockToner.toner.model || printerModel || '',
                    costCategory: 'toner',
                    qty: 1,
                    date,
                    machine: machineOpt,
                    man,
                    currentStockQty: Number(stockToner.toner.qty) || 0,
                    writeoffReason: 'scrap',
                    comment,
                });
            } else if (
                effectiveType === 'paper' ||
                effectiveType === 'lamination'
            ) {
                const item = materialOptions.find((o) => o.id === stockId);
                if (!item) {
                    setError('Выберите позицию');
                    return;
                }
                if (q > item.qty) {
                    setError(`Недостаточно на складе (доступно ${item.qty})`);
                    return;
                }
                await writeOffFifo({
                    type: effectiveType,
                    stockId: item.id,
                    partName: item.name,
                    partN: item.name,
                    costCategory: effectiveType,
                    qty: q,
                    date,
                    man,
                    currentStockQty: item.qty,
                    writeoffReason: 'scrap',
                    comment,
                });
            }

            setNote('');
            resetItemFields();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className={cls.bar}>
                <p className={cls.hint}>
                    Брак списывается со склада по FIFO, но{' '}
                    <b>не попадает</b> в «Потрачено» принтера и не портит ₽/клик.
                    Принтер сверху — только «где обнаружено», необязательно.
                </p>

                <select
                    className={`${cls.select} ${cls.typeSelect}`}
                    value={effectiveType}
                    onChange={(e) =>
                        onTypeChange(e.target.value as ScrapItemType)
                    }
                    disabled={busy}
                    aria-label="Тип брака"
                >
                    {allowedTypes.map((t) => (
                        <option key={t} value={t}>
                            {SCRAP_TYPE_LABELS[t]}
                        </option>
                    ))}
                </select>

                {effectiveType === 'part' && (
                    <div className={cls.partWrap}>
                        <PartPicker
                            query={partQuery}
                            onQueryChange={setPartQuery}
                            options={partOptions}
                            selectedId={selectedPartId}
                            onSelect={(opt) => {
                                setSelectedPartId(opt.id);
                                setPartQuery(opt.partN);
                            }}
                        />
                    </div>
                )}

                {effectiveType === 'toner' && (
                    <select
                        className={`${cls.select} ${cls.itemSelect}`}
                        value={tonerColor}
                        onChange={(e) => setTonerColor(e.target.value)}
                        disabled={busy}
                        aria-label="Цвет тонера"
                    >
                        {(tonerColors.length ? tonerColors : ['K']).map(
                            (c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            )
                        )}
                    </select>
                )}

                {(effectiveType === 'paper' ||
                    effectiveType === 'lamination') && (
                    <select
                        className={`${cls.select} ${cls.itemSelect}`}
                        value={stockId}
                        onChange={(e) => setStockId(e.target.value)}
                        disabled={busy}
                    >
                        <option value="">Позиция…</option>
                        {materialOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                )}

                <input
                    className={cls.qty}
                    type="number"
                    min={1}
                    step={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    disabled={busy || effectiveType === 'toner'}
                    aria-label="Количество"
                />

                <input
                    className={cls.note}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Причина / рекламация"
                    disabled={busy}
                />

                <button
                    type="button"
                    className={cls.btn}
                    onClick={handleSubmit}
                    disabled={busy}
                >
                    {busy ? '…' : 'Списать брак'}
                </button>
            </div>

            <NotificationModal
                isOpen={Boolean(error)}
                onClose={() => setError('')}
                title="Не удалось списать"
                message={error}
                type="error"
            />
        </>
    );
};

export default AddScrap;
