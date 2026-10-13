export type ChartSeries = {
    ref: string;
    nameRef?: string;
    name?: string;
    colour?: string;
    color?: string;
    xRef?: string;
};

export type ChartSpec = {
    type?:
        | 'bar'
        | 'column'
        | 'line'
        | 'pie'
        | 'doughnut'
        | 'area'
        | 'scatter'
        | 'radar';
    title?: string;
    categories?: string;
    series: ChartSeries[];
    sheet?: string;
    anchor?: {
        col?: number;
        row?: number;
        colOffset?: number;
        rowOffset?: number;
    };
    width?: number;
    height?: number;
    stacked?: boolean;
    horizontal?: boolean;
    dataLabels?: boolean;
    legend?: 'r' | 'l' | 't' | 'b' | false;
    numberFormat?: string;
    gridlines?: boolean;
    gapWidth?: number;
    name?: string;
    xTitle?: string;
    yTitle?: string;
};

export function addChart(
    workbook: Buffer | Uint8Array | ArrayBuffer,
    spec: ChartSpec
): Promise<Buffer>;

export function addCharts(
    workbook: Buffer | Uint8Array | ArrayBuffer,
    specs: ChartSpec[]
): Promise<Buffer>;
