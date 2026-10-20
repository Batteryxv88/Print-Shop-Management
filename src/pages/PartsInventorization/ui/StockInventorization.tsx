import cls from './PartsInventorization.module.scss';
import AuditHeader from './components/AuditHeader';
import ScanInput from './components/ScanInput';
import PartInventoryScan from './components/PartInventoryScan';
import type { PartPickerOption } from '../../../features/ui/PurchaseStock/PartPicker';
import AuditTable from './components/AuditTable';
import AuditFooter from './components/AuditFooter';
import AuditLog, { AuditLogEntry } from './components/AuditLog';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    useAppDispatch,
    useAppSelector,
    useLaminations,
    useMaterials,
    useParts,
    useToners,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { AuditItem } from './components/AuditTable';
import { matchesModel } from '../../../shared/lib/printers/printerUtils';
import { useAuth } from '../../../contexts/AuthContext';
import {
    applyStockInventoryLines,
    type StockInventoryItemType,
    type StockInventoryLine,
} from '../../../services/stockAccounting';
import {
    inventorySessionId,
    loadInventorySession,
    markInventoryCompleted,
    saveInventoryDraft,
} from '../../../services/inventorySessions';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';
import {
    inferPartCostCategory,
    type CostCategory,
} from '../../../shared/lib/stock/costCategory';
import { setStorageInventorizationOpen } from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';

type InventoryRow = AuditItem & {
    inventoryType: StockInventoryItemType;
    model?: string;
    color?: string;
    costCategory?: CostCategory;
    partLife?: string | number;
};

type CatalogEntry = {
    id: string;
    scanKeys: string[];
    partN: string;
    partName: string;
    section?: string;
    expectedQty: number;
    model?: string;
    color?: string;
    costCategory?: CostCategory;
    partLife?: string | number;
};

const KIND_LABEL: Record<StockInventoryItemType, string> = {
    part: 'Детали',
    toner: 'Тонеры',
    paper: 'Бумага',
    lamination: 'Ламинация',
};

export type StockInventorizationProps = {
    kind: StockInventoryItemType;
};

