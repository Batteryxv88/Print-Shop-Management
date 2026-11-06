import { type CSSProperties } from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
import type {
    PrintVolumeChartGranularity,
    PrintVolumeMonthRow,
} from '../../../shared/lib/counterReading/buildPrintVolume';
import type { CostMode, PrinterCostMonthRow } from '../../../shared/lib/stock/buildPrinterMonthlyCosts';
import {
    VolumeHoverTooltip,
    CostHoverTooltip,
    type VolumeHoverTip,
    type CostHoverTip,
} from './AnalyticsChartTooltips';
import cls from './AnalyticsPage.module.scss';

const COST_MODE_LABELS: Record<CostMode, string> = {
    purchase: 'Закуплено',
    used: 'Потрачено',
};

type PrintVolPrinter = { id: string; name: string; color: string };

type AnalyticsChartsProps = {
    volumeChartTitle: string;
    volumeGranularity: PrintVolumeChartGranularity;
    onVolumeGranularityChange: (g: PrintVolumeChartGranularity) => void;
    printVolumeRows: PrintVolumeMonthRow[];
    printVolumePrinters: PrintVolPrinter[];
    hiddenVolumePrinters: Record<string, boolean>;
    toggleVolumePrinter: (id: string) => void;
    volumeTipShown: VolumeHoverTip | null;
    volumeTipVisible: boolean;
    setVolumeHoverTip: (tip: VolumeHoverTip | null) => void;
    costMode: CostMode;
    setCostMode: (m: CostMode) => void;
    costChartHasData: boolean;
    costMonthRows: PrinterCostMonthRow[];
    costChartPrinters: PrintVolPrinter[];
    hiddenCostPrinters: Record<string, boolean>;
    toggleCostPrinter: (id: string) => void;
    costTipShown: CostHoverTip | null;
    costTipVisible: boolean;
    setCostHoverTip: (tip: CostHoverTip | null) => void;
};

const GRAN_LABELS: Record<PrintVolumeChartGranularity, string> = {
    day: 'По дням',
    week: 'По неделям',
    month: 'По месяцам',
};

