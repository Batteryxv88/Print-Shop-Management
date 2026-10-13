import { useEffect, useMemo, useRef } from "react";
import cls from "./ReportEditor.module.scss";
import EditReportPart from "../../../shared/ui/EditReportPart/EditReportPart";
import { useAppDispatch, useAppSelector, usePrinters, useParts } from "../../../app/providers/StoreProvider/Store/hooks";
import { useQuantityToOrder } from "../../../shared/lib/hooks/useQuantityToOrder";
import { subscribeToQuantityToOrder } from "../../../services/quantityToOrder";
import { changeReportEditorMachine } from "../../../app/providers/StoreProvider/Store/ChangeMachineSlice";
import {
    getModelByPrinterName,
    matchesModel,
} from "../../../shared/lib/printers/printerUtils";
import { sortSections } from "../../../shared/lib/printers/sectionOrder";

const ReportEditor = () => {
    const dispatch = useAppDispatch();
    const { setOrders, orders } = useQuantityToOrder();
    const { printers } = usePrinters();
    const { partsArray } = useParts();
    const subscriptionRef = useRef<(() => void) | null>(null);
    
    const reportEditorMachine = useAppSelector(
        (state) => state.machines.reportEditorMachine
    );
    const selectedModel = getModelByPrinterName(printers, reportEditorMachine);

    useEffect(() => {
        if (!subscriptionRef.current) {
            subscriptionRef.current = subscribeToQuantityToOrder((ordersData) => {
                setOrders(ordersData);
            });
        }

        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current();
                subscriptionRef.current = null;
            }
        };
    }, [setOrders]);

    const reportData = useMemo(() => {
        return partsArray
            .filter((partData: any) =>
                matchesModel(partData.part?.model, selectedModel)
            )
            .map((partData: any) => {
                const part = partData.part;
                const partId = partData.id;
                
                const orderData = orders.find(order => order.PartN === part.partN);
                
                return {
                    id: partId,
                    name: part.partName,
                    number: part.partN,
                    qtyStock: part.quantity,
                    qtyOrder: orderData?.qty || 0,
                    use: orderData?.use || false,
                    orderDataId: orderData?.id || null,
                    section: part.section || "Other",
                };
            });
    }, [partsArray, orders, selectedModel]);

    const sections = useMemo(
        () => sortSections(reportData.map((item) => item.section)),
        [reportData]
    );

    const renderSection = (section: string) => {
        const filteredData = reportData.filter(
            (item) => item.section === section
        );

        if (filteredData.length === 0) {
            return null;
        }

        return (
            <div key={section}>
                <h3 className={cls.title}>{section}</h3>
                {filteredData.map((item) => (
                    <EditReportPart
                        key={`${item.id}-${item.number}`}
                        {...item}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className={cls.reportEditor}>
            <h2 className={cls.h2}>Редактор отчета для заказа деталей</h2>

            <div className={cls.printerTabs}>
                {printers.map((printer) => (
                    <button
                        key={printer.id}
                        type="button"
                        className={
                            reportEditorMachine === printer.name
                                ? cls.printerActive
                                : cls.printerTab
                        }
                        onClick={() =>
                            dispatch(changeReportEditorMachine(printer.name))
                        }
                    >
                        {printer.name}
                    </button>
                ))}
            </div>

            {selectedModel && (
                <p className={cls.modelHint}>Модель склада: {selectedModel}</p>
            )}

            <div className={cls.titleBox}>
                <p className={cls.name}>Наименование</p>
                <p className={cls.number}>Парт номер</p>
                <p className={cls.quantity}>Кол-во на складе</p>
                <div className={cls.editBox}>
                    <p className={cls.edit}>Кол-во для заказа</p>
                    <p className={cls.edit}>Включить в заказ</p>
                    <p className={cls.editMain}>Редактировать</p>
                </div>
            </div>
            {sections.map((section) => renderSection(section))}
        </div>
    );
};

export default ReportEditor;
