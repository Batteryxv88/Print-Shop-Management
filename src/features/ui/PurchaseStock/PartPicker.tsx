import { useEffect, useMemo, useRef, useState } from 'react';
import cls from './PurchaseStock.module.scss';

export type PartPickerOption = {
    id: string;
    partN: string;
    partName: string;
    section: string;
    qty: number;
};

type Props = {
    query: string;
    onQueryChange: (value: string) => void;
    options: PartPickerOption[];
    selectedId: string | null;
    onSelect: (option: PartPickerOption) => void;
};

const MAX_FILTERED = 30;

const PartPicker = ({
    query,
    onQueryChange,
    options,
    selectedId,
    onSelect,
}: Props) => {
    const [open, setOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const wrapRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (showAll || !q) return options;
        return options
            .filter(
                (o) =>
                    o.partN.toLowerCase().includes(q) ||
                    o.partName.toLowerCase().includes(q)
            )
            .sort((a, b) => {
                // Совпадение с начала артикула — выше
                const as = a.partN.toLowerCase().startsWith(q) ? 0 : 1;
                const bs = b.partN.toLowerCase().startsWith(q) ? 0 : 1;
                return as - bs;
            })
            .slice(0, MAX_FILTERED);
    }, [options, query, showAll]);

    useEffect(() => {
        setHighlight(0);
    }, [query, showAll]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
                setShowAll(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.children[highlight] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const pick = (option: PartPickerOption) => {
        onSelect(option);
        setOpen(false);
        setShowAll(false);
    };

    const toggleAll = () => {
        if (open && showAll) {
            setOpen(false);
            setShowAll(false);
            return;
        }
        setShowAll(true);
        setOpen(true);
        inputRef.current?.focus();
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) {
                setOpen(true);
                return;
            }
            setHighlight((h) => Math.min(h + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            if (open && items[highlight]) {
                e.preventDefault();
                pick(items[highlight]);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
            setShowAll(false);
        }
    };

    return (
        <div className={cls.pickerWrap} ref={wrapRef}>
            <div className={cls.pickerField}>
                <input
                    ref={inputRef}
                    className={`${cls.input} ${cls.pickerInput}`}
                    value={query}
                    autoComplete="off"
                    placeholder="Артикул или название"
                    onChange={(e) => {
                        onQueryChange(e.target.value);
                        setShowAll(false);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        if (query.trim()) setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                />
                <button
                    type="button"
                    className={`${cls.pickerArrow} ${
                        open && showAll ? cls.pickerArrowOpen : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={toggleAll}
                    title="Показать весь список"
                    aria-label="Показать весь список"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                        <path
                            d="M2 4l4 4 4-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            </div>

            {open && items.length > 0 && (
                <ul className={cls.pickerList} ref={listRef}>
                    {items.map((o, i) => (
                        <li key={o.id}>
                            <button
                                type="button"
                                className={`${cls.pickerItem} ${
                                    i === highlight ? cls.pickerItemActive : ''
                                } ${o.id === selectedId ? cls.pickerItemSelected : ''}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setHighlight(i)}
                                onClick={() => pick(o)}
                            >
                                <span className={cls.pickerPartN}>{o.partN}</span>
                                <span className={cls.pickerName}>{o.partName}</span>
                                <span className={cls.pickerMeta}>
                                    {o.section || '—'} · ост. {o.qty}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PartPicker;
