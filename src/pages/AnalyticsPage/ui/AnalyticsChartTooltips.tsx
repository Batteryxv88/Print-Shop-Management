import {
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    COST_CATEGORIES,
    COST_CATEGORY_COLORS,
    COST_CATEGORY_LABELS,
    type CostCategory,
} from '../../../shared/lib/stock/costCategory';
import type { CostMode, PrinterCostMonthRow } from '../../../shared/lib/stock/buildPrinterMonthlyCosts';
import { specialColorLabel } from '../../../shared/lib/counterReading/fields';
import type { PrintVolumeMonthRow } from '../../../shared/lib/counterReading/buildPrintVolume';
import { formatCount, formatMoney } from './analyticsFormatters';
import cls from './AnalyticsPage.module.scss';

export type HoverPoint = { x: number; y: number };

const COST_MODE_LABELS: Record<CostMode, string> = {
    purchase: 'Закуплено',
    used: 'Потрачено',
};

/** Позиционирует тултип: справа от точки, у правого края — слева */
export const ChartHoverTooltipShell = ({
    tip,
    visible,
    children,
}: {
    tip: HoverPoint;
    visible: boolean;
    children: ReactNode;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({
        left: tip.x + 14,
        top: Math.max(8, tip.y - 20),
    });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const parent = el.offsetParent as HTMLElement | null;
        const padPx = 8;
        const gap = 14;
        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        const cw = parent?.clientWidth ?? window.innerWidth;
        const ch = parent?.clientHeight ?? window.innerHeight;

        let left = tip.x + gap;
        if (left + tw > cw - padPx) {
            left = tip.x - tw - gap;
        }
        left = Math.max(padPx, Math.min(left, cw - tw - padPx));

        let top = tip.y - 20;
        if (top + th > ch - padPx) {
            top = ch - th - padPx;
        }
        top = Math.max(padPx, top);

        setCoords({ left, top });
    }, [tip.x, tip.y, visible]);

    return (
        <div
            ref={ref}
            className={`${cls.volumeTooltip} ${visible ? cls.volumeTooltipVisible : ''}`}
            style={{
                position: 'absolute',
                left: coords.left,
                top: coords.top,
                pointerEvents: 'none',
            }}
        >
            {children}
        </div>
    );
};

export type VolumeHoverTip = {
    printerId: string;
    label: string;
    x: number;
    y: number;
    color: string;
};

export const VolumeHoverTooltip = ({
    tip,
    rows,
    visible,
}: {
    tip: VolumeHoverTip;
    rows: PrintVolumeMonthRow[];
    visible: boolean;
}) => {
    const row = rows.find((r) => r.label === tip.label);
    const p = row?.printers.find((x) => x.printerId === tip.printerId);
    if (!p) return null;

    const v = p.volume;
    const specialEntries = Object.entries(v.special || {}).filter(
        ([, n]) => n > 0
    );

    return (
        <ChartHoverTooltipShell tip={tip} visible={visible}>
            <div className={cls.volumeTooltipTitle}>{tip.label}</div>
            <div
                className={cls.volumeTooltipName}
                style={{ color: tip.color }}
            >
                {p.name}
            </div>
            <div className={cls.volumeTooltipLine}>
                Общий: <b>{formatCount(v.total)}</b>
            </div>
            {v.mono != null && (
                <div className={cls.volumeTooltipLine}>
                    Ч/Б: <b>{formatCount(v.mono)}</b>
                </div>
            )}
            {v.color != null && (
                <div className={cls.volumeTooltipLine}>
                    Цвет: <b>{formatCount(v.color)}</b>
                </div>
            )}
            {specialEntries.map(([code, n]) => (
                <div key={code} className={cls.volumeTooltipLine}>
                    {specialColorLabel(code)}: <b>{formatCount(n)}</b>
                </div>
            ))}
        </ChartHoverTooltipShell>
    );
};

export type CostHoverTip = {
    printerName: string;
    label: string;
    x: number;
    y: number;
    color: string;
};

export const CostHoverTooltip = ({
    tip,
    rows,
    visible,
    mode,
}: {
    tip: CostHoverTip;
    rows: PrinterCostMonthRow[];
    visible: boolean;
    mode: CostMode;
}) => {
    const row = rows.find((r) => r.label === tip.label);
    const p = row?.printers.find((x) => x.name === tip.printerName);
    if (!p) return null;

    return (
        <ChartHoverTooltipShell tip={tip} visible={visible}>
            <div className={cls.volumeTooltipTitle}>{tip.label}</div>
            <div
                className={cls.volumeTooltipName}
                style={{ color: tip.color }}
            >
                {p.name}
            </div>
            <div className={cls.volumeTooltipLine}>
                {COST_MODE_LABELS[mode]}: <b>{formatMoney(p.total)} ₽</b>
            </div>
            {COST_CATEGORIES.map((key: CostCategory) => {
                const n = p.breakdown[key] || 0;
                if (!(n > 0)) return null;
                return (
                    <div key={key} className={cls.volumeTooltipLine}>
                        <span
                            className={cls.costCatDot}
                            style={{ background: COST_CATEGORY_COLORS[key] }}
                        />
                        {COST_CATEGORY_LABELS[key]}:{' '}
                        <b>{formatMoney(n)} ₽</b>
                    </div>
                );
            })}
        </ChartHoverTooltipShell>
    );
};
