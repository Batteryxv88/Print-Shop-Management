import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';
import { changeJournalKind } from '../../../app/providers/StoreProvider/Store/ChangeMachineSlice';
import {
    formatPeriodLabel,
    getActivePeriodKey,
    getOverdueDays,
} from '../../lib/utils/counterReading';
import cls from './CounterReadingReminder.module.scss';

const CounterReadingReminder = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { showReminder, counterReadingDay } = useAppSelector(
        (state) => state.counterReading
    );

    if (!showReminder || !counterReadingDay) return null;

    const periodKey = getActivePeriodKey(counterReadingDay);
    if (!periodKey) return null;

    const overdue = getOverdueDays(counterReadingDay, periodKey);
    const label = formatPeriodLabel(periodKey);
    const title =
        overdue > 0
            ? `Показания за ${label} просрочены на ${overdue} дн. Перейти к вводу счётчиков`
            : `Снять показания за ${label} до ${counterReadingDay}-го. Перейти к вводу счётчиков`;

    return (
        <button
            type="button"
            className={`${cls.chip} ${overdue > 0 ? cls.chipOverdue : ''}`}
            onClick={() => {
                dispatch(changeJournalKind('counters'));
                navigate('/journal');
            }}
            title={title}
        >
            <i className={cls.dot} aria-hidden />
            <span className={cls.text}>Счётчики</span>
            <span className={cls.meta}>
                {overdue > 0 ? `+${overdue} дн.` : `до ${counterReadingDay}-го`}
            </span>
        </button>
    );
};

export default CounterReadingReminder;
