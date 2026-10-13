import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";
import { useEffect } from 'react';
import { subscribeToMaterials, subscribeLaminations } from '../../../../services/materials';
import { setMaterials, setLoading } from './MaterialsSlice';
import { setLaminations, setLoading as setLaminationsLoading } from './LaminationsSlice';
import { setHoldersAndKnifes, setLoading as setHoldersAndKnifesLoading } from "./HoldersAndKnifesSlice";
import { HolderAndKnifeService } from "../../../../services/holdersAndKnifes";
import { TonerService } from '../../../../services/toners';
import { setTonersStorage } from './TonersStorageSlice';
import { PartService } from '../../../../services/parts';
import { setParts } from './PartSlice';
import { UsedPartService } from '../../../../services/usedParts';
import { setUsedParts } from './ReplacedPartSlice';
import { TonerHistoryService } from '../../../../services/tonerHistory';
import { setTonersHistory } from './TonerSlice';
import { subscribeToPrinters } from '../../../../services/printers';
import { setPrinters, setPrintersLoading } from './PrintersSlice';
import {
    changeMachine,
    changeTonerMachine,
    changeStorageModel,
    changeReportEditorMachine,
} from './ChangeMachineSlice';
import { getUniqueModels } from '../../../../shared/lib/printers/printerUtils';
import {
    createSharedSubscription,
    retainSharedSubscription,
} from '../../../../shared/lib/firebase/sharedSubscription';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

const printersSub = createSharedSubscription();
const materialsSub = createSharedSubscription();
const laminationsSub = createSharedSubscription();
const holdersSub = createSharedSubscription();
const tonersStorageSub = createSharedSubscription();
const partsSub = createSharedSubscription();
const usedPartsSub = createSharedSubscription();
const tonerHistorySub = createSharedSubscription();

export const usePrinters = () => {
    const dispatch = useAppDispatch();
    const printers = useAppSelector((state) => state.printers.printers);
    const isLoading = useAppSelector((state) => state.printers.isLoading);
    const error = useAppSelector((state) => state.printers.error);
    const machine = useAppSelector((state) => state.machines.machine);
    const tonerMachine = useAppSelector((state) => state.machines.tonerMachine);
    const storageModel = useAppSelector((state) => state.machines.storageModel);
    const reportEditorMachine = useAppSelector(
        (state) => state.machines.reportEditorMachine
    );

    useEffect(() => {
        // Флаг загрузки ставим только когда подписка реально стартует:
        // если она уже активна (общая на всё приложение), данные в сторе
        // уже есть и колбэк повторно не придёт.
        if (!printersSub.unsubscribe) dispatch(setPrintersLoading(true));
        return retainSharedSubscription(printersSub, () =>
            subscribeToPrinters((printersData) => {
                dispatch(setPrinters(printersData));
            })
        );
    }, [dispatch]);

    useEffect(() => {
        if (printers.length === 0) return;

        const names = printers.map((p) => p.name);
        const models = getUniqueModels(printers);

        if (!names.includes(machine)) {
            dispatch(changeMachine(names[0]));
        }
        if (!names.includes(tonerMachine)) {
            dispatch(changeTonerMachine(names[0]));
        }
        if (!storageModel || !models.includes(storageModel)) {
            dispatch(changeStorageModel(models[0] || ''));
        }
        if (!reportEditorMachine || !names.includes(reportEditorMachine)) {
            dispatch(changeReportEditorMachine(names[0]));
        }
    }, [
        printers,
        machine,
        tonerMachine,
        storageModel,
        reportEditorMachine,
        dispatch,
    ]);

    return { printers, isLoading, error };
};

export const useMaterials = () => {
    const dispatch = useAppDispatch();
    const materials = useAppSelector(state => state.materials.materials);
    const isLoading = useAppSelector(state => state.materials.isLoading);
    const error = useAppSelector(state => state.materials.error);

    useEffect(() => {
        if (!materialsSub.unsubscribe) dispatch(setLoading(true));
        return retainSharedSubscription(materialsSub, () =>
            subscribeToMaterials((materialsData) => {
                dispatch(setMaterials(materialsData));
                dispatch(setLoading(false));
            })
        );
    }, [dispatch]);

    return { materials, isLoading, error };
};

export const useLaminations = () => {
    const dispatch = useAppDispatch();
    const laminations = useAppSelector(state => state.laminations.laminations);
    const isLoading = useAppSelector(state => state.laminations.isLoading);
    const error = useAppSelector(state => state.laminations.error);

    useEffect(() => {
        if (!laminationsSub.unsubscribe) dispatch(setLaminationsLoading(true));
        return retainSharedSubscription(laminationsSub, () =>
            subscribeLaminations((laminationsData) => {
                dispatch(setLaminations(laminationsData));
                dispatch(setLaminationsLoading(false));
            })
        );
    }, [dispatch]);

    return { laminations, isLoading, error };
};

export const useHoldersAndKnifes = () => {
    const dispatch = useAppDispatch();
    const holdersAndKnifes = useAppSelector(state => state.holdersAndKnifes.holdersAndKnifes);
    const isLoading = useAppSelector(state => state.holdersAndKnifes.isLoading);
    const error = useAppSelector(state => state.holdersAndKnifes.error);

    useEffect(() => {
        if (!holdersSub.unsubscribe) dispatch(setHoldersAndKnifesLoading(true));
        return retainSharedSubscription(holdersSub, () =>
            HolderAndKnifeService((holdersAndKnifesData) => {
                dispatch(setHoldersAndKnifes(holdersAndKnifesData));
                dispatch(setHoldersAndKnifesLoading(false));
            })
        );
    }, [dispatch]);

    return { holdersAndKnifes, isLoading, error };
};

export const useToners = () => {
    const dispatch = useAppDispatch();
    const tonersArr = useAppSelector(state => state.tonersStorage.tonersStorageArr);

    useEffect(() => {
        return retainSharedSubscription(tonersStorageSub, () =>
            TonerService((tonersData) => {
                dispatch(setTonersStorage(tonersData));
            })
        );
    }, [dispatch]);

    return { tonersArr };
};

export const useParts = () => {
    const dispatch = useAppDispatch();
    const partsArray = useAppSelector(state => state.parts.partsArray);

    useEffect(() => {
        return retainSharedSubscription(partsSub, () =>
            PartService((partsData) => {
                dispatch(setParts(partsData));
            })
        );
    }, [dispatch]);

    return { partsArray };
};

export const useUsedParts = () => {
    const dispatch = useAppDispatch();
    const usedPartsArray = useAppSelector(state => state.replacedParts.usedPartsArray);

    useEffect(() => {
        return retainSharedSubscription(usedPartsSub, () =>
            UsedPartService((partsData) => {
                dispatch(setUsedParts(partsData));
            })
        );
    }, [dispatch]);

    return { usedPartsArray };
};

/** История замен тонеров (коллекция Toners) */
export const useTonerHistory = () => {
    const dispatch = useAppDispatch();
    const tonersArray = useAppSelector((state) => state.toners.tonersArray);

    useEffect(() => {
        return retainSharedSubscription(tonerHistorySub, () =>
            TonerHistoryService((tonersData) => {
                dispatch(setTonersHistory(tonersData));
            })
        );
    }, [dispatch]);

    return { tonersArray };
};
