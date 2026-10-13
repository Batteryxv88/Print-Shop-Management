import cls from './PrinterModelTabs.module.scss';
import {
    useAppDispatch,
    useAppSelector,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { changeStorageModel } from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import { getUniqueModels } from '../../lib/printers/printerUtils';

const PrinterModelTabs = () => {
    const dispatch = useAppDispatch();
    const { printers } = usePrinters();
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const models = getUniqueModels(printers);

    if (models.length === 0) return null;

    return (
        <div className={cls.tabs}>
            {models.map((model) => (
                <button
                    key={model}
                    type="button"
                    className={
                        storageModel === model ? cls.activeTab : cls.tab
                    }
                    onClick={() => dispatch(changeStorageModel(model))}
                >
                    {model}
                </button>
            ))}
        </div>
    );
};

export default PrinterModelTabs;