const AnalyticsCharts = ({
    volumeChartTitle,
    volumeGranularity,
    onVolumeGranularityChange,
    printVolumeRows,
    printVolumePrinters,
    hiddenVolumePrinters,
    toggleVolumePrinter,
    volumeTipShown,
    volumeTipVisible,
    setVolumeHoverTip,
    costMode,
    setCostMode,
    costChartHasData,
    costMonthRows,
    costChartPrinters,
    hiddenCostPrinters,
    toggleCostPrinter,
    costTipShown,
    costTipVisible,
    setCostHoverTip,
}: AnalyticsChartsProps) => (
    <div className={cls.charts}>
        <div className={`${cls.chartCard} ${cls.chartWide}`}>
            <div className={cls.costChartHead}>
                <h3 className={cls.chartTitle}>{volumeChartTitle}</h3>
                <div
                    className={cls.costModeSwitch}
                    role="group"
                    aria-label="Шаг графика объёма"
                >
                    {(
                        [
                            'day',
                            'week',
                            'month',
                        ] as PrintVolumeChartGranularity[]
                    ).map((g) => (
                        <button
                            key={g}
                            type="button"
                            className={
                                volumeGranularity === g
                                    ? cls.costModeActive
                                    : cls.costModeBtn
                            }
                            onClick={() => onVolumeGranularityChange(g)}
                        >
                            {GRAN_LABELS[g]}
                        </button>
                    ))}
                </div>
            </div>
            {printVolumeRows.length === 0 ? (
                <div className={cls.empty}>
                    Нужно минимум два снятия счётчиков, чтобы показать динамику
                </div>
            ) : (
                <div className={cls.volumeChartWrap}>
                    <div
                        className={cls.volumeToggles}
                        role="group"
                        aria-label="Принтеры на графике"
                    >
                        {printVolumePrinters.map((p) => {
                            const on = !hiddenVolumePrinters[p.id];
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    className={`${cls.volumeToggle} ${on ? cls.volumeToggleOn : cls.volumeToggleOff}`}
                                    style={
                                        {
                                            '--toggle-color': p.color,
                                        } as CSSProperties
                                    }
                                    aria-pressed={on}
                                    onClick={() => toggleVolumePrinter(p.id)}
                                >
                                    <i className={cls.volumeToggleDot} />
                                    {p.name}
                                </button>
                            );
                        })}
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={printVolumeRows}>
                            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                            <XAxis
                                dataKey="label"
                                stroke="rgba(255,255,255,0.45)"
                                fontSize={11}
                            />
                            <YAxis
                                stroke="rgba(255,255,255,0.45)"
                                fontSize={11}
                                tickFormatter={(v) =>
                                    Number(v) >= 1000
                                        ? `${Math.round(Number(v) / 1000)}k`
                                        : String(v)
                                }
                            />
                            {printVolumePrinters.map((p) => {
                                if (hiddenVolumePrinters[p.id]) {
                                    return null;
                                }
                                const stroke = p.color;
                                return (
                                    <Line
                                        key={p.id}
                                        type="monotone"
                                        dataKey={p.id}
                                        name={p.name}
                                        stroke={stroke}
                                        strokeWidth={2}
                                        connectNulls
                                        isAnimationActive={false}
                                        activeDot={false}
                                        dot={(dotProps: {
                                            cx?: number;
                                            cy?: number;
                                            payload?: { label?: string };
                                        }) => {
                                            const { cx, cy, payload } = dotProps;
                                            if (
                                                cx == null ||
                                                cy == null ||
                                                !payload?.label
                                            ) {
                                                return <g />;
                                            }
                                            return (
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={7}
                                                    fill={stroke}
                                                    stroke="#1E1E1E"
                                                    strokeWidth={2}
                                                    style={{
                                                        cursor: 'pointer',
                                                    }}
                                                    onMouseEnter={() =>
                                                        setVolumeHoverTip({
                                                            printerId: p.id,
                                                            label: payload.label!,
                                                            x: cx,
                                                            y: cy,
                                                            color: stroke,
                                                        })
                                                    }
                                                    onMouseLeave={() =>
                                                        setVolumeHoverTip(null)
                                                    }
                                                />
                                            );
                                        }}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                    {volumeTipShown && (
                        <VolumeHoverTooltip
                            tip={volumeTipShown}
                            rows={printVolumeRows}
                            visible={volumeTipVisible}
                        />
                    )}
                </div>
            )}
        </div>

        <div className={`${cls.chartCard} ${cls.chartWide}`}>
            <div className={cls.costChartHead}>
                <h3 className={cls.chartTitle}>Затраты (по месяцам)</h3>
                <div
                    className={cls.costModeSwitch}
                    role="group"
                    aria-label="Тип затрат"
                >
                    {(['purchase', 'used'] as CostMode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            className={
                                costMode === m
                                    ? cls.costModeActive
                                    : cls.costModeBtn
                            }
                            onClick={() => setCostMode(m)}
                        >
                            {COST_MODE_LABELS[m]}
                        </button>
                    ))}
                </div>
            </div>
            {!costChartHasData ? (
                <div className={cls.empty}>
                    Нет движений склада с суммой за выбранный режим.
                    Переключите «Закуплено» / «Потрачено» или проверьте, что
                    закупки и списания пишутся в StockMovements.
                </div>
            ) : (
                <div className={cls.volumeChartWrap}>
                    <div
                        className={cls.volumeToggles}
                        role="group"
                        aria-label="Принтеры на графике затрат"
                    >
                        {costChartPrinters.map((p) => {
                            const on = !hiddenCostPrinters[p.id];
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    className={`${cls.volumeToggle} ${on ? cls.volumeToggleOn : cls.volumeToggleOff}`}
                                    style={
                                        {
                                            '--toggle-color': p.color,
                                        } as CSSProperties
                                    }
                                    aria-pressed={on}
                                    onClick={() => toggleCostPrinter(p.id)}
                                >
                                    <i className={cls.volumeToggleDot} />
                                    {p.name}
                                </button>
                            );
                        })}
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={costMonthRows}>
                            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                            <XAxis
                                dataKey="label"
                                stroke="rgba(255,255,255,0.45)"
                                fontSize={11}
                            />
                            <YAxis
                                stroke="rgba(255,255,255,0.45)"
                                fontSize={11}
                                width={56}
                                tickFormatter={(v) => {
                                    const n = Number(v);
                                    return n >= 1000
                                        ? `${Math.round(n / 1000)}k ₽`
                                        : `${n} ₽`;
                                }}
                            />
                            {costChartPrinters.map((p) => {
                                if (hiddenCostPrinters[p.id]) {
                                    return null;
                                }
                                const stroke = p.color;
                                return (
                                    <Line
                                        key={p.id}
                                        type="monotone"
                                        dataKey={p.id}
                                        name={p.name}
                                        stroke={stroke}
                                        strokeWidth={2}
                                        connectNulls
                                        isAnimationActive={false}
                                        activeDot={false}
                                        dot={(dotProps: {
                                            cx?: number;
                                            cy?: number;
                                            payload?: { label?: string };
                                        }) => {
                                            const { cx, cy, payload } = dotProps;
                                            if (
                                                cx == null ||
                                                cy == null ||
                                                !payload?.label
                                            ) {
                                                return <g />;
                                            }
                                            return (
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={7}
                                                    fill={stroke}
                                                    stroke="#1E1E1E"
                                                    strokeWidth={2}
                                                    style={{
                                                        cursor: 'pointer',
                                                    }}
                                                    onMouseEnter={() =>
                                                        setCostHoverTip({
                                                            printerName: p.id,
                                                            label: payload.label!,
                                                            x: cx,
                                                            y: cy,
                                                            color: stroke,
                                                        })
                                                    }
                                                    onMouseLeave={() =>
                                                        setCostHoverTip(null)
                                                    }
                                                />
                                            );
                                        }}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                    {costTipShown && (
                        <CostHoverTooltip
                            tip={costTipShown}
                            rows={costMonthRows}
                            visible={costTipVisible}
                            mode={costMode}
                        />
                    )}
                </div>
            )}
        </div>
    </div>
);

export default AnalyticsCharts;
