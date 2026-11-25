import { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import cls from './Stock.module.scss';
import StockPartRow from './StockPartRow';
import ClearOrderIcon from '../../../shared/assets/icons/clear-order.svg';
import {
    useAppDispatch,
    useAppSelector,
    useParts,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { updateStock } from '../../../app/providers/StoreProvider/Store/PartSlice';
import type {
    AssemblyLine,
    AssemblyRole,
} from '../../../shared/lib/printers/collapsePartNames';
import { matchesModel } from '../../../shared/lib/printers/printerUtils';
import { sortSections } from '../../../shared/lib/printers/sectionOrder';
import { useInfiniteList } from '../../../shared/lib/hooks/useInfiniteList';
import InfiniteScrollSentinel from '../../../shared/ui/InfiniteScrollSentinel/InfiniteScrollSentinel';

type StockLine = {
    key: string;
    stockId: string;
    section: string;
    name: string;
    number: string;
    qty: number;
    partLife?: string | number;
    installedQty?: number;
    optionModel?: string;
    orderQty?: number;
    hideOrder: boolean;
    assemblyCode?: string;
    assemblyRole?: AssemblyRole;
};

/** Main одного узла стоят сверху, spoof сразу под ними, на месте main. */
const groupAssemblyLines = (lines: StockLine[]): StockLine[] => {
    const anchorSection = new Map<string, string>();
    lines.forEach((line) => {
        if (!line.assemblyCode || line.assemblyRole !== 'main') return;
        if (!anchorSection.has(line.assemblyCode)) {
            anchorSection.set(line.assemblyCode, line.section);
        }
    });
    lines.forEach((line) => {
        if (!line.assemblyCode || anchorSection.has(line.assemblyCode)) return;
        anchorSection.set(line.assemblyCode, line.section);
    });

    const placed = lines.map((line) => {
        if (!line.assemblyCode) return line;
        const section = anchorSection.get(line.assemblyCode);
        return section ? { ...line, section } : line;
    });

    const sections = sortSections(placed.map((line) => line.section));
    const ordered: StockLine[] = [];
    sections.forEach((section) => {
        const inSection = placed.filter((line) => line.section === section);
        const grouped = new Map<
            string,
            { anchor: number; mains: StockLine[]; spoofs: StockLine[] }
        >();
        inSection.forEach((line, index) => {
            if (!line.assemblyCode) return;
            let group = grouped.get(line.assemblyCode);
            if (!group) {
                group = { anchor: index, mains: [], spoofs: [] };
                grouped.set(line.assemblyCode, group);
            }
            if (line.assemblyRole === 'main') {
                group.mains.push(line);
                if (group.mains.length === 1) group.anchor = index;
            } else {
                group.spoofs.push(line);
            }
        });
        const emitted = new Set<string>();
        inSection.forEach((line, index) => {
            if (!line.assemblyCode) {
                ordered.push(line);
                return;
            }
            const group = grouped.get(line.assemblyCode);
            if (!group || index !== group.anchor || emitted.has(line.assemblyCode)) {
                return;
            }
            emitted.add(line.assemblyCode);
            group.mains.forEach((item) => ordered.push(item));
            group.spoofs.forEach((item) => ordered.push(item));
        });
    });
    return ordered;
};

const stockBlocks = (lines: StockLine[]) => {
    const blocks: { key: string; section: string; lines: StockLine[] }[] = [];
    lines.forEach((line) => {
        const section = line.section || 'Other';
        const prev = blocks[blocks.length - 1];
        if (
            line.assemblyCode &&
            prev &&
            prev.lines[0]?.assemblyCode === line.assemblyCode &&
            prev.section === section
        ) {
            prev.lines.push(line);
            return;
        }
        blocks.push({ key: line.key, section, lines: [line] });
    });
    return blocks;
};

const Stock = () => {
    const dispatch = useAppDispatch();
    const { partsArray } = useParts();
    usePrinters();
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const [search, setSearch] = useState('');
    const [clearingOrder, setClearingOrder] = useState(false);
    const [orderHeadPulse, setOrderHeadPulse] = useState(false);
    const [expandedPartId, setExpandedPartId] = useState<string | null>(null);
    const [assemblyOpen, setAssemblyOpen] = useState<Record<string, boolean>>(
        {}
    );

    const modelParts = useMemo(
        () =>
            partsArray.filter((item) =>
                matchesModel(item.part?.model, storageModel)
            ),
        [partsArray, storageModel]
    );

    const displayRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        const lines: StockLine[] = [];
        modelParts.forEach((item) => {
            const part = item.part || {};
            const qty = Number(part.quantity) || 0;
            const parent: StockLine = {
                key: item.id,
                stockId: item.id,
                section: part.section || 'Other',
                name: String(part.partName || ''),
                number: String(part.partN || ''),
                qty,
                partLife: part.partLife,
                installedQty: part.installedQty,
                optionModel: part.optionModel,
                orderQty: part.orderQty,
                hideOrder: false,
                ...(part.assemblyCode
                    ? {
                          assemblyCode: part.assemblyCode,
                          assemblyRole: part.assemblyRole,
                      }
                    : {}),
            };
            const shadows: StockLine[] = (
                Array.isArray(part.assemblyLines) ? part.assemblyLines : []
            ).map((line: AssemblyLine, index: number) => {
                const need = Number(line.needQty) || 0;
                return {
                    key: `${item.id}:assembly:${index}`,
                    stockId: item.id,
                    section: line.section || parent.section,
                    name: String(line.partName || ''),
                    number: parent.number,
                    qty,
                    partLife: line.partLife,
                    installedQty: need,
                    hideOrder: true,
                    assemblyCode: line.code,
                    assemblyRole: line.role,
                };
            });
            const hit = (line: StockLine) =>
                !q ||
                line.name.toLowerCase().includes(q) ||
                line.number.toLowerCase().includes(q);
            if (!q) {
                lines.push(parent, ...shadows);
                return;
            }
            if (hit(parent)) lines.push(parent);
            shadows.forEach((line) => {
                if (hit(line)) lines.push(line);
            });
        });

        return groupAssemblyLines(lines);
    }, [modelParts, search]);

    const searchOpensAssembly = useMemo(() => {
        const q = search.trim().toLowerCase();
        const codes = new Set<string>();
        if (!q) return codes;
        displayRows.forEach((line) => {
            if (line.assemblyRole !== 'spoof' || !line.assemblyCode) return;
            const name = line.name.toLowerCase();
            const number = line.number.toLowerCase();
            if (name.includes(q) || number.includes(q)) {
                codes.add(line.assemblyCode);
            }
        });
        return codes;
    }, [displayRows, search]);

    const isAssemblyOpen = (code: string) => {
        if (searchOpensAssembly.has(code)) return true;
        return Boolean(assemblyOpen[code]);
    };

    const setAssemblyMode = (code: string, open: boolean) => {
        setAssemblyOpen((current) => ({ ...current, [code]: open }));
    };

    const { visibleItems, sentinelRef, hasMore, total, visibleCount } =
        useInfiniteList(displayRows);

    const totalQty = useMemo(() => {
        const seen = new Set<string>();
        return displayRows.reduce((sum, line) => {
            if (seen.has(line.stockId)) return sum;
            seen.add(line.stockId);
            return sum + line.qty;
        }, 0);
    }, [displayRows]);

    const lowStock = useMemo(() => {
        const seen = new Set<string>();
        return displayRows.filter((line) => {
            if (line.qty > 0 || seen.has(line.stockId)) return false;
            seen.add(line.stockId);
            return true;
        }).length;
    }, [displayRows]);

    const partsWithOrderQty = useMemo(() => {
        const visibleIds = new Set(displayRows.map((line) => line.stockId));
        return modelParts.filter(
            (item) =>
                visibleIds.has(item.id) &&
                (Number(item.part?.orderQty) || 0) > 0
        );
    }, [displayRows, modelParts]);

    const handleClearOrderQty = useCallback(async () => {
        if (partsWithOrderQty.length === 0 || clearingOrder) return;

        setClearingOrder(true);
        try {
            await Promise.all(
                partsWithOrderQty.map((item) =>
                    dispatch(
                        updateStock({
                            id: item.id,
                            part: { orderQty: 0 },
                        })
                    ).unwrap()
                )
            );
            setOrderHeadPulse(true);
            window.setTimeout(() => setOrderHeadPulse(false), 480);
        } catch (err) {
            console.error('Clear orderQty failed:', err);
        } finally {
            setClearingOrder(false);
        }
    }, [partsWithOrderQty, clearingOrder, dispatch]);

    useEffect(() => {
        setExpandedPartId(null);
    }, [storageModel, search]);

    const handleTogglePartRow = useCallback((id: string) => {
        setExpandedPartId((current) => (current === id ? null : id));
    }, []);

    let lastSection = '';

    return (
        <div className={cls.stock} data-testid="stock-root">
            <header className={cls.header}>
                <div className={cls.headerText}>
                    <div className={cls.stats}>
                        <span className={cls.stat}>
                            <b>{displayRows.length}</b> позиций
                        </span>
                        <span className={cls.statDot} />
                        <span className={cls.stat}>
                            <b>{totalQty}</b> шт. на складе
                        </span>
                        {lowStock > 0 && (
                            <>
                                <span className={cls.statDot} />
                                <span className={`${cls.stat} ${cls.statWarn}`}>
                                    <b>{lowStock}</b> без остатка
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <label className={cls.searchWrap}>
                    <span className={cls.searchIcon} aria-hidden>
                        ⌕
                    </span>
                    <input
                        className={cls.search}
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Артикул или название…"
                        data-testid="stock-search"
                    />
                </label>
            </header>

            {displayRows.length > 0 && (
                <div className={cls.titleBox}>
                    <p className={cls.name}>Наименование</p>
                    <p className={cls.number}>Парт номер</p>
                    <p className={cls.life}>Ресурс</p>
                    <p className={cls.installed}>В апп.</p>
                    <p className={cls.quantity}>Склад</p>
                    <div
                        className={classNames(
                            cls.orderQtyHead,
                            orderHeadPulse && cls.orderQtyHeadPulse
                        )}
                    >
                        <span>К заказу</span>
                        {partsWithOrderQty.length > 0 ? (
                            <button
                                type="button"
                                className={classNames(
                                    cls.clearOrderBtn,
                                    clearingOrder && cls.clearOrderBtnBusy
                                )}
                                onClick={() => void handleClearOrderQty()}
                                disabled={clearingOrder}
                                title="Сбросить все «К заказу»"
                                aria-label="Сбросить все поля «К заказу» в текущем списке"
                            >
                                <ClearOrderIcon aria-hidden />
                            </button>
                        ) : null}
                    </div>
                </div>
            )}

            {displayRows.length === 0 ? (
                <div className={cls.emptyCard}>
                    <strong>
                        {search.trim()
                            ? 'Ничего не найдено'
                            : storageModel
                              ? `Пусто для «${storageModel}»`
                              : 'Выберите модель слева'}
                    </strong>
                    <p>
                        {search.trim()
                            ? 'Попробуйте другой артикул или название.'
                            : 'Загрузите Excel в админке или оформите приход новой детали.'}
                    </p>
                </div>
            ) : (
                <>
                    {stockBlocks(visibleItems).map((block) => {
                        const section = block.section;
                        const showHead = section !== lastSection;
                        lastSection = section;
                        const sectionCount = displayRows.filter(
                            (line) => line.section === section
                        ).length;
                        const grouped = Boolean(block.lines[0]?.assemblyCode);
                        const assemblyCode = block.lines[0]?.assemblyCode;
                        const loose = block.lines.some(
                            (line) => line.assemblyRole === 'spoof'
                        );
                        const opened = assemblyCode
                            ? isAssemblyOpen(assemblyCode)
                            : false;
                        const host =
                            block.lines.find(
                                (line) => line.assemblyRole === 'main'
                            ) || block.lines[0];
                        const shown =
                            grouped && loose && !opened
                                ? block.lines.filter(
                                      (line) => line.assemblyRole !== 'spoof'
                                  )
                                : block.lines;
                        const visibleLines =
                            shown.length > 0 ? shown : host ? [host] : [];
                        const rows = visibleLines.map((item) => (
                            <div
                                key={item.key}
                                className={
                                    item.assemblyRole === 'spoof'
                                        ? cls.assemblySpoof
                                        : undefined
                                }
                            >
                                <StockPartRow
                                    id={item.key}
                                    stockId={item.stockId}
                                    name={item.name}
                                    number={item.number}
                                    qty={item.qty}
                                    partLife={item.partLife}
                                    installedQty={item.installedQty}
                                    optionModel={item.optionModel}
                                    orderQty={item.orderQty}
                                    hideOrder={item.hideOrder}
                                    assemblyOpen={opened}
                                    onAssemblyOpen={
                                        loose && item.key === host?.key
                                            ? (open) =>
                                                  setAssemblyMode(
                                                      assemblyCode || '',
                                                      open
                                                  )
                                            : undefined
                                    }
                                    expanded={expandedPartId === item.key}
                                    onToggle={handleTogglePartRow}
                                />
                            </div>
                        ));

                        return (
                            <div key={block.key}>
                                {showHead ? (
                                    <div className={cls.sectionHead}>
                                        <h3 className={cls.title}>{section}</h3>
                                        <span className={cls.sectionCount}>
                                            {sectionCount}
                                        </span>
                                    </div>
                                ) : null}
                                {grouped ? (
                                    <div className={cls.assembly}>{rows}</div>
                                ) : (
                                    rows
                                )}
                            </div>
                        );
                    })}
                    <InfiniteScrollSentinel
                        sentinelRef={sentinelRef}
                        hasMore={hasMore}
                        visibleCount={visibleCount}
                        total={total}
                    />
                </>
            )}
        </div>
    );
};

export default Stock;
