import cls from './SidebarAnalytics.module.scss';
import {
    useAppDispatch,
    useAppSelector,
} from '../../../app/providers/StoreProvider/Store/hooks';
import {
    requestAnalyticsExport,
    requestAnalyticsRefresh,
    setAnalyticsFrom,
    setAnalyticsTo,
} from '../../../app/providers/StoreProvider/Store/AnalyticsFilterSlice';

const SidebarAnalytics = () => {
    const dispatch = useAppDispatch();
    const { from, to } = useAppSelector((state) => state.analyticsFilter);

    return (
        <div className={cls.panel}>
            <div className={cls.body}>
                <header className={cls.hero}>
                    <p className={cls.heroEyebrow}>Аналитика</p>
                    <h2 className={cls.heroTitle}>Период</h2>
                    <p className={cls.heroSub}>
                        Затраты, объём печати и себестоимость клика считаются
                        в выбранных датах.
                    </p>
                </header>

                <div className={cls.block}>
                    <p className={cls.blockTitle}>Диапазон</p>
                    <label className={cls.field}>
                        <span className={cls.label}>С</span>
                        <input
                            className={cls.input}
                            type="date"
                            value={from}
                            onChange={(e) =>
                                dispatch(setAnalyticsFrom(e.target.value))
                            }
                        />
                    </label>
                    <label className={cls.field}>
                        <span className={cls.label}>По</span>
                        <input
                            className={cls.input}
                            type="date"
                            value={to}
                            onChange={(e) =>
                                dispatch(setAnalyticsTo(e.target.value))
                            }
                        />
                    </label>
                </div>
            </div>

            <footer className={cls.footer}>
                <button
                    type="button"
                    className={cls.primary}
                    onClick={() => dispatch(requestAnalyticsRefresh())}
                >
                    Обновить
                </button>
                <button
                    type="button"
                    className={cls.secondary}
                    onClick={() => dispatch(requestAnalyticsExport())}
                >
                    Excel
                </button>
                <p className={cls.hint}>
                    Excel — таблицы и диаграммы: объём, затраты, клик
                </p>
            </footer>
        </div>
    );
};

export default SidebarAnalytics;
