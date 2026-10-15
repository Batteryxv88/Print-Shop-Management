import { useMemo, useState } from 'react';

import cls from './StockLotsPanel.module.scss';

import {

    formatLotDate,

    formatLotDateShort,

    formatMoneyRu,

} from '../../lib/stock/formatLotDate';



export type PriceDriftChartPoint = {

    key: string;

    label: string;

    purchasedAt: string;

    unitPrice: number;

};



type Props = {
    points: PriceDriftChartPoint[];
    size?: 'inline' | 'modal';
};



type EnrichedPoint = PriceDriftChartPoint & {

    deltaPct: number | null;

    shortDate: string;

};



const formatPct = (n: number | null) => {

    if (n == null || !Number.isFinite(n)) return null;

    const sign = n > 0 ? '+' : '';

    return `${sign}${n.toFixed(1)}%`;

};



const PriceDriftChart = ({ points, size = 'inline' }: Props) => {
    const isModal = size === 'modal';

    const enriched = useMemo((): EnrichedPoint[] => {

        let prev: number | null = null;

        return points.map((p) => {

            let deltaPct: number | null = null;

            if (prev != null && prev > 0) {

                deltaPct = ((p.unitPrice - prev) / prev) * 100;

            }

            prev = p.unitPrice;

            return {

                ...p,

                deltaPct,

                shortDate: formatLotDateShort(p.purchasedAt),

            };

        });

    }, [points]);



    const [activeIdx, setActiveIdx] = useState<number | null>(null);



    const displayIdx =

        activeIdx != null && activeIdx >= 0 && activeIdx < enriched.length

            ? activeIdx

            : enriched.length - 1;



    if (enriched.length === 0) return null;



    if (enriched.length === 1) {

        const p = enriched[0];

        return (

            <div className={cls.chartBlock}>

                <p className={cls.chartHint}>

                    {formatLotDate(p.purchasedAt)}:{' '}

                    <strong>{formatMoneyRu(p.unitPrice)} ₽</strong>

                </p>

            </div>

        );

    }



    const prices = enriched.map((p) => p.unitPrice);

    const dataMin = Math.min(...prices);

    const dataMax = Math.max(...prices);

    const spread = dataMax - dataMin;

    const pad = spread > 0 ? spread * 0.1 : dataMax * 0.06 || 8;

    const yMin = Math.max(0, dataMin - pad);

    const yMax = dataMax + pad;

    const yRange = yMax - yMin || 1;



    const plotW = isModal ? 660 : 280;
    const plotH = isModal ? 128 : 44;

    const margin = isModal
        ? { top: 10, right: 12, bottom: 4, left: 0 }
        : { top: 4, right: 6, bottom: 2, left: 0 };

    const innerW = plotW - margin.left - margin.right;

    const innerH = plotH - margin.top - margin.bottom;



    const coords = enriched.map((p, i) => {

        const x =

            margin.left +

            (i / Math.max(1, enriched.length - 1)) * innerW;

        const y =

            margin.top +

            innerH -

            ((p.unitPrice - yMin) / yRange) * innerH;

        return { x, y, ...p, index: i };

    });



    const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

    const areaPath = [

        `M ${coords[0].x} ${margin.top + innerH}`,

        ...coords.map((c) => `L ${c.x} ${c.y}`),

        `L ${coords[coords.length - 1].x} ${margin.top + innerH}`,

        'Z',

    ].join(' ');



    const yTicks = [yMax, yMin];



    const first = enriched[0];

    const last = enriched[enriched.length - 1];

    let periodPct: number | null = null;

    if (first.unitPrice > 0) {

        periodPct =

            ((last.unitPrice - first.unitPrice) / first.unitPrice) * 100;

    }



    const active = enriched[displayIdx];

    const activeDelta = formatPct(active.deltaPct);

    const periodLabel = formatPct(periodPct);



    return (
        <div
            className={`${cls.chartBlock} ${isModal ? cls.chartBlockModal : ''}`}
        >
            <div className={cls.chartLayout}>

                <div className={cls.chartYAxis} aria-hidden>

                    {yTicks.map((tick) => (

                        <span key={tick} className={cls.chartYTick}>

                            {formatMoneyRu(tick)}

                        </span>

                    ))}

                </div>



                <div className={cls.chartPlotWrap}>

                    <svg

                        className={cls.chartSvg}

                        viewBox={`0 0 ${plotW} ${plotH}`}

                        preserveAspectRatio={
                            isModal ? 'xMidYMid meet' : 'none'
                        }

                        role="img"

                        aria-label="Цена последних приходов"

                    >

                        <defs>

                            <linearGradient

                                id="priceDriftArea"

                                x1="0"

                                y1="0"

                                x2="0"

                                y2="1"

                            >

                                <stop

                                    offset="0%"

                                    stopColor="rgba(187, 134, 252, 0.28)"

                                />

                                <stop

                                    offset="100%"

                                    stopColor="rgba(187, 134, 252, 0)"

                                />

                            </linearGradient>

                        </defs>

                        {yTicks.map((tick) => {

                            const y =

                                margin.top +

                                innerH -

                                ((tick - yMin) / yRange) * innerH;

                            return (

                                <line

                                    key={tick}

                                    className={cls.chartGrid}

                                    x1={margin.left}

                                    y1={y}

                                    x2={plotW - margin.right}

                                    y2={y}

                                />

                            );

                        })}

                        <path className={cls.chartArea} d={areaPath} />

                        <polyline

                            className={cls.chartLine}

                            fill="none"

                            points={linePoints}

                        />

                        {coords.map((c) => {

                            const isActive = c.index === displayIdx;

                            return (

                                <g key={c.key}>

                                    <circle

                                        className={cls.chartHit}

                                        cx={c.x}

                                        cy={c.y}

                                        r={8}

                                        onMouseEnter={() =>

                                            setActiveIdx(c.index)

                                        }

                                        onMouseLeave={() =>

                                            setActiveIdx(null)

                                        }

                                        onFocus={() => setActiveIdx(c.index)}

                                        onBlur={() => setActiveIdx(null)}

                                        tabIndex={0}

                                        role="button"

                                        aria-label={`${c.shortDate}, ${formatMoneyRu(c.unitPrice)} ₽`}

                                    />

                                    <circle

                                        className={`${cls.chartDot} ${

                                            isActive ? cls.chartDotActive : ''

                                        }`}

                                        cx={c.x}

                                        cy={c.y}

                                        r={isActive ? 3.5 : 2.5}

                                    />

                                </g>

                            );

                        })}

                    </svg>

                    <div className={cls.chartXSpan}>

                        <span>{first.shortDate}</span>

                        <span>{last.shortDate}</span>

                    </div>

                </div>

            </div>



            <p className={cls.chartInsight}>

                <strong>{formatMoneyRu(active.unitPrice)} ₽</strong>

                <span className={cls.chartInsightMuted}>

                    {active.shortDate}

                    {activeDelta ? (

                        <>

                            {' · '}

                            <span

                                className={

                                    (active.deltaPct ?? 0) > 0

                                        ? cls.up

                                        : (active.deltaPct ?? 0) < 0

                                          ? cls.down

                                          : undefined

                                }

                            >

                                {activeDelta}

                            </span>

                        </>

                    ) : null}

                </span>

                <span className={cls.chartInsightMuted}>

                    · {formatMoneyRu(dataMin)}–{formatMoneyRu(dataMax)} ₽

                    {periodLabel ? (

                        <>

                            {' · '}

                            <span

                                className={

                                    (periodPct ?? 0) > 0

                                        ? cls.up

                                        : (periodPct ?? 0) < 0

                                          ? cls.down

                                          : undefined

                                }

                            >

                                {periodLabel} за {enriched.length}

                            </span>

                        </>

                    ) : null}

                </span>

            </p>

        </div>

    );

};



export default PriceDriftChart;

