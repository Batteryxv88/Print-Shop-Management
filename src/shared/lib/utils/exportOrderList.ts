import * as XLSX from 'xlsx-js-style';
import { OrderListItem } from '../hooks/useOrderList';
import { fetchLastPartPurchasePrices } from '../../../services/stockAccounting';

let showNotificationCallback:
    | ((
          title: string,
          message: string,
          type?: 'info' | 'warning' | 'error' | 'success'
      ) => void)
    | null = null;

export const setNotificationCallback = (
    callback: (
        title: string,
        message: string,
        type?: 'info' | 'warning' | 'error' | 'success'
    ) => void
) => {
    showNotificationCallback = callback;
};

const showNotification = (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
) => {
    if (showNotificationCallback) {
        showNotificationCallback(title, message, type);
    } else {
        alert(`${title}: ${message}`);
    }
};

const money = (n: number) => Math.round(n * 100) / 100;

export const exportOrderListToExcel = async (orderList: OrderListItem[]) => {
    if (orderList.length === 0) {
        showNotification(
            'Нет деталей для заказа',
            'Отметьте «К заказу» у нужных позиций на складе деталей.',
            'warning'
        );
        return;
    }

    let prices = new Map<string, number>();
    try {
        prices = await fetchLastPartPurchasePrices(orderList.map((i) => i.id));
    } catch (err) {
        console.error('Failed to load purchase prices', err);
    }

    const excelData: Record<string, string | number>[] = orderList.map(
        (item) => {
            const unitPrice = prices.get(item.id) ?? 0;
            return {
                'Наименование': item.partName,
                'Артикул': item.partN,
                'Количество': item.needToOrder,
                'Цена': money(unitPrice),
                'Сумма': money(unitPrice * item.needToOrder),
            };
        }
    );

    const totalQty = orderList.reduce((s, i) => s + i.needToOrder, 0);
    const totalSum = excelData.reduce(
        (s, row) => s + (Number(row['Сумма']) || 0),
        0
    );

    excelData.push({
        'Наименование': '',
        'Артикул': '',
        'Количество': '',
        'Цена': '',
        'Сумма': '',
    });
    excelData.push({
        'Наименование': 'ИТОГО',
        'Артикул': `${orderList.length} поз.`,
        'Количество': totalQty,
        'Цена': '',
        'Сумма': money(totalSum),
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
        { wch: 40 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (!worksheet[cellAddress]) continue;
            worksheet[cellAddress].s = {
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } },
                },
            };
            if (row === 0) {
                worksheet[cellAddress].s = {
                    ...worksheet[cellAddress].s,
                    font: { bold: true, size: 12 },
                    fill: { fgColor: { rgb: 'E0E0E0' } },
                };
            }
            if (row === range.e.r) {
                worksheet[cellAddress].s = {
                    ...worksheet[cellAddress].s,
                    font: { bold: true, size: 11 },
                };
            }
            // Наименование — влево
            if (col === 0 && row > 0 && row < range.e.r) {
                worksheet[cellAddress].s = {
                    ...worksheet[cellAddress].s,
                    alignment: { horizontal: 'left', vertical: 'center' },
                };
            }
        }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Заказ деталей');

    const currentDate = new Date()
        .toLocaleDateString('ru-RU')
        .replace(/\./g, '_');
    const fileName = `Заказ_деталей_${currentDate}`;

    XLSX.writeFile(workbook, `${fileName}.xlsx`);

    showNotification(
        'Экспорт завершён',
        `Файл «${fileName}.xlsx» сохранён в загрузках. Позиций: ${orderList.length}.`,
        'success'
    );
};
