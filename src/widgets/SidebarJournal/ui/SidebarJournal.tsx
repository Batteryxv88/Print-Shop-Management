import { useEffect, useMemo } from 'react';
import cls from './SidebarJournal.module.scss';
import {
    useAppDispatch,
    useAppSelector,
} from '../../../app/providers/StoreProvider/Store/hooks';
import {
    changeJournalKind,
    type JournalKind,
} from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import { loadAppSettings } from '../../../app/providers/StoreProvider/Store/AppSettingsSlice';

const SidebarJournal = () => {
    const dispatch = useAppDispatch();
    const journalKind = useAppSelector((state) => state.machines.journalKind);
    const { paperStockEnabled, laminationStockEnabled } = useAppSelector(
        (state) => state.appSettings
    );
    const needCounters = useAppSelector(
        (state) => state.counterReading.showReminder
    );

    useEffect(() => {
        dispatch(loadAppSettings());
    }, [dispatch]);

    const modes = useMemo(() => {
        type JournalMode = {
            kind: JournalKind;
            name: string;
            hint: string;
        };
        const list: JournalMode[] = [
            {
                kind: 'toner',
                name: 'Заменить тонер',
                hint: 'История замен тонера',
            },
            {
                kind: 'part',
                name: 'Заменить деталь',
                hint: 'История замен деталей',
            },
            {
                kind: 'engineer',
                name: 'Инженер',
                hint: 'Расходы на сервисного инженера',
            },
            {
                kind: 'scrap',
                name: 'Брак',
                hint: 'Списание бракованного товара',
            },
        ];
        if (paperStockEnabled) {
            list.push({
                kind: 'paper',
                name: 'Списать бумагу',
                hint: 'Использование со склада',
            });
        }
        if (laminationStockEnabled) {
            list.push({
                kind: 'lamination',
                name: 'Списать ламинацию',
                hint: 'Использование со склада',
            });
        }
        list.push({
            kind: 'counters',
            name: 'Ввести счётчики',
            hint: needCounters
                ? 'Пора снять показания'
                : 'Показания машин по месяцам',
        });
        return list;
    }, [paperStockEnabled, laminationStockEnabled, needCounters]);

    useEffect(() => {
        const allowed = modes.map((m) => m.kind);
        if (!allowed.includes(journalKind as (typeof allowed)[number])) {
            dispatch(changeJournalKind('toner'));
        }
    }, [modes, journalKind, dispatch]);

    return (
        <div className={cls.panel}>
            <header className={cls.header}>
                <h2 className={cls.headerTitle}>Журнал</h2>
                <span className={cls.headerMeta}>Учёт</span>
            </header>

            <div className={cls.list}>
                <p className={cls.groupLabel}>Тип записи</p>
                {modes.map((mode) => {
                    const active = journalKind === mode.kind;
                    return (
                        <button
                            key={mode.kind}
                            type="button"
                            className={`${cls.item} ${active ? cls.itemActive : ''}`}
                            onClick={() =>
                                dispatch(changeJournalKind(mode.kind))
                            }
                        >
                            <span className={cls.itemText}>
                                <span className={cls.itemName}>
                                    {mode.name}
                                    {mode.kind === 'counters' &&
                                        needCounters && (
                                            <i
                                                className={cls.attentionDot}
                                                aria-label="Пора снять счётчики"
                                            />
                                        )}
                                </span>
                                <span className={cls.itemHint}>{mode.hint}</span>
                            </span>
                            <span className={cls.chevron} aria-hidden>
                                ›
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SidebarJournal;
