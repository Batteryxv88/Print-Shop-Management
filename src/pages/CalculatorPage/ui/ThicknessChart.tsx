import { useState } from 'react';
import cls from './CalculatorPage.module.scss';
import {
    STANDARD_LENGTHS_M,
    formatMm,
    rollThicknessMm,
} from '../../../shared/lib/calculator/rollThickness';

export interface ThicknessRow {
    id: string;
    label: string;
    coreMm: number;
    filmMm: number;
}

interface ThicknessChartProps {
    title: string;
    rows: ThicknessRow[];
}

interface HoverCell {
    row: number;
    col: number;
}

const HEADER_ROW = -1;

const ThicknessChart = ({ title, rows }: ThicknessChartProps) => {
    const [hover, setHover] = useState<HoverCell | null>(null);

    const axisClass = (row: number, col: number) => {
        if (!hover) return '';
        const isCursor = hover.row === row && hover.col === col;
        const onRowLeft = hover.row === row && col < hover.col;
        const onColAbove = hover.col === col && row < hover.row;
        if (isCursor) return cls.cellCross;
        if (onRowLeft) return cls.cellRow;
        if (onColAbove) return cls.cellCol;
        return '';
    };

    return (
        <section className={cls.chart}>
            <h2 className={cls.chartTitle}>{title}</h2>
            <div className={cls.tableWrap}>
                <table
                    className={cls.table}
                    onMouseLeave={() => setHover(null)}
                >
                    <thead>
                        <tr>
                            <th
                                className={axisClass(HEADER_ROW, 0)}
                                onMouseEnter={() => setHover({ row: HEADER_ROW, col: 0 })}
                            >
                                Материал
                            </th>
                            {STANDARD_LENGTHS_M.map((length, index) => (
                                <th
                                    key={length}
                                    className={axisClass(HEADER_ROW, index + 1)}
                                    onMouseEnter={() => setHover({ row: HEADER_ROW, col: index + 1 })}
                                >
                                    {length} м
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={row.id}>
                                <th
                                    className={axisClass(rowIndex, 0)}
                                    onMouseEnter={() => setHover({ row: rowIndex, col: 0 })}
                                >
                                    {row.label}
                                </th>
                                {STANDARD_LENGTHS_M.map((length, index) => (
                                    <td
                                        key={length}
                                        className={axisClass(rowIndex, index + 1)}
                                        onMouseEnter={() => setHover({ row: rowIndex, col: index + 1 })}
                                    >
                                        {formatMm(rollThicknessMm(row.coreMm, row.filmMm, length))}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className={cls.chartNote}>Толщина намотки, мм</p>
        </section>
    );
};

export default ThicknessChart;
