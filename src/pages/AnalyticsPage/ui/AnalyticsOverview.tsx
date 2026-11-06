import cls from './AnalyticsPage.module.scss';
import { formatMoney, formatSigned } from './analyticsFormatters';

type AnalyticsOverviewProps = {
    stockValue: number;
    purchaseCost: number;
    usedCost: number;
    scrapCost: number;
    economyTotal: number;
};

const AnalyticsOverview = ({
    stockValue,
    purchaseCost,
    usedCost,
    scrapCost,
    economyTotal,
}: AnalyticsOverviewProps) => (
    <>
        <div className={cls.kpis}>
            <div className={cls.kpi}>
                <div className={cls.kpiLabel}>Остаток на складе</div>
                <div className={`${cls.kpiValue} ${cls.kpiAccent}`}>
                    {formatMoney(stockValue)} ₽
                </div>
            </div>
            <div className={cls.kpi}>
                <div className={cls.kpiLabel}>Закуплено за период</div>
                <div className={cls.kpiValue}>
                    {formatMoney(purchaseCost)} ₽
                </div>
            </div>
            <div className={cls.kpi}>
                <div className={cls.kpiLabel}>Потрачено за период</div>
                <div className={cls.kpiValue}>
                    {formatMoney(usedCost)} ₽
                </div>
                <div className={cls.kpiSub}>
                    замены, расходка, тонер, инженер
                </div>
            </div>
            <div className={cls.kpi}>
                <div className={cls.kpiLabel}>Брак и потери</div>
                <div className={cls.kpiValue}>
                    {formatMoney(scrapCost)} ₽
                </div>
                <div className={cls.kpiSub}>
                    списано как брак, не в «Потрачено»
                </div>
            </div>
            <div className={cls.kpi}>
                <div className={cls.kpiLabel}>Экономия / перерасход</div>
                <div
                    className={`${cls.kpiValue} ${
                        economyTotal > 0
                            ? cls.positive
                            : economyTotal < 0
                              ? cls.negative
                              : ''
                    }`}
                >
                    {formatSigned(economyTotal)} ₽
                </div>
            </div>
        </div>

        <p
            className={cls.compactNotice}
            data-testid="analytics-mobile-notice"
        >
            На телефоне доступны только сводные KPI. Графики, таблицы и
            выгрузка Excel — на планшете или компьютере.
        </p>
    </>
);

export default AnalyticsOverview;
