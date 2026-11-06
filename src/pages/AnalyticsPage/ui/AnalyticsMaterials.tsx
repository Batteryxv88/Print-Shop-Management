import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { MaterialKind } from '../../../shared/lib/stock/buildMaterialsSummary';
import type { MaterialsSummary } from '../../../shared/lib/stock/buildMaterialsSummary';
import { formatCount, formatMoney } from './analyticsFormatters';
import cls from './AnalyticsPage.module.scss';

const MATERIAL_LABELS: Record<MaterialKind, string> = {
    paper: 'Бумага',
    lamination: 'Ламинация',
};

type AnalyticsMaterialsProps = {
    materials: MaterialsSummary;
    materialKinds: MaterialKind[];
};

const AnalyticsMaterials = ({
    materials,
    materialKinds,
}: AnalyticsMaterialsProps) => (
    <section className={cls.section}>
        <div className={cls.sectionHead}>
            <h2 className={cls.sectionTitle}>Материалы</h2>
            <p className={cls.sectionHint}>
                Бумага и ламинация учитываются отдельно от принтеров:
                закуплено и потрачено за период, остаток — по открытым партиям.
            </p>
        </div>
        <div className={cls.materialsCard}>
            <div className={cls.materialsGrid}>
                {materialKinds.map((k) => {
                    const t = materials.byKind[k];
                    return (
                        <div key={k} className={cls.materialBlock}>
                            <div className={cls.materialTitle}>
                                {MATERIAL_LABELS[k]}
                            </div>
                            <dl className={cls.materialDl}>
                                <div>
                                    <dt>Закуплено</dt>
                                    <dd>
                                        {t.purchasedQty > 0 ? (
                                            <>
                                                {formatCount(t.purchasedQty)}{' '}
                                                шт.
                                                <small>
                                                    {formatMoney(
                                                        t.purchasedCost
                                                    )}{' '}
                                                    ₽
                                                </small>
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Потрачено</dt>
                                    <dd>
                                        {t.usedQty > 0 ? (
                                            <>
                                                {formatCount(t.usedQty)} шт.
                                                <small>
                                                    {formatMoney(t.usedCost)}{' '}
                                                    ₽
                                                </small>
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </dd>
                                </div>
                                {t.scrapQty > 0 ? (
                                    <div>
                                        <dt>Брак</dt>
                                        <dd>
                                            {formatCount(t.scrapQty)} шт.
                                            <small>
                                                {formatMoney(t.scrapCost)}{' '}
                                                ₽
                                            </small>
                                        </dd>
                                    </div>
                                ) : null}
                                <div>
                                    <dt>Остаток</dt>
                                    <dd>
                                        {t.stockQty > 0 ? (
                                            <>
                                                {formatCount(t.stockQty)} шт.
                                                <small>
                                                    {formatMoney(
                                                        t.stockValue
                                                    )}{' '}
                                                    ₽
                                                </small>
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    );
                })}
            </div>

            {materials.months.length > 0 && (
                <div className={cls.materialsChart}>
                    <div className={cls.materialsLegend}>
                        <span>
                            <i className={cls.legendPurchase} />
                            Закуплено
                        </span>
                        <span>
                            <i className={cls.legendUsed} />
                            Потрачено
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart
                            data={materials.months}
                            barGap={2}
                            barCategoryGap="30%"
                        >
                            <CartesianGrid
                                stroke="rgba(255,255,255,0.06)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                stroke="rgba(255,255,255,0.4)"
                                fontSize={11}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="rgba(255,255,255,0.4)"
                                fontSize={11}
                                width={56}
                                tickLine={false}
                                tickFormatter={(v) => {
                                    const n = Number(v);
                                    return n >= 1000
                                        ? `${Math.round(n / 1000)}k ₽`
                                        : `${n} ₽`;
                                }}
                            />
                            <Tooltip
                                cursor={{
                                    fill: 'rgba(255,255,255,0.04)',
                                }}
                                contentStyle={{
                                    background: '#141414',
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                }}
                                formatter={(value: number, name: string) => [
                                    `${formatMoney(Number(value))} ₽`,
                                    name === 'purchased'
                                        ? 'Закуплено'
                                        : 'Потрачено',
                                ]}
                            />
                            <Bar
                                dataKey="purchased"
                                fill="rgba(144, 164, 196, 0.75)"
                                radius={[3, 3, 0, 0]}
                                isAnimationActive={false}
                            />
                            <Bar
                                dataKey="used"
                                fill="#81C784"
                                radius={[3, 3, 0, 0]}
                                isAnimationActive={false}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    </section>
);

export default AnalyticsMaterials;
