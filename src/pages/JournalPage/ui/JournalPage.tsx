import { useCallback, useEffect, useRef, useState } from 'react';
import cls from './JournalPage.module.scss';
import { changePage } from '../../../app/providers/StoreProvider/Store/ChangePageSlice';
import {
    useAppDispatch,
    useAppSelector,
    useParts,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import {
    changeMachine,
    changeTonerMachine,
    changeJournalKind,
    type JournalKind,
} from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import PrinterSelectTabs from '../../../shared/ui/PrinterSelectTabs/PrinterSelectTabs';
import AddToner from '../../../features/ui/AddToner/AddToner';
import AddEngineerService from '../../../features/ui/AddEngineerService/AddEngineerService';
import AddMaterialUsage from '../../../features/ui/AddMaterialUsage/AddMaterialUsage';
import { TonerReplace } from '../../../widgets/TonerReplace';
import MaintenanceList from '../../../widgets/MaintenanceList';
import MaterialUsageList from '../../../widgets/MaterialUsageList/ui/MaterialUsageList';
import EngineerServiceList from '../../../widgets/EngineerServiceList/ui/EngineerServiceList';
import AddScrap from '../../../features/ui/AddScrap/AddScrap';
import ScrapList from '../../../widgets/ScrapList/ui/ScrapList';
import CounterReadingForm from '../../../widgets/CounterReadingForm/ui/CounterReadingForm';
import {
    getPrinterDisplayNameById,
    resolveSelectedPrinterId,
} from '../../../shared/lib/printers/printerIdentity';
import { bindMaintenanceLeave, askMaintenanceLeave } from '../../../shared/lib/maintenance/leave';

const JournalPage = () => {
    const dispatch = useAppDispatch();
    const journalKind = useAppSelector((state) => state.machines.journalKind);
    const machine = useAppSelector((state) => state.machines.machine);
    const tonerMachine = useAppSelector((state) => state.machines.tonerMachine);
    const { printers } = usePrinters();
    const closeMaintenanceRef = useRef<(() => void) | null>(null);
    const closeChainRef = useRef<(() => void) | null>(null);
    const formOpenRef = useRef(false);
    const chainOpenRef = useRef(false);
    const journalKindRef = useRef(journalKind);
    const [maintenanceFormOpen, setMaintenanceFormOpen] = useState(false);
    const [chainOpen, setChainOpen] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [leaveNext, setLeaveNext] = useState<JournalKind | null>(null);
    formOpenRef.current = maintenanceFormOpen;
    chainOpenRef.current = chainOpen;
    journalKindRef.current = journalKind;
    const bindMaintenanceClose = useCallback((close: () => void) => {
        closeMaintenanceRef.current = close;
    }, []);
    const bindChainClose = useCallback((close: () => void) => {
        closeChainRef.current = close;
    }, []);
    const confirmLeave = () => {
        const next = leaveNext;
        setLeaveOpen(false);
        setLeaveNext(null);
        closeMaintenanceRef.current?.();
        if (next && next !== journalKind) dispatch(changeJournalKind(next));
    };

    useEffect(() => {
        bindMaintenanceLeave((next) => {
            if (formOpenRef.current) {
                setLeaveNext(next ?? null);
                setLeaveOpen(true);
                return true;
            }
            if (chainOpenRef.current) {
                closeChainRef.current?.();
                const kind = journalKindRef.current;
                if (next && next !== kind) dispatch(changeJournalKind(next));
                return true;
            }
            return false;
        });
        return () => bindMaintenanceLeave(null);
    }, [dispatch]);

    const needsPartsCatalog = journalKind === 'scrap';
    useParts(needsPartsCatalog);

    dispatch(changePage('journal'));

    const needsPrinter =
        journalKind === 'toner' ||
        journalKind === 'part' ||
        journalKind === 'engineer' ||
        journalKind === 'scrap';
    const selected =
        journalKind === 'toner' ? tonerMachine : machine;

    useEffect(() => {
        if (!needsPrinter || printers.length === 0) return;
        const resolved = resolveSelectedPrinterId(selected, printers);
        if (resolved !== selected) {
            dispatch(changeMachine(resolved));
            dispatch(changeTonerMachine(resolved));
        }
    }, [printers, selected, dispatch, needsPrinter]);

    const onSelectPrinter = (printerId: string) => {
        dispatch(changeMachine(printerId));
        dispatch(changeTonerMachine(printerId));
    };

    const maintenanceNav =
        journalKind === 'part' && (maintenanceFormOpen || chainOpen);
    const kindLabel =
        journalKind === 'toner'
            ? 'Заменить тонер'
            : journalKind === 'part'
              ? 'Техобслуживание'
              : journalKind === 'engineer'
                ? 'Инженер'
                : journalKind === 'scrap'
                  ? 'Брак'
                  : journalKind === 'paper'
                  ? 'Списать бумагу'
                  : journalKind === 'lamination'
                    ? 'Списать ламинацию'
                    : 'Ввести счётчики';

    return (
        <div className={cls.page} data-testid="journal-root">
            <div className={cls.browser}>
                <div className={cls.browserTop}>
                    <nav className={cls.breadcrumb} aria-label="Путь">
                        <span className={cls.crumbHome} aria-hidden>
                            ⌂
                        </span>
                        <span className={cls.crumbSep}>›</span>
                        {maintenanceNav ? (
                            <button
                                type="button"
                                className={cls.crumbBtn}
                                onClick={() => askMaintenanceLeave()}
                            >
                                Журнал учёта
                            </button>
                        ) : (
                            <span className={cls.crumb}>Журнал учёта</span>
                        )}
                        <span className={cls.crumbSep}>›</span>
                        {maintenanceNav ? (
                            <button
                                type="button"
                                className={cls.crumbBtn}
                                onClick={() => askMaintenanceLeave()}
                            >
                                {kindLabel}
                            </button>
                        ) : (
                            <span className={cls.crumb}>{kindLabel}</span>
                        )}
                        {needsPrinter && selected ? (
                            <>
                                <span className={cls.crumbSep}>›</span>
                                <span className={cls.crumbCurrent}>
                                    {getPrinterDisplayNameById(printers, selected)}
                                </span>
                            </>
                        ) : null}
                    </nav>

                    {needsPrinter ? (
                        <div className={cls.printersRow}>
                            <span className={cls.printersLabel}>
                                {journalKind === 'scrap'
                                    ? 'Где обнаружено'
                                    : 'Принтер'}
                            </span>
                            <PrinterSelectTabs
                                variant="row"
                                selected={selected}
                                locked={
                                    journalKind === 'part' && maintenanceFormOpen
                                }
                                onSelect={onSelectPrinter}
                            />
                        </div>
                    ) : null}
                </div>

                <div className={cls.content}>
                    {journalKind === 'counters' && <CounterReadingForm />}
                    {journalKind !== 'counters' && journalKind !== 'part' && (
                        <div className={cls.toolbar}>
                            {journalKind === 'toner' && <AddToner />}
                            {journalKind === 'engineer' && (
                                <AddEngineerService />
                            )}
                            {journalKind === 'scrap' && <AddScrap />}
                            {journalKind === 'paper' && (
                                <AddMaterialUsage kind="paper" />
                            )}
                            {journalKind === 'lamination' && (
                                <AddMaterialUsage kind="lamination" />
                            )}
                        </div>
                    )}

                    {journalKind === 'toner' && <TonerReplace />}
                    {journalKind === 'part' && (
                        <MaintenanceList
                            onFormOpenChange={setMaintenanceFormOpen}
                            bindClose={bindMaintenanceClose}
                            onChainOpenChange={setChainOpen}
                            bindChainClose={bindChainClose}
                        />
                    )}
                    {journalKind === 'engineer' && <EngineerServiceList />}
                    {journalKind === 'scrap' && <ScrapList />}
                    {journalKind === 'paper' && (
                        <MaterialUsageList kind="paper" />
                    )}
                    {journalKind === 'lamination' && (
                        <MaterialUsageList kind="lamination" />
                    )}
                </div>
            </div>
            {leaveOpen && (
                <div className={cls.leaveOverlay} role="presentation">
                    <div
                        className={cls.leaveDialog}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="leave-title"
                    >
                        <h2 id="leave-title" className={cls.leaveTitle}>
                            Отменить заявку?
                        </h2>
                        <p className={cls.leaveText}>
                            Несохранённые данные пропадут.
                        </p>
                        <div className={cls.leaveActions}>
                            <button
                                type="button"
                                className={cls.leaveStay}
                                onClick={() => {
                                    setLeaveOpen(false);
                                    setLeaveNext(null);
                                }}
                            >
                                Остаться
                            </button>
                            <button
                                type="button"
                                className={cls.leaveGo}
                                onClick={confirmLeave}
                            >
                                Отменить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JournalPage;
