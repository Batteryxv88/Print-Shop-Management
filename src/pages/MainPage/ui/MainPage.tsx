import { useEffect } from 'react';
import { changePage } from '../../../app/providers/StoreProvider/Store/ChangePageSlice';
import {
    useAppDispatch,
    useAppSelector,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import {
    changeStorage,
    changeStorageModel,
} from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import { getUniqueModels } from '../../../shared/lib/printers/printerUtils';
import Stock from '../../../widgets/Stock/ui/Stock';
import TonersStorage from '../../../widgets/TonersStorage/ui/TonersStorage';
import PaperStockPage from '../../PaperStockPage/ui/PaperStockPage';
import LaminationStockPage from '../../LaminationStockPage/ui/LaminationStockPage';
import HoldersAndKnifesStockPage from '../../HoldersAndKnifesStockPage/ui/HoldersAndKnifesStockPage';
import StockInventorization from '../../PartsInventorization/ui/StockInventorization';
import PrinterModelTabs from '../../../shared/ui/PrinterModelTabs/PrinterModelTabs';
import LoadingPlug from '../../../shared/ui/LoadingPlug/LoadingPlug';
import { useAuth } from '../../../contexts/AuthContext';
import type { StockInventoryItemType } from '../../../services/stockAccounting';
import cls from './MainPage.module.scss';

const needsModel = (section: string) =>
    section === 'Детали' || section === 'Тонеры';

const inventoryKindForStorage = (
    storage: string
): StockInventoryItemType | null => {
    switch (storage) {
        case 'Детали':
            return 'part';
        case 'Тонеры':
            return 'toner';
        case 'Бумага':
            return 'paper';
        case 'Ламинация':
            return 'lamination';
        default:
            return null;
    }
};

const MainPage = () => {
    const dispatch = useAppDispatch();
    const storageState = useAppSelector((state) => state.machines.storage);
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const inventorizationOpen = useAppSelector(
        (state) => state.machines.storageInventorizationOpen
    );
    const { printers } = usePrinters();
    const models = getUniqueModels(printers);
    const { userData, loading } = useAuth();

    const inventoryKind = inventoryKindForStorage(storageState);

    useEffect(() => {
        if (!loading && userData) {
            if (userData.role === 'дизайнер') {
                dispatch(changeStorage('Бумага'));
            } else if (userData.role === 'резчик') {
                dispatch(changeStorage('Держатели / Лезвия'));
            } else if (userData.role === 'менеджер') {
                dispatch(changeStorage('Бумага'));
            } else {
                dispatch(changeStorage('Детали'));
            }
        }
    }, [loading, userData, dispatch]);

    useEffect(() => {
        if (!needsModel(storageState)) return;
        if (storageModel && models.includes(storageModel)) return;
        if (models.length > 0) {
            dispatch(changeStorageModel(models[0]));
        }
    }, [storageState, storageModel, models, dispatch]);

    dispatch(changePage('main'));

    if (loading) {
        return <LoadingPlug />;
    }

    const showModels = needsModel(storageState);

    const renderStockContent = () => {
        if (inventorizationOpen && inventoryKind) {
            return <StockInventorization kind={inventoryKind} />;
        }
        if (storageState === 'Детали') return <Stock />;
        if (storageState === 'Тонеры') return <TonersStorage />;
        if (storageState === 'Бумага') return <PaperStockPage />;
        if (storageState === 'Ламинация') return <LaminationStockPage />;
        if (storageState === 'Держатели / Лезвия') {
            return <HoldersAndKnifesStockPage />;
        }
        return null;
    };

    return (
        <div className={cls.MainPage}>
            <div className={cls.browser}>
                <div className={cls.browserTop}>
                    <nav className={cls.breadcrumb} aria-label="Путь">
                        <span className={cls.crumbHome} aria-hidden>
                            ⌂
                        </span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumb}>Склад</span>
                        <span className={cls.crumbSep}>›</span>
                        <span
                            className={
                                inventorizationOpen ||
                                (showModels && storageModel)
                                    ? cls.crumb
                                    : cls.crumbCurrent
                            }
                        >
                            {storageState}
                        </span>
                        {inventorizationOpen ? (
                            <>
                                <span className={cls.crumbSep}>›</span>
                                <span className={cls.crumbCurrent}>
                                    Инвентаризация
                                </span>
                            </>
                        ) : showModels && storageModel ? (
                            <>
                                <span className={cls.crumbSep}>›</span>
                                <span className={cls.crumbCurrent}>
                                    {storageModel}
                                </span>
                            </>
                        ) : null}
                    </nav>

                    {showModels ? (
                        <div className={cls.modelsRow}>
                            <span className={cls.modelsLabel}>Модель</span>
                            <PrinterModelTabs />
                        </div>
                    ) : null}
                </div>

                <div className={cls.content}>{renderStockContent()}</div>
            </div>
        </div>
    );
};

export default MainPage;
