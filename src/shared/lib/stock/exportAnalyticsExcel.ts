import { Buffer } from 'buffer';
import * as XLSX from 'xlsx-js-style';
import { addCharts, type ChartSpec } from 'chartsheet';

if (!(globalThis as { Buffer?: typeof Buffer }).Buffer) {
    (globalThis as { Buffer: typeof Buffer }).Buffer = Buffer;
}
import type { StockMovement } from '../../../services/stockAccounting';
import type { CounterReadingRecord } from '../../../services/counterReadings';
import {
    COST_CATEGORIES,
    COST_CATEGORY_COLORS,
    COST_CATEGORY_LABELS,
} from './costCategory';
import type { PrinterAnalyticsRow } from './buildPrinterAnalytics';
import type { ClickCostRow } from './buildClickCosts';
import {
    PRINTER_LINE_COLORS,
    type PrintVolumeMonthRow,
} from '../counterReading/buildPrintVolume';
import type { PrinterCostMonthRow } from './buildPrinterMonthlyCosts';
import { excelSheetName } from '../printers/printerUtils';

type UsedPartRow = {
    id: string;
    part: {
        machine?: string;
        partName?: string;
        partN?: string;
        quantity?: number;
        serviceLife?: number;
        percent?: number;
        man?: string;
        date?: string;
        section?: string;
        totalCost?: number;
    };
};

type TonerHistRow = {
    id: string;
    toner: {
        machine?: string;
        color?: string;
        counter?: number | string;
        man?: string;
        date?: string;
        totalCost?: number;
    };
};

const applySheetStyles = (worksheet: XLSX.WorkSheet) => {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const addr = XLSX.utils.encode_cell({ r: row, c: col });
            if (!worksheet[addr]) continue;
            worksheet[addr].s = {
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } },
                },
                ...(row === range.s.r ||
                (typeof worksheet[addr].v === 'string' &&
                    String(worksheet[addr].v).startsWith('—'))
                    ? {
                          font: { bold: true, size: 12 },
                          fill: { fgColor: { rgb: 'E0E0E0' } },
                      }
                    : {}),
            };
        }
    }
};

const sheetNameSafe = (name: string) =>
    excelSheetName(name, '').trim() || name.slice(0, 31);

const appendSheet = (
    wb: XLSX.WorkBook,
    name: string,
    sheet: XLSX.WorkSheet,
    cols?: { wch: number }[]
) => {
    if (cols) sheet['!cols'] = cols;
    applySheetStyles(sheet);
    const sheetName = sheetNameSafe(name);
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    return sheetName;
};

const addSheet = (
    wb: XLSX.WorkBook,
    name: string,
    rows: Record<string, unknown>[],
    cols?: { wch: number }[]
) => {
    if (!rows.length) return '';
    return appendSheet(wb, name, XLSX.utils.json_to_sheet(rows), cols);
};

const money = (n: number) => Math.round(n * 100) / 100;

const kindRu = (kind: string) => {
    if (kind === 'purchase') return 'Приход';
    if (kind === 'writeoff') return 'Списание';
    if (kind === 'engineer') return 'Инженер';
    if (kind === 'storno') return 'Сторно';
    return kind;
};

const q = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

const colLetter = (index0: number) => XLSX.utils.encode_col(index0);

/** Серии для колонок startCol… по строкам headerRow+1…lastRow (1-based rows) */
const seriesFromWideTable = (
    sheet: string,
    printerCount: number,
    headerRow: number,
    lastRow: number,
    colors: string[],
    startCol = 1
) => {
    const series: {
        nameRef: string;
        ref: string;
        colour: string;
    }[] = [];
    for (let i = 0; i < printerCount; i++) {
        const col = colLetter(startCol + i);
        series.push({
            nameRef: `${q(sheet)}!$${col}$${headerRow}`,
            ref: `${q(sheet)}!$${col}$${headerRow + 1}:$${col}$${lastRow}`,
            colour: colors[i % colors.length],
        });
    }
    return series;
};

