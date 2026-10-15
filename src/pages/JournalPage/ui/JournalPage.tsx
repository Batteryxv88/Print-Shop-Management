import { useEffect, useMemo } from 'react';
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
} from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import { changeFilter } from '../../../app/providers/StoreProvider/Store/FilterPartSlice';
import PrinterSelectTabs from '../../../shared/ui/PrinterSelectTabs/PrinterSelectTabs';
import AddToner from '../../../features/ui/AddToner/AddToner';
import AddReplacedPart from '../../../features/ui/AddReplacedPart/AddReplacedPart';
import AddEngineerService from '../../../features/ui/AddEngineerService/AddEngineerService';
import AddMaterialUsage from '../../../features/ui/AddMaterialUsage/AddMaterialUsage';
import { TonerReplace } from '../../../widgets/TonerReplace';
import Calendar from '../../../widgets/Calendar/Calendar';
import MaterialUsageList from '../../../widgets/MaterialUsageList/ui/MaterialUsageList';
import EngineerServiceList from '../../../widgets/EngineerServiceList/ui/EngineerServiceList';
import AddScrap from '../../../features/ui/AddScrap/AddScrap';
import ScrapList from '../../../widgets/ScrapList/ui/ScrapList';
import CounterReadingForm from '../../../widgets/CounterReadingForm/ui/CounterReadingForm';
import {
    getModelByPrinterName,
    getPrinterDisplayName,
    matchesModel,
} from '../../../shared/lib/printers/printerUtils';
import { sortSections } from '../../../shared/lib/printers/sectionOrder';
import cls from './JournalPage.module.scss';

const JournalPage = () => {
    const dispatch = useAppDispatch();
    const journalKind = useAppSelector((state) => state.machines.journalKind);
    const machine = useAppSelector((state) => state.machines.machine);
    const tonerMachine = useAppSelector((state) => state.machines.tonerMachine);
    const { printers } = usePrinters();
    const needsPartsCatalog =
        journalKind === 'part' || journalKind === 'scrap';
    const { partsArray } = useParts(needsPartsCatalog);
    const filterSection = useAppSelector(
        (state) => state.filteredParts.filter.section
    );

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
        const exists = printers.some((p) => p.name === selected);
        if (!exists) {
            const first = printers[0].name;
            dispatch(changeMachine(first));
            dispatch(changeTonerMachine(first));
        }
    }, [printers, selected, dispatch, needsPrinter]);

    const onSelectPrinter = (name: string) => {
        dispatch(changeMachine(name));
        dispatch(changeTonerMachine(name));
    };

    const machineModel = useMemo(
        () => getModelByPrinterName(printers, machine),
        [printers, machine]
    );

    const sections = useMemo(() => {
        const fromMachine = partsArray
            .filter((item) => matchesModel(item.part?.model, machineModel))
            .map((item) => String(item.part?.section || '').trim())
            .filter(Boolean);
        return sortSections(fromMachine);
    }, [partsArray, machineModel]);

    useEffect(() => {
        if (journalKind !== 'part') return;
        if (filterSection === 'All') return;
        if (!sections.includes(filterSection)) {
            dispatch(changeFilter('All'));
        }
    }, [journalKind, filterSection, sections, dispatch]);

    const kindLabel =
        journalKind === 'toner'
            ? 'Заменить тонер'
            : journalKind === 'part'
              ? 'Заменить деталь'
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
        <div className={cls.page}>
            <div className={cls.browser}>
                <div className={cls.browserTop}>
                    <nav className={cls.breadcrumb} aria-label="Путь">
                        <span className={cls.crumbHome} aria-hidden>
                            ⌂
                        </span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumb}>Журнал учёта</span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumb}>{kindLabel}</span>
                        {needsPrinter && selected ? (
                            <>
                                <span className={cls.crumbSep}>›</span>
                                <span className={cls.crumbCurrent}>
                                    {getPrinterDisplayName(printers, selected)}
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
                                onSelect={onSelectPrinter}
                            />
                        </div>
                    ) : null}
                </div>

                <div className={cls.content}>
                    {journalKind === 'counters' && <CounterReadingForm />}
                    {journalKind !== 'counters' && (
                        <div className={cls.toolbar}>
                            {journalKind === 'toner' && <AddToner />}
                            {journalKind === 'part' && (
                                <>
                                    <AddReplacedPart />
                                    <label className={cls.sectionFilter}>
                                        <span>Секция</span>
                                        <select
                                            value={filterSection}
                                            onChange={(e) =>
                                                dispatch(
                                                    changeFilter(e.target.value)
                                                )
                                            }
                                            aria-label="Фильтр по секции"
                                        >
                                            <option value="All">
                                                Все секции
                                            </option>
                                            {sections.map((section) => (
                                                <option
                                                    key={section}
                                                    value={section}
                                                >
                                                    {section}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </>
                            )}
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
                    {journalKind === 'part' && <Calendar />}
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
        </div>
    );
};

export default JournalPage;
