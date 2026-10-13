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
import PrinterModelTabs from '../../../shared/ui/PrinterModelTabs/PrinterModelTabs';
import LoadingPlug from '../../../shared/ui/LoadingPlug/LoadingPlug';
import { useAuth } from '../../../contexts/AuthContext';
import cls from './MainPage.module.scss';

const needsModel = (section: string) =>
    section === 'Детали' || section === 'Тонеры';

const MainPage = () => {
    const dispatch = useAppDispatch();
    const storageState = useAppSelector((state) => state.machines.storage);
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const { printers } = usePrinters();
    const models = getUniqueModels(printers);
    const { userData, loading } = useAuth();

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
                                showModels && storageModel
                                    ? cls.crumb
                                    : cls.crumbCurrent
                            }
                        >
                            {storageState}
                        </span>
                        {showModels && storageModel ? (
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

                <div className={cls.content}>
                    {storageState === 'Детали' ? (
                        <Stock />
                    ) : storageState === 'Тонеры' ? (
                        <TonersStorage />
                    ) : storageState === 'Бумага' ? (
                        <PaperStockPage />
                    ) : storageState === 'Ламинация' ? (
                        <LaminationStockPage />
                    ) : storageState === 'Держатели / Лезвия' ? (
                        <HoldersAndKnifesStockPage />
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default MainPage;