const StockInventorization = ({ kind }: StockInventorizationProps) => {
    const dispatch = useAppDispatch();
    const storageModel = useAppSelector(
        (state) => state.machines.storageModel
    );
    const { partsArray } = useParts(kind === 'part');
    const { tonersArr } = useToners(kind === 'toner');
    const { materials } = useMaterials(kind === 'paper');
    const { laminations } = useLaminations(kind === 'lamination');
    const { user, userData } = useAuth();

    const [items, setItems] = useState<InventoryRow[]>([]);
    const [logEntries, setLogEntries] = useState<AuditLogEntry[]>([]);
    const [busy, setBusy] = useState(false);
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'info' | 'warning' | 'error' | 'success';
    }>({ isOpen: false, title: '', message: '', type: 'info' });

    const needsModel = kind === 'part' || kind === 'toner';
    const scopeKey = needsModel ? storageModel || 'no-model' : kind;

    const catalog = useMemo((): CatalogEntry[] => {
        if (kind === 'part') {
            return partsArray
                .filter((p) => matchesModel(p.part?.model, storageModel))
                .map((p) => ({
                    id: p.id!,
                    scanKeys: [p.part.partN],
                    partN: p.part.partN,
                    partName: p.part.partName,
                    section: String(p.part.section || ''),
                    expectedQty: p.part.quantity,
                    model: p.part.model,
                    costCategory: inferPartCostCategory(p.part),
                    partLife: p.part.partLife,
                }));
        }
        if (kind === 'toner') {
            return tonersArr
                .filter((t) => matchesModel(t.toner?.model, storageModel))
                .map((t) => ({
                    id: t.id!,
                    scanKeys: [t.toner.color, t.id || ''].filter(Boolean),
                    partN: t.toner.color,
                    partName: `Тонер ${t.toner.color}${t.toner.model ? ` · ${t.toner.model}` : ''}`,
                    expectedQty: Number(t.toner.qty) || 0,
                    model: t.toner.model,
                    color: t.toner.color,
                    costCategory: 'toner' as CostCategory,
                }));
        }
        if (kind === 'paper') {
            return materials
                .filter((m) => m.status !== 'defective')
                .map((m) => ({
                    id: m.id,
                    scanKeys: [m.type, m.name].filter(Boolean),
                    partN: m.type,
                    partName: m.name || m.type,
                    expectedQty: m.qty,
                }));
        }
        return laminations
            .filter((l) => l.status !== 'defective')
            .map((l) => ({
                id: l.id,
                scanKeys: [l.type, l.name].filter(Boolean),
                partN: l.type,
                partName: l.name || l.type,
                expectedQty: l.qty,
            }));
    }, [
        kind,
        partsArray,
        tonersArr,
        materials,
        laminations,
        storageModel,
    ]);

    const partPickerOptions = useMemo((): PartPickerOption[] => {
        if (kind !== 'part') return [];
        return catalog.map((entry) => ({
            id: entry.id,
            partN: entry.partN,
            partName: entry.partName,
            section: entry.section || '',
            qty: entry.expectedQty,
        }));
    }, [catalog, kind]);

    const sessionId = useMemo(() => {
        if (!user?.uid) return '';
        return inventorySessionId(user.uid, kind, scopeKey);
    }, [user?.uid, kind, scopeKey]);

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleString();
        setLogEntries((prev) => [...prev, { timestamp, message }]);
    }, []);

    useEffect(() => {
        setItems([]);
        setLogEntries([]);
    }, [kind, scopeKey]);

    useEffect(() => {
        if (!sessionId) return;
        let cancelled = false;
        void loadInventorySession(sessionId).then((doc) => {
            if (cancelled || !doc || doc.status !== 'draft') return;
            if (doc.model !== scopeKey) return;
            setItems(doc.lines as InventoryRow[]);
            setLogEntries(
                doc.logMessages.map((message) => ({
                    timestamp: '',
                    message,
                }))
            );
            addLog('Черновик загружен');
        });
        return () => {
            cancelled = true;
        };
    }, [sessionId, scopeKey, addLog]);

    const findInCatalog = (raw: string): CatalogEntry | undefined => {
        const q = raw.trim().toLowerCase();
        if (!q) return undefined;
        return catalog.find((entry) =>
            entry.scanKeys.some(
                (key) =>
                    key.toLowerCase() === q ||
                    key.toLowerCase().includes(q) ||
                    entry.partName.toLowerCase().includes(q)
            )
        );
    };

    const handleScan = (code: string) => {
        const found = findInCatalog(code);
        if (!found) {
            setNotification({
                isOpen: true,
                title: 'Не найдено',
                message:
                    kind === 'part' || kind === 'toner'
                        ? 'Позиция не найдена для выбранной модели. Проверьте код и вкладку модели.'
                        : 'Позиция не найдена на складе. Проверьте код или название.',
                type: 'warning',
            });
            return;
        }
        if (items.some((i) => i.id === found.id)) return;

        setItems((prev) => [
            ...prev,
            {
                id: found.id,
                partN: found.partN,
                partName: found.partName,
                expectedQty: found.expectedQty,
                actualQty: found.expectedQty,
                units: 'шт.',
                inventoryType: kind,
                model: found.model,
                color: found.color,
                costCategory: found.costCategory,
                partLife: found.partLife,
            },
        ]);
        addLog(`Добавлена позиция: ${found.partN}`);
    };

    const handleActualChange = (id: string, newActual: number) => {
        setItems((prev) =>
            prev.map((i) =>
                i.id === id ? { ...i, actualQty: newActual } : i
            )
        );
    };

    const handleRestartCount = (id: string) => {
        setItems((prev) =>
            prev.map((i) =>
                i.id === id ? { ...i, actualQty: i.expectedQty } : i
            )
        );
        addLog(`Сброшен пересчёт для ${id}`);
    };

    const toInventoryLines = (): StockInventoryLine[] =>
        items.map((i) => ({
            type: kind,
            stockId: i.id,
            partN: i.partN,
            partName: i.partName,
            model: i.model || (needsModel ? storageModel : ''),
            color: i.color,
            costCategory: i.costCategory,
            partLife: i.partLife,
            expectedQty: i.expectedQty,
            actualQty: i.actualQty,
        }));

    const handleSave = async () => {
        if (!sessionId || !user?.uid) return;
        setBusy(true);
        try {
            await saveInventoryDraft(sessionId, {
                model: scopeKey,
                createdBy: user.uid,
                createdByName: userData?.displayName || user.email || '',
                lines: items,
                logMessages: logEntries.map(
                    (e) => `${e.timestamp} ${e.message}`.trim()
                ),
            });
            addLog('Черновик сохранён');
            setNotification({
                isOpen: true,
                title: 'Сохранено',
                message: 'Черновик инвентаризации сохранён в облаке.',
                type: 'success',
            });
        } catch (err) {
            setNotification({
                isOpen: true,
                title: 'Ошибка',
                message:
                    err instanceof Error
                        ? err.message
                        : 'Не удалось сохранить черновик',
                type: 'error',
            });
        } finally {
            setBusy(false);
        }
    };

    const handleFinish = async () => {
        if (!user?.uid) return;
        const lines = toInventoryLines();
        const withDelta = lines.filter(
            (l) => l.actualQty !== l.expectedQty
        );
        if (withDelta.length === 0) {
            setNotification({
                isOpen: true,
                title: 'Нет расхождений',
                message:
                    'Нет строк с отличиями факта от учёта. Добавьте позиции и укажите фактическое количество.',
                type: 'info',
            });
            return;
        }

        const ok = window.confirm(
            `Провести инвентаризацию (${KIND_LABEL[kind]}) по ${withDelta.length} позициям с расхождениями? Остатки будут скорректированы.`
        );
        if (!ok) return;

        setBusy(true);
        try {
            const result = await applyStockInventoryLines(withDelta, {
                createdBy: userData?.displayName || user.email || user.uid,
                model: needsModel ? storageModel : undefined,
            });

            if (sessionId) {
                await markInventoryCompleted(sessionId, {
                    model: scopeKey,
                    createdBy: user.uid,
                    createdByName: userData?.displayName || '',
                    lines: items,
                    logMessages: logEntries.map(
                        (e) => `${e.timestamp} ${e.message}`.trim()
                    ),
                });
            }

            addLog(
                `Проведено: ${result.applied}, без изменений: ${result.unchanged}`
            );
            if (result.errors.length) {
                addLog(`Ошибки: ${result.errors.join('; ')}`);
            }

            setNotification({
                isOpen: true,
                title: result.errors.length ? 'Частично проведено' : 'Готово',
                message: result.errors.length
                    ? `Успешно: ${result.applied}. Ошибки:\n${result.errors.join('\n')}`
                    : `Склад обновлён по ${result.applied} позициям.`,
                type: result.errors.length ? 'warning' : 'success',
            });

            setItems((prev) =>
                prev.map((row) => ({
                    ...row,
                    expectedQty: row.actualQty,
                }))
            );
        } catch (err) {
            setNotification({
                isOpen: true,
                title: 'Ошибка',
                message:
                    err instanceof Error
                        ? err.message
                        : 'Не удалось провести инвентаризацию',
                type: 'error',
            });
        } finally {
            setBusy(false);
        }
    };

    const handleExport = (format: 'CSV' | 'PDF') => {
        addLog(`Экспорт формата: ${format}`);
        if (format === 'CSV') {
            const header = [
                'Код',
                'Наименование',
                'Ожидаемое',
                'Фактическое',
                'Разница',
                'Ед. изм.',
            ];
            const rows = items.map((i) => [
                i.partN,
                i.partName,
                String(i.expectedQty),
                String(i.actualQty),
                String(i.actualQty - i.expectedQty),
                i.units,
            ]);
            const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventory-${kind}-${scopeKey}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'PDF') {
            window.print();
        }
    };

    const scanPlaceholder =
        kind === 'part'
            ? 'Артикул детали или скан'
            : kind === 'toner'
              ? 'Цвет тонера (C, M, Y, K…) или скан'
              : 'Код или название материала';

    if (needsModel && !storageModel) {
        return (
            <div
                className={cls.partsInventorization}
                data-testid="inventorization-root"
                data-inventory-kind={kind}
            >
                <p className={cls.hint}>
                    Выберите модель принтера выше, чтобы начать инвентаризацию{' '}
                    {KIND_LABEL[kind].toLowerCase()}.
                </p>
            </div>
        );
    }

    return (
        <div
            className={cls.partsInventorization}
            data-testid="inventorization-root"
            data-inventory-kind={kind}
        >
            <AuditHeader
                model={needsModel ? storageModel : undefined}
                sectionLabel={KIND_LABEL[kind]}
                onClose={() => dispatch(setStorageInventorizationOpen(false))}
            />

            <div className={cls.scanSticky}>
                {kind === 'part' ? (
                    <PartInventoryScan
                        options={partPickerOptions}
                        onAdd={handleScan}
                    />
                ) : (
                    <ScanInput
                        placeholder={scanPlaceholder}
                        onPartScan={handleScan}
                        onManualEntry={handleScan}
                    />
                )}
            </div>

            <AuditTable
                data={items}
                onActualChange={handleActualChange}
                onRestartCount={handleRestartCount}
            />

            <AuditLog entries={logEntries} />

            <AuditFooter
                scannedCount={items.length}
                totalCount={catalog.length}
                onSave={() => void handleSave()}
                onFinish={() => void handleFinish()}
                exportOptions={['CSV', 'PDF']}
                onExport={handleExport}
                disabled={busy}
            />

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() =>
                    setNotification((p) => ({ ...p, isOpen: false }))
                }
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </div>
    );
};

export default StockInventorization;