const downloadXlsx = (
    data: ArrayBuffer | Uint8Array | Buffer,
    filename: string
) => {
    const bytes =
        data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

/** Широкая таблица: Месяц | Принтер1 | Принтер2 | … */
const buildWideMonthPrinterTable = (
    rows: Array<{
        label: string;
        printers: Array<{ name: string; value: number }>;
    }>
): { aoa: (string | number)[][]; names: string[] } => {
    const nameSet = new Set<string>();
    rows.forEach((r) => r.printers.forEach((p) => nameSet.add(p.name)));
    const names = Array.from(nameSet);
    const aoa: (string | number)[][] = [['Месяц', ...names]];
    rows.forEach((r) => {
        const map = new Map(r.printers.map((p) => [p.name, p.value]));
        aoa.push([r.label, ...names.map((n) => map.get(n) ?? 0)]);
    });
    return { aoa, names };
};

const nextOriginRow = (sheet: XLSX.WorkSheet): number => {
    const ref = sheet['!ref'];
    if (!ref) return 0;
    return XLSX.utils.decode_range(ref).e.r + 1;
};

export type AnalyticsExportInput = {
    from: string;
    to: string;
    stockValue: number;
    printerRows: PrinterAnalyticsRow[];
    clickCosts: ClickCostRow[];
    volumeRows: PrintVolumeMonthRow[];
    costPurchaseRows: PrinterCostMonthRow[];
    costUsedRows: PrinterCostMonthRow[];
    movements: StockMovement[];
    counterReadings: CounterReadingRecord[];
    usedParts: UsedPartRow[];
    tonerHistory: TonerHistRow[];
};

/** Расширенный Excel аналитики с диаграммами на тех же листах */
export const exportAnalyticsExcel = async (input: AnalyticsExportInput) => {
    const wb = XLSX.utils.book_new();
    const periodLabel = `${input.from} — ${input.to}`;
    const charts: ChartSpec[] = [];

    addSheet(
        wb,
        'Сводка',
        [
            {
                'Период': periodLabel,
                'Остаток склада ₽': money(input.stockValue),
                'Списано ₽': money(
                    input.printerRows.reduce((s, r) => s + r.usedTotal, 0)
                ),
                'Закуплено ₽': money(
                    input.printerRows.reduce((s, r) => s + r.purchasedTotal, 0)
                ),
                'Экономия / перерасход ₽': money(
                    input.printerRows.reduce((s, r) => s + r.economy, 0)
                ),
            },
        ],
        [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 22 }]
    );

    // ——— Себестоимость клика + столбчатая диаграмма ———
    const clickRows = input.clickCosts.map((r) => ({
        'Аппарат': r.name,
        'Модель': r.model,
        'Оттиски': r.pages,
        'Использовано ₽': money(r.usedCost),
        '₽ / клик': r.clickCost != null ? money(r.clickCost) : '',
        'Закуплено ₽': money(r.purchasedTotal),
        'Экономия ₽': money(r.economy),
    }));
    if (clickRows.length) {
        const clickSheetName = appendSheet(
            wb,
            'Себестоимость клика',
            XLSX.utils.json_to_sheet(clickRows),
            [
                { wch: 16 },
                { wch: 22 },
                { wch: 12 },
                { wch: 14 },
                { wch: 12 },
                { wch: 14 },
                { wch: 12 },
            ]
        );
        const last = clickRows.length + 1;
        charts.push({
            type: 'column',
            title: 'Себестоимость клика',
            sheet: clickSheetName,
            categories: `${q(clickSheetName)}!$A$2:$A$${last}`,
            series: [
                {
                    nameRef: `${q(clickSheetName)}!$E$1`,
                    ref: `${q(clickSheetName)}!$E$2:$E$${last}`,
                    colour: '#BB86FC',
                },
            ],
            anchor: { col: 8, row: 0 },
            width: 560,
            height: 340,
            legend: false,
            yTitle: '₽',
            numberFormat: '0.000',
        });
    }

    // ——— Затраты по принтерам + stacked категории ———
    if (input.printerRows.length) {
        const printerRows = input.printerRows.map((r) => {
            const row: Record<string, unknown> = {
                'Аппарат': r.name,
                'Модель': r.model,
                'Закуплено всего ₽': money(r.purchasedTotal),
                'Использовано всего ₽': money(r.usedTotal),
                'Экономия ₽': money(r.economy),
            };
            COST_CATEGORIES.forEach((k) => {
                row[`Закуп. ${COST_CATEGORY_LABELS[k]} ₽`] = money(
                    r.purchased[k] || 0
                );
            });
            COST_CATEGORIES.forEach((k) => {
                row[`Исп. ${COST_CATEGORY_LABELS[k]} ₽`] = money(
                    r.used[k] || 0
                );
            });
            return row;
        });
        const printerSheetName = appendSheet(
            wb,
            'Затраты по принтерам',
            XLSX.utils.json_to_sheet(printerRows)
        );
        const last = printerRows.length + 1;
        // Колонки «Исп. …» идут после 5 базовых + 4 закуп. = с индекса 9
        const usedStartCol = 5 + COST_CATEGORIES.length;
        charts.push({
            type: 'column',
            title: 'Использовано по категориям',
            sheet: printerSheetName,
            stacked: true,
            categories: `${q(printerSheetName)}!$A$2:$A$${last}`,
            series: COST_CATEGORIES.map((k, i) => {
                const col = colLetter(usedStartCol + i);
                return {
                    nameRef: `${q(printerSheetName)}!$${col}$1`,
                    ref: `${q(printerSheetName)}!$${col}$2:$${col}$${last}`,
                    colour: COST_CATEGORY_COLORS[k],
                };
            }),
            anchor: { col: usedStartCol + COST_CATEGORIES.length + 1, row: 0 },
            width: 680,
            height: 360,
            legend: 'b',
            yTitle: '₽',
            numberFormat: '#,##0',
        });
    }

    // ——— Объём печати: широкая таблица + детализация + линейный график ———
    {
        const volumeWide = buildWideMonthPrinterTable(
            input.volumeRows.map((r) => ({
                label: r.label,
                printers: r.printers.map((p) => ({
                    name: p.name,
                    value: Number(p.volume?.total) || 0,
                })),
            }))
        );
        const volumeFlat: Record<string, unknown>[] = [];
        input.volumeRows.forEach((row) => {
            row.printers.forEach((p) => {
                volumeFlat.push({
                    'Месяц': row.label,
                    'Период': row.periodKey,
                    'Аппарат': p.name,
                    'Общий': p.volume.total,
                    'Ч/Б': p.volume.mono ?? '',
                    'Цвет': p.volume.color ?? '',
                    ...Object.fromEntries(
                        Object.entries(p.volume.special || {}).map(([c, n]) => [
                            `Спец ${c}`,
                            n,
                        ])
                    ),
                });
            });
        });

        if (volumeWide.aoa.length > 1 || volumeFlat.length) {
            const sheet =
                volumeWide.aoa.length > 1
                    ? XLSX.utils.aoa_to_sheet(volumeWide.aoa)
                    : XLSX.utils.aoa_to_sheet([['Нет данных для графика']]);

            if (volumeFlat.length) {
                const gap = nextOriginRow(sheet) + 1;
                XLSX.utils.sheet_add_aoa(
                    sheet,
                    [['— Детализация по счётчикам —']],
                    { origin: { r: gap, c: 0 } }
                );
                XLSX.utils.sheet_add_json(sheet, volumeFlat, {
                    origin: { r: gap + 1, c: 0 },
                    skipHeader: false,
                });
            }

            const volSheetName = appendSheet(wb, 'Объём печати', sheet, [
                { wch: 16 },
                { wch: 12 },
                { wch: 16 },
                { wch: 12 },
                { wch: 10 },
                { wch: 10 },
            ]);

            if (volumeWide.names.length && volumeWide.aoa.length > 1) {
                const last = volumeWide.aoa.length;
                charts.push({
                    type: 'line',
                    title: 'Объём печати по месяцам',
                    sheet: volSheetName,
                    categories: `${q(volSheetName)}!$A$2:$A$${last}`,
                    series: seriesFromWideTable(
                        volSheetName,
                        volumeWide.names.length,
                        1,
                        last,
                        PRINTER_LINE_COLORS
                    ),
                    anchor: { col: volumeWide.names.length + 2, row: 0 },
                    width: 720,
                    height: 380,
                    legend: 'b',
                    yTitle: 'Оттиски',
                    numberFormat: '#,##0',
                });
            }
        }
    }

    // ——— Затраты по месяцам: закупки + использовано (wide) + детализация ———
    {
        const purchaseWide = buildWideMonthPrinterTable(
            input.costPurchaseRows.map((r) => ({
                label: r.label,
                printers: r.printers.map((p) => ({
                    name: p.name,
                    value: money(p.total),
                })),
            }))
        );
        const usedWide = buildWideMonthPrinterTable(
            input.costUsedRows.map((r) => ({
                label: r.label,
                printers: r.printers.map((p) => ({
                    name: p.name,
                    value: money(p.total),
                })),
            }))
        );

        const flattenCostMonths = (
            rows: PrinterCostMonthRow[],
            modeLabel: string
        ) => {
            const out: Record<string, unknown>[] = [];
            rows.forEach((row) => {
                row.printers.forEach((p) => {
                    if (!(p.total > 0)) return;
                    const line: Record<string, unknown> = {
                        'Режим': modeLabel,
                        'Месяц': row.label,
                        'Аппарат': p.name,
                        'Итого ₽': money(p.total),
                    };
                    COST_CATEGORIES.forEach((k) => {
                        line[COST_CATEGORY_LABELS[k]] = money(
                            p.breakdown[k] || 0
                        );
                    });
                    out.push(line);
                });
            });
            return out;
        };

        const detail = [
            ...flattenCostMonths(input.costPurchaseRows, 'Закупки'),
            ...flattenCostMonths(input.costUsedRows, 'Использовано'),
        ];

        const hasPurchase =
            purchaseWide.names.length > 0 && purchaseWide.aoa.length > 1;
        const hasUsed = usedWide.names.length > 0 && usedWide.aoa.length > 1;

        if (hasPurchase || hasUsed || detail.length) {
            const sheet = XLSX.utils.aoa_to_sheet([
                ['— Закупки по месяцам —'],
            ]);
            /** 1-based Excel row of wide-table header */
            let purchaseHeaderExcel = 0;
            let purchaseLastExcel = 0;
            let usedHeaderExcel = 0;
            let usedLastExcel = 0;

            if (hasPurchase) {
                const start0 = nextOriginRow(sheet); // 0-based
                XLSX.utils.sheet_add_aoa(sheet, purchaseWide.aoa, {
                    origin: { r: start0, c: 0 },
                });
                purchaseHeaderExcel = start0 + 1;
                purchaseLastExcel = start0 + purchaseWide.aoa.length;
            } else {
                XLSX.utils.sheet_add_aoa(sheet, [['Нет данных']], {
                    origin: -1,
                });
            }

            XLSX.utils.sheet_add_aoa(
                sheet,
                [[''], ['— Использовано по месяцам —']],
                { origin: -1 }
            );

            if (hasUsed) {
                const start0 = nextOriginRow(sheet);
                XLSX.utils.sheet_add_aoa(sheet, usedWide.aoa, {
                    origin: { r: start0, c: 0 },
                });
                usedHeaderExcel = start0 + 1;
                usedLastExcel = start0 + usedWide.aoa.length;
            } else {
                XLSX.utils.sheet_add_aoa(sheet, [['Нет данных']], {
                    origin: -1,
                });
            }

            if (detail.length) {
                XLSX.utils.sheet_add_aoa(sheet, [[''], ['— Детализация —']], {
                    origin: -1,
                });
                XLSX.utils.sheet_add_json(sheet, detail, {
                    origin: -1,
                    skipHeader: false,
                });
            }

            const costSheetName = appendSheet(wb, 'Затраты по месяцам', sheet, [
                { wch: 14 },
                { wch: 12 },
                { wch: 12 },
                { wch: 12 },
            ]);

            const chartCol =
                Math.max(
                    purchaseWide.names.length,
                    usedWide.names.length,
                    4
                ) + 2;

            if (hasPurchase) {
                charts.push({
                    type: 'line',
                    title: 'Затраты: закупки по месяцам',
                    sheet: costSheetName,
                    categories: `${q(costSheetName)}!$A$${purchaseHeaderExcel + 1}:$A$${purchaseLastExcel}`,
                    series: seriesFromWideTable(
                        costSheetName,
                        purchaseWide.names.length,
                        purchaseHeaderExcel,
                        purchaseLastExcel,
                        PRINTER_LINE_COLORS
                    ),
                    anchor: { col: chartCol, row: 0 },
                    width: 680,
                    height: 320,
                    legend: 'b',
                    yTitle: '₽',
                    numberFormat: '#,##0',
                });
            }

            if (hasUsed) {
                charts.push({
                    type: 'line',
                    title: 'Затраты: использовано по месяцам',
                    sheet: costSheetName,
                    categories: `${q(costSheetName)}!$A$${usedHeaderExcel + 1}:$A$${usedLastExcel}`,
                    series: seriesFromWideTable(
                        costSheetName,
                        usedWide.names.length,
                        usedHeaderExcel,
                        usedLastExcel,
                        PRINTER_LINE_COLORS
                    ),
                    anchor: {
                        col: chartCol,
                        row: Math.max(0, usedHeaderExcel - 1),
                    },
                    width: 680,
                    height: 320,
                    legend: 'b',
                    yTitle: '₽',
                    numberFormat: '#,##0',
                });
            }
        }
    }

    addSheet(
        wb,
        'Движения',
        input.movements.map((m) => ({
            'Дата': new Date(m.date).toLocaleString('ru-RU'),
            'Тип': m.reversed
                ? `${kindRu(m.kind)} (отменено)`
                : kindRu(m.kind),
            'Категория':
                COST_CATEGORY_LABELS[m.costCategory] || m.costCategory || '',
            'Позиция':
                m.type === 'toner'
                    ? `Тонер ${m.color || ''}`
                    : m.type === 'engineer'
                      ? m.partName || 'Инженер'
                      : `${m.partN || ''} ${m.partName || ''}`.trim(),
            'Кол-во': m.qty,
            'Сумма ₽': money(Number(m.totalCost) || 0),
            'Экономия ₽': money(Number(m.economyAmount) || 0),
            'Аппарат': m.machine || '',
            'Кто': m.man || '',
            'Поставщик': m.supplier || '',
        })),
        [
            { wch: 18 },
            { wch: 12 },
            { wch: 12 },
            { wch: 28 },
            { wch: 8 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
            { wch: 14 },
            { wch: 16 },
        ]
    );

    const readingsFlat: Record<string, unknown>[] = [];
    input.counterReadings.forEach((r) => {
        (r.printers || []).forEach((p) => {
            readingsFlat.push({
                'Период': r.periodKey,
                'Аппарат': p.printerName,
                'Общий': p.values?.total ?? '',
                'Ч/Б': p.values?.mono ?? '',
                'Цвет': p.values?.color ?? '',
                ...Object.fromEntries(
                    Object.entries(p.values?.special || {}).map(([c, n]) => [
                        `Спец ${c}`,
                        n,
                    ])
                ),
                'Снял': r.userName,
                'Когда': r.completedAt
                    ? new Date(r.completedAt).toLocaleString('ru-RU')
                    : '',
            });
        });
    });
    addSheet(wb, 'Счётчики', readingsFlat);

    const fromMs = new Date(`${input.from}T00:00:00`).getTime();
    const toMs = new Date(`${input.to}T23:59:59`).getTime();
    const inRange = (iso?: string) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return Number.isFinite(t) && t >= fromMs && t <= toMs;
    };

    addSheet(
        wb,
        'Замены деталей',
        input.usedParts
            .filter((p) => inRange(p.part.date))
            .map((p) => ({
                'Аппарат': p.part.machine || '',
                'Наименование': p.part.partName || '',
                'Артикул': p.part.partN || '',
                'Кол-во': p.part.quantity ?? '',
                'Ресурс': p.part.serviceLife ?? '',
                '%': p.part.percent ?? '',
                'Сумма ₽': money(Number(p.part.totalCost) || 0),
                'Ответственный': p.part.man || '',
                'Дата': p.part.date
                    ? new Date(p.part.date).toLocaleDateString('ru-RU')
                    : '',
                'Секция': p.part.section || '',
            }))
    );

    addSheet(
        wb,
        'Замены тонеров',
        input.tonerHistory
            .filter((t) => inRange(t.toner.date))
            .map((t) => ({
                'Аппарат': t.toner.machine || '',
                'Цвет': t.toner.color || '',
                'Счётчик': t.toner.counter ?? '',
                'Сумма ₽': money(Number(t.toner.totalCost) || 0),
                'Ответственный': t.toner.man || '',
                'Дата': t.toner.date
                    ? new Date(t.toner.date).toLocaleDateString('ru-RU')
                    : '',
            }))
    );

    const stamp = new Date().toLocaleDateString('ru-RU').replace(/\./g, '_');
    const filename = `Аналитика_${stamp}.xlsx`;

    let buffer: Uint8Array | Buffer = XLSX.write(wb, {
        type: 'array',
        bookType: 'xlsx',
    }) as Uint8Array;

    if (charts.length) {
        buffer = await addCharts(buffer, charts);
    }

    downloadXlsx(buffer, filename);
};
