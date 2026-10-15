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

export const useMaterials = (enabled = true) => {
    const dispatch = useAppDispatch();
    const materials = useAppSelector(state => state.materials.materials);
    const isLoading = useAppSelector(state => state.materials.isLoading);
    const error = useAppSelector(state => state.materials.error);

    useEffect(() => {
        if (!enabled) return;
        if (!materialsSub.unsubscribe) dispatch(setLoading(true));
        return retainSharedSubscription(materialsSub, () =>
            subscribeToMaterials((materialsData) => {
                dispatch(setMaterials(materialsData));
                dispatch(setLoading(false));
            })
        );
    }, [dispatch, enabled]);

    return { materials, isLoading, error };
};

export const useLaminations = (enabled = true) => {
    const dispatch = useAppDispatch();
    const laminations = useAppSelector(state => state.laminations.laminations);
    const isLoading = useAppSelector(state => state.laminations.isLoading);
    const error = useAppSelector(state => state.laminations.error);

    useEffect(() => {
        if (!enabled) return;
        if (!laminationsSub.unsubscribe) dispatch(setLaminationsLoading(true));
        return retainSharedSubscription(laminationsSub, () =>
            subscribeLaminations((laminationsData) => {
                dispatch(setLaminations(laminationsData));
                dispatch(setLaminationsLoading(false));
            })
        );
    }, [dispatch, enabled]);

    return { laminations, isLoading, error };
};

export const useHoldersAndKnifes = (enabled = true) => {
    const dispatch = useAppDispatch();
    const holdersAndKnifes = useAppSelector(state => state.holdersAndKnifes.holdersAndKnifes);
    const isLoading = useAppSelector(state => state.holdersAndKnifes.isLoading);
    const error = useAppSelector(state => state.holdersAndKnifes.error);

    useEffect(() => {
        if (!enabled) return;
        if (!holdersSub.unsubscribe) dispatch(setHoldersAndKnifesLoading(true));
        return retainSharedSubscription(holdersSub, () =>
            HolderAndKnifeService((holdersAndKnifesData) => {
                dispatch(setHoldersAndKnifes(holdersAndKnifesData));
                dispatch(setHoldersAndKnifesLoading(false));
            })
        );
    }, [dispatch, enabled]);

    return { holdersAndKnifes, isLoading, error };
};

export const useToners = (enabled = true) => {
    const dispatch = useAppDispatch();
    const tonersArr = useAppSelector(state => state.tonersStorage.tonersStorageArr);

    useEffect(() => {
        if (!enabled) return;
        return retainSharedSubscription(tonersStorageSub, () =>
            TonerService((tonersData) => {
                dispatch(setTonersStorage(tonersData));
            })
        );
    }, [dispatch, enabled]);

    return { tonersArr };
};

export const useParts = (enabled = true) => {
    const dispatch = useAppDispatch();
    const partsArray = useAppSelector(state => state.parts.partsArray);

    useEffect(() => {
        if (!enabled) return;
        return retainSharedSubscription(partsSub, () =>
            PartService((partsData) => {
                dispatch(setParts(partsData));
            })
        );
    }, [dispatch, enabled]);

    return { partsArray };
};

export const useUsedParts = (enabled = true) => {
    const dispatch = useAppDispatch();
    const usedPartsArray = useAppSelector(state => state.replacedParts.usedPartsArray);

    useEffect(() => {
        if (!enabled) return;
        return retainSharedSubscription(usedPartsSub, () =>
            UsedPartService((partsData) => {
                dispatch(setUsedParts(partsData));
            })
        );
    }, [dispatch, enabled]);

    return { usedPartsArray };
};

/** История замен тонеров (коллекция Toners) */
export const useTonerHistory = (enabled = true) => {
    const dispatch = useAppDispatch();
    const tonersArray = useAppSelector((state) => state.toners.tonersArray);

    useEffect(() => {
        if (!enabled) return;
        return retainSharedSubscription(tonerHistorySub, () =>
            TonerHistoryService((tonersData) => {
                dispatch(setTonersHistory(tonersData));
            })
        );
    }, [dispatch, enabled]);

    return { tonersArray };
};
