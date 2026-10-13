import cls from "./GenerateAReport.module.scss";
import {
    useAppDispatch,
    useAppSelector,
} from "../../../app/providers/StoreProvider/Store/hooks";
import * as XLSX from "xlsx-js-style";
import { changeReport } from "../../../app/providers/StoreProvider/Store/ReportSlice";
import { useForm } from "react-hook-form";
import { transformArray } from "../../lib/transformReport/transformReport";
import { formatDatesInArray } from "../../lib/transformDateInReport/transformDate";
import {
    useMaterials,
    useLaminations,
    useToners,
    useHoldersAndKnifes,
    useParts,
    usePrinters,
    useUsedParts,
    useTonerHistory,
} from "../../../app/providers/StoreProvider/Store/hooks";
import { excelSheetName } from "../../../shared/lib/printers/printerUtils";

const GenerateAReport = () => {

    type FormValues = {
      from: string;
      to: string;
      machine: string;
  };

    const {
      register,
      formState: { errors },
      handleSubmit,
      setValue,
      reset,
  } = useForm<FormValues>({
      mode: "onChange",
  });

    const dispatch = useAppDispatch();

    const { materials } = useMaterials();
    const { laminations } = useLaminations();
    const { tonersArr } = useToners();
    const { holdersAndKnifes } = useHoldersAndKnifes();
    const { partsArray } = useParts();
    const { printers } = usePrinters();
    const { tonersArray: toners } = useTonerHistory();
    const { usedPartsArray: parts } = useUsedParts();

    const report = useAppSelector((state) => state.report.report);

    const handleGenerateReport = (e: FormValues) => {
      const filteredToners = toners.filter(
          (toner) =>
              toner.toner.machine === e.machine &&
              new Date(toner.toner.date).setHours(0, 0, 0, 0) >= new Date(e.from).setHours(0, 0, 0, 0) &&
              new Date(toner.toner.date).setHours(0, 0, 0, 0) <= new Date(e.to).setHours(0, 0, 0, 0)
      );
  
      const filteredParts = parts.filter(
          (part) =>
              part.part.machine === e.machine &&
              new Date(part.part.date).setHours(0, 0, 0, 0) >= new Date(e.from).setHours(0, 0, 0, 0) &&
              new Date(part.part.date).setHours(0, 0, 0, 0) <= new Date(e.to).setHours(0, 0, 0, 0)
      );
  
      const result = [];

      const tonerCounts: { [key: string]: number } = {};
      filteredToners.forEach((toner) => {
          const color = String(toner.toner.color || '').toUpperCase();
          if (!color) return;
          const key = `toner${color}`;
          tonerCounts[key] = (tonerCounts[key] || 0) + 1;
      });

      // Базовые CMYK всегда в сводке (даже 0), плюс любые доп. цвета
      ;['C', 'M', 'Y', 'K'].forEach((c) => {
          if (tonerCounts[`toner${c}`] === undefined) {
              tonerCounts[`toner${c}`] = 0;
          }
      });

      result.push({
          machine: e.machine,
          period: `${e.from} - ${e.to}`,
          ...tonerCounts,
      });
  
      // Добавление информации о деталях в результат
      filteredParts.forEach((part) => {
          result.push({
              partName: part.part.partName,
              partN: part.part.partN,
              partLife: part.part.serviceLife || 0,
              quantity: part.part.quantity,
              man: part.part.man,
              date: part.part.date,
              percent: part.part.percent,
          });
      });

      const formatDate = (dateString: string): string => {
        const dateObject = new Date(dateString);
        const year = dateObject.getFullYear();
        const month = dateObject.getMonth() + 1; // Месяцы в JavaScript начинаются с 0
        const day = dateObject.getDate();
        return `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    };

    // Проходим по всем элементам в результате и приводим даты
    result.forEach((item: any) => {
        if (item.date) {
            item.date = formatDate(item.date);
        }
    });
  
      dispatch(changeReport(result));
  };

  const transformedToRusLangArray = transformArray(report)
  const eee = formatDatesInArray(transformedToRusLangArray)
  

    //Экспорт отчета в exel
    const exportToFile = () => {
        const worksheet = XLSX.utils.json_to_sheet(eee);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet 1");

        // Имя файла для экспорта
        const fileName = "exportedData";

        // Сохраняем файл
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    // Функция для применения стилей к листу
    const applySheetStyles = (worksheet: any) => {
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        for (let row = range.s.r; row <= range.e.r; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                if (worksheet[cellAddress]) {
                    // Базовый стиль для всех ячеек
                    worksheet[cellAddress].s = {
                        alignment: { 
                            horizontal: "center", 
                            vertical: "center" 
                        },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    };

                    // Заголовки (первая строка) - жирный шрифт и серый фон
                    if (row === 0) {
                        worksheet[cellAddress].s = {
                            ...worksheet[cellAddress].s,
                            font: { bold: true, size: 12 },
                            fill: { 
                                fgColor: { rgb: "E0E0E0" } 
                            }
                        };
                    }

                    // Особое форматирование для разделительных колонок (пустые заголовки)
                    if (worksheet[cellAddress].v === '') {
                        worksheet[cellAddress].s = {
                            ...worksheet[cellAddress].s,
                            fill: { 
                                fgColor: { rgb: "F5F5F5" } 
                            }
                        };
                    }
                }
            }
        }
    };

    // Новая функция для полного отчета - ОПТИМИЗИРОВАНО для избежания лимита Firebase
    const exportFullReport = () => {
        const workbook = XLSX.utils.book_new();
        
        // Текущая дата для названия файла
        const currentDate = new Date().toLocaleDateString('ru-RU');

        // Листы потраченных тонеров и деталей — по каждому принтеру
        const printerNames =
            printers.length > 0
                ? printers.map((p) => p.name)
                : ['C71cf', 'Label 190'];

        if (toners && toners.length > 0) {
            printerNames.forEach((printerName) => {
                const tonersData = toners
                    .filter((t) => t.toner.machine === printerName)
                    .map((toner) => ({
                        'Аппарат': toner.toner.machine,
                        'Цвет': toner.toner.color,
                        'Счетчик': toner.toner.counter,
                        'Ответственный': toner.toner.man,
                        'Дата': new Date(toner.toner.date).toLocaleDateString('ru-RU'),
                    }));

                if (tonersData.length > 0) {
                    const sheet = XLSX.utils.json_to_sheet(tonersData);
                    sheet['!cols'] = [
                        { wch: 15 },
                        { wch: 10 },
                        { wch: 15 },
                        { wch: 20 },
                        { wch: 12 },
                    ];
                    applySheetStyles(sheet);
                    XLSX.utils.book_append_sheet(
                        workbook,
                        sheet,
                        excelSheetName('Потраченные тонеры', printerName)
                    );
                }
            });
        }

        if (parts && parts.length > 0) {
            printerNames.forEach((printerName) => {
                const partsData = parts
                    .filter((p) => p.part.machine === printerName)
                    .map((part) => ({
                        'Аппарат': part.part.machine,
                        'Наименование': part.part.partName,
                        'Артикул': part.part.partN,
                        'Количество': part.part.quantity,
                        'Ресурс': part.part.serviceLife || 0,
                        'Процент': part.part.percent,
                        'Ответственный': part.part.man,
                        'Дата': new Date(part.part.date).toLocaleDateString('ru-RU'),
                        'Секция': part.part.section,
                    }));

                if (partsData.length > 0) {
                    const sheet = XLSX.utils.json_to_sheet(partsData);
                    sheet['!cols'] = [
                        { wch: 15 },
                        { wch: 35 },
                        { wch: 15 },
                        { wch: 12 },
                        { wch: 10 },
                        { wch: 10 },
                        { wch: 20 },
                        { wch: 12 },
                        { wch: 25 },
                    ];
                    applySheetStyles(sheet);
                    XLSX.utils.book_append_sheet(
                        workbook,
                        sheet,
                        excelSheetName('Потраченные детали', printerName)
                    );
                }
            });
        }

        // 5. Лист "Склад тонеров" - только если данные есть
        if (tonersArr && tonersArr.length > 0) {
            const tonersStockData = tonersArr.map((toner: any) => ({
                'Цвет': toner.toner.color,
                'Количество': toner.toner.qty
            }));
            const tonersStockSheet = XLSX.utils.json_to_sheet(tonersStockData);
            tonersStockSheet['!cols'] = [
                { wch: 20 }, // Цвет
                { wch: 15 }  // Количество
            ];
            applySheetStyles(tonersStockSheet);
            XLSX.utils.book_append_sheet(workbook, tonersStockSheet, "Склад тонеров");
        }

        // 6. Лист "Материалы основной склад" - только если данные есть
        if (materials && materials.length > 0) {
            const newMaterialsData = materials.filter(m => m.status === 'new').map(material => ({
                'Тип': material.type,
                'Количество': material.qty,
                'Статус': 'Новый'
            }));
            
            if (newMaterialsData.length > 0) {
                const newMaterialsSheet = XLSX.utils.json_to_sheet(newMaterialsData);
                newMaterialsSheet['!cols'] = [
                    { wch: 35 }, // Тип
                    { wch: 15 }, // Количество
                    { wch: 15 }  // Статус
                ];
                applySheetStyles(newMaterialsSheet);
                XLSX.utils.book_append_sheet(workbook, newMaterialsSheet, "Материалы основной склад");
            }
        }

        // 7. Лист "Материалы брак" - только если данные есть
        if (materials && materials.length > 0) {
            const defectiveMaterialsData = materials.filter(m => m.status === 'defective').map(material => ({
                'Тип': material.type,
                'Количество': material.qty,
                'Статус': 'Брак'
            }));
            
            if (defectiveMaterialsData.length > 0) {
                const defectiveMaterialsSheet = XLSX.utils.json_to_sheet(defectiveMaterialsData);
                defectiveMaterialsSheet['!cols'] = [
                    { wch: 35 }, // Тип
                    { wch: 15 }, // Количество
                    { wch: 15 }  // Статус
                ];
                applySheetStyles(defectiveMaterialsSheet);
                XLSX.utils.book_append_sheet(workbook, defectiveMaterialsSheet, "Материалы брак");
            }
        }

        // 8. Лист "Ламинация основной склад" - только если данные есть
        if (laminations && laminations.length > 0) {
            const newLaminationsData = laminations.filter(l => l.status === 'new').map(lamination => ({
                'Тип': lamination.type,
                'Количество': lamination.qty,
                'Статус': 'Новый'
            }));
            
            if (newLaminationsData.length > 0) {
                const newLaminationsSheet = XLSX.utils.json_to_sheet(newLaminationsData);
                newLaminationsSheet['!cols'] = [
                    { wch: 35 }, // Тип
                    { wch: 15 }, // Количество
                    { wch: 15 }  // Статус
                ];
                applySheetStyles(newLaminationsSheet);
                XLSX.utils.book_append_sheet(workbook, newLaminationsSheet, "Ламинация основной склад");
            }
        }

        // 9. Лист "Ламинация брак" - только если данные есть
        if (laminations && laminations.length > 0) {
            const defectiveLaminationsData = laminations.filter(l => l.status === 'defective').map(lamination => ({
                'Тип': lamination.type,
                'Количество': lamination.qty,
                'Статус': 'Брак'
            }));
            
            if (defectiveLaminationsData.length > 0) {
                const defectiveLaminationsSheet = XLSX.utils.json_to_sheet(defectiveLaminationsData);
                defectiveLaminationsSheet['!cols'] = [
                    { wch: 35 }, // Тип
                    { wch: 15 }, // Количество
                    { wch: 15 }  // Статус
                ];
                applySheetStyles(defectiveLaminationsSheet);
                XLSX.utils.book_append_sheet(workbook, defectiveLaminationsSheet, "Ламинация брак");
            }
        }

        // 10. Лист "Склад деталей" - только если данные есть
        if (partsArray && partsArray.length > 0) {
            const partsStockData = partsArray.map((part: any) => ({
                'Наименование': part.part.partName,
                'Артикул': part.part.partN,
                'Количество': part.part.quantity,
                'Секция': part.part.section,
                'Ресурс': part.part.serviceLife || 0
            }));
            const partsStockSheet = XLSX.utils.json_to_sheet(partsStockData);
            partsStockSheet['!cols'] = [
                { wch: 35 }, // Наименование
                { wch: 15 }, // Артикул
                { wch: 12 }, // Количество
                { wch: 25 }, // Секция
                { wch: 12 }  // Ресурс
            ];
            applySheetStyles(partsStockSheet);
            XLSX.utils.book_append_sheet(workbook, partsStockSheet, "Склад деталей");
        }

        // 11. Лист "Держатели и ножи" - только если данные есть
        if (holdersAndKnifes && holdersAndKnifes.length > 0) {
            const holdersData = holdersAndKnifes.map((item: any) => ({
                'Тип': item.type === 'holder' ? 'Держатель' : 'Нож',
                'Подтип': item.sub_type === 'new' ? 'Новый' : 'Старый',
                'Количество': item.qty
            }));
            const holdersSheet = XLSX.utils.json_to_sheet(holdersData);
            holdersSheet['!cols'] = [
                { wch: 20 }, // Тип
                { wch: 15 }, // Подтип
                { wch: 15 }  // Количество
            ];
            applySheetStyles(holdersSheet);
            XLSX.utils.book_append_sheet(workbook, holdersSheet, "Держатели и ножи");
        }

        // 12. Сводный лист - только с доступными данными
        const summaryData = [
            { 'Категория': '=== СКЛАДЫ ===', 'Общее количество': '' }
        ];

        // Добавляем строки только если данные есть
        if (tonersArr && tonersArr.length > 0) {
            summaryData.push({ 'Категория': 'Тонеры на складе', 'Общее количество': tonersArr.reduce((sum: number, t: any) => sum + t.toner.qty, 0).toString() });
        }
        
        if (materials && materials.length > 0) {
            const newMaterials = materials.filter((m: any) => m.status === 'new');
            if (newMaterials.length > 0) {
                summaryData.push({ 'Категория': 'Материалы на складе (новые)', 'Общее количество': newMaterials.reduce((sum: number, m: any) => sum + m.qty, 0).toString() });
            }
            
            const defectiveMaterials = materials.filter((m: any) => m.status === 'defective');
            if (defectiveMaterials.length > 0) {
                summaryData.push({ 'Категория': 'Материалы брак', 'Общее количество': defectiveMaterials.reduce((sum: number, m: any) => sum + m.qty, 0).toString() });
            }
        }
        
        if (laminations && laminations.length > 0) {
            const newLaminations = laminations.filter((l: any) => l.status === 'new');
            if (newLaminations.length > 0) {
                summaryData.push({ 'Категория': 'Ламинация на складе (новая)', 'Общее количество': newLaminations.reduce((sum: number, l: any) => sum + l.qty, 0).toString() });
            }
            
            const defectiveLaminations = laminations.filter((l: any) => l.status === 'defective');
            if (defectiveLaminations.length > 0) {
                summaryData.push({ 'Категория': 'Ламинация брак', 'Общее количество': defectiveLaminations.reduce((sum: number, l: any) => sum + l.qty, 0).toString() });
            }
        }
        
        if (partsArray && partsArray.length > 0) {
            summaryData.push({ 'Категория': 'Детали на складе', 'Общее количество': partsArray.reduce((sum: number, p: any) => sum + p.part.quantity, 0).toString() });
        }
        
        if (holdersAndKnifes && holdersAndKnifes.length > 0) {
            summaryData.push({ 'Категория': 'Держатели и ножи', 'Общее количество': holdersAndKnifes.reduce((sum: number, h: any) => sum + h.qty, 0).toString() });
        }

        summaryData.push({ 'Категория': '', 'Общее количество': '' });
        summaryData.push({ 'Категория': '=== ПОТРАЧЕНО ===', 'Общее количество': '' });

        if (toners && toners.length > 0) {
            printerNames.forEach((printerName) => {
                const machineToners = toners.filter(
                    (t: any) => t.toner.machine === printerName
                );
                if (machineToners.length > 0) {
                    summaryData.push({
                        'Категория': `Потрачено тонеров ${printerName}`,
                        'Общее количество': machineToners.length.toString(),
                    });
                }
            });
        }
        
        if (parts && parts.length > 0) {
            printerNames.forEach((printerName) => {
                const machineParts = parts.filter(
                    (p: any) => p.part.machine === printerName
                );
                if (machineParts.length > 0) {
                    summaryData.push({
                        'Категория': `Потрачено деталей ${printerName}`,
                        'Общее количество': machineParts.length.toString(),
                    });
                }
            });
        }

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        summarySheet['!cols'] = [
            { wch: 40 }, // Категория
            { wch: 20 }  // Общее количество
        ];
        applySheetStyles(summarySheet);
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Сводка");

        // Сохраняем файл с указанием даты
        const fileName = `Полный_отчет_${currentDate.replace(/\./g, '_')}`;
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    };

    return (
        <div>
            <form onSubmit={handleSubmit(handleGenerateReport)} className={cls.form}>
                <h2 className={cls.title}>
                    Отчет по использованию тонеров и деталей
                </h2>
                <div className={cls.wrapper}>
                    <span className={cls.span}>От</span>
                    <div className={cls.inputWrapper}>
                        <input
                            className={cls.date}
                            type="date"
                            {...register("from", {
                              required: "Обязательное поле"
                          })}
                        ></input>
                        {errors.from && <p className={cls.error}>{errors.from.message}</p>}
                    </div>
                </div>
                <div className={cls.wrapper}>
                    <span className={cls.span}>До</span>
                    <div className={cls.inputWrapper}>
                        <input
                            className={cls.date}
                            type="date"
                            {...register("to", {
                              required: "Обязательное поле"
                          })}
                        ></input>
                        {errors.to && <p className={cls.error}>{errors.to.message}</p>}
                    </div>
                </div>
                <div className={cls.wrapper1}>
                    <select
                        className={cls.input}
                        {...register("machine", {
                          required: "Обязательное поле",
                      })}
                    >
                        {printers.length > 0
                            ? printers.map((printer) => (
                                  <option key={printer.id} value={printer.name}>
                                      {printer.name}
                                  </option>
                              ))
                            : (
                                <>
                                    <option value={"C71cf"}>C71cf</option>
                                    <option value={"Label 190"}>Label 190</option>
                                </>
                              )}
                    </select>
                </div>
                <button className={cls.submit} type="submit">
                    Сформировать
                </button>
                <button className={cls.buttonExport} type="button" onClick={exportToFile}>
                    Экспорт в Excel
                </button>
                <button className={cls.buttonFullExport} type="button" onClick={exportFullReport}>
                    Полный отчет Excel
                </button>
            </form>
        </div>
    );
};

export default GenerateAReport;
