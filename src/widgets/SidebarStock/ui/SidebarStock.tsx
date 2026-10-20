import { useEffect, useMemo, useState } from 'react';
import cls from './SidebarStock.module.scss';
import {
    useAppDispatch,
    useAppSelector,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { changeStorage } from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import { RoleBasedRoute } from '../../../components/RoleBasedRoute';
import PurchaseStock from '../../../features/ui/PurchaseStock/PurchaseStock';
import PurchaseMaterial from '../../../features/ui/PurchaseMaterial/PurchaseMaterial';
import { useOrderList } from '../../../shared/lib/hooks/useOrderList';
import {
    exportOrderListToExcel,
    setNotificationCallback,
} from '../../../shared/lib/utils/exportOrderList';
import { fetchQuantityToOrder } from '../../../app/providers/StoreProvider/Store/QuantityToOrderSlice';
import { loadAppSettings } from '../../../app/providers/StoreProvider/Store/AppSettingsSlice';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';

type SectionItem = {
    name: string;
    hint: string;
    roles?: string[];
    hasModels?: boolean;
};

const storageSectionTestId = (name: string): string | undefined => {
    switch (name) {
        case 'Детали':
            return 'storage-parts';
        case 'Тонеры':
            return 'storage-toners';
        case 'Бумага':
            return 'storage-paper';
        case 'Ламинация':
            return 'storage-lamination';
        case 'Держатели / Лезвия':
            return 'storage-holders';
        default:
            return undefined;
    }
};

const PRINTER_SECTIONS: SectionItem[] = [
    {
        name: 'Детали',
        hint: 'Запчасти и расходка',
        roles: ['администратор', 'руководитель', 'печатник'],
        hasModels: true,
    },
    {
        name: 'Тонеры',
        hint: 'Картриджи по цветам',
        roles: ['администратор', 'руководитель', 'печатник'],
        hasModels: true,
    },
];

const SidebarStock = () => {
    const dispatch = useAppDispatch();
    const storage = useAppSelector((state) => state.machines.storage);
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const {
        paperStockEnabled,
        laminationStockEnabled,
        loaded: settingsLoaded,
    } = useAppSelector((state) => state.appSettings);
    const quantityToOrderData = useAppSelector(
        (state) => state.quantityToOrder.orders
    );
    const { orderList } = useOrderList();

    const materialSections = useMemo(() => {
        const list: SectionItem[] = [];
        if (paperStockEnabled) {
            list.push({ name: 'Бумага', hint: 'Листы и рулоны' });
        }
        if (laminationStockEnabled) {
            list.push({ name: 'Ламинация', hint: 'Плёнка' });
        }
        list.push({ name: 'Держатели / Лезвия', hint: 'Оснастка' });
        return list;
    }, [paperStockEnabled, laminationStockEnabled]);

    const [notification, setNotification] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'info' | 'warning' | 'error' | 'success';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
    });

    useEffect(() => {
        dispatch(loadAppSettings());
    }, [dispatch]);

    useEffect(() => {
        if (!settingsLoaded) return;
        if (storage === 'Бумага' && !paperStockEnabled) {
            dispatch(changeStorage('Детали'));
        }
        if (storage === 'Ламинация' && !laminationStockEnabled) {
            dispatch(changeStorage('Детали'));
        }
    }, [
        settingsLoaded,
        storage,
        paperStockEnabled,
        laminationStockEnabled,
        dispatch,
    ]);

    useEffect(() => {
        setNotificationCallback(
            (
                title: string,
                message: string,
                type: 'info' | 'warning' | 'error' | 'success' = 'info'
            ) => {
                setNotification({ isOpen: true, title, message, type });
            }
        );
    }, []);

    useEffect(() => {
        if (quantityToOrderData.length === 0) {
            dispatch(fetchQuantityToOrder());
        }
    }, [dispatch, quantityToOrderData.length]);

    const renderItem = (section: SectionItem) => {
        const active = storage === section.name;
        const btn = (
            <button
                key={section.name}
                type="button"
                data-testid={storageSectionTestId(section.name)}
                className={`${cls.item} ${active ? cls.itemActive : ''}`}
                onClick={() => dispatch(changeStorage(section.name))}
            >
                <span className={cls.itemText}>
                    <span className={cls.itemName}>{section.name}</span>
                    <span className={cls.itemHint}>{section.hint}</span>
                </span>
                {section.hasModels ? (
                    <span className={cls.chevron} aria-hidden>
                        ›
                    </span>
                ) : null}
            </button>
        );

        if (section.roles) {
            return (
                <RoleBasedRoute key={section.name} allowedRoles={section.roles}>
                    {btn}
                </RoleBasedRoute>
            );
        }
        return btn;
    };

    const showPurchase =
        storage === 'Детали' ||
        storage === 'Тонеры' ||
        storage === 'Бумага' ||
        storage === 'Ламинация';

    return (
        <>
            <div className={cls.panel}>
                <header className={cls.header}>
                    <h2 className={cls.headerTitle}>Склад</h2>
                    <span className={cls.headerMeta}>Разделы</span>
                </header>

                <div className={cls.list} role="listbox" aria-label="Разделы склада">
                    <p className={cls.groupLabel}>Печать</p>
                    {PRINTER_SECTIONS.map(renderItem)}

                    <p className={cls.groupLabel}>Материалы</p>
                    {materialSections.map(renderItem)}
                </div>

                {showPurchase ? (
                    <footer className={cls.footer}>
                        <div className={cls.actions}>
                            {storage === 'Детали' || storage === 'Тонеры' ? (
                                <PurchaseStock
                                    type={
                                        storage === 'Детали' ? 'part' : 'toner'
                                    }
                                    layout="sidebar"
                                />
                            ) : null}
                            {storage === 'Бумага' ? (
                                <PurchaseMaterial kind="paper" layout="sidebar" />
                            ) : null}
                            {storage === 'Ламинация' ? (
                                <PurchaseMaterial
                                    kind="lamination"
                                    layout="sidebar"
                                />
                            ) : null}
                            {storage === 'Детали' && (
                                <button
                                    type="button"
                                    className={cls.secondaryBtn}
                                    onClick={() => {
                                        void exportOrderListToExcel(orderList);
                                    }}
                                >
                                    Заказ деталей
                                </button>
                            )}
                        </div>
                        <p className={cls.hint}>
                            {storage === 'Детали' || storage === 'Тонеры'
                                ? storageModel
                                    ? `Приход → «${storageModel}»`
                                    : 'Выберите модель справа'
                                : 'Приход с ценой и FIFO'}
                        </p>
                    </footer>
                ) : null}
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() =>
                    setNotification((prev) => ({ ...prev, isOpen: false }))
                }
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </>
    );
};

export default SidebarStock;
