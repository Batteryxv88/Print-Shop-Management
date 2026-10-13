import { useAppSelector } from "../../../app/providers/StoreProvider/Store/hooks";
import ReplacedPart from "../../../shared/ui/replacedPart/ReplacedPart";
import { getTonerSwatchColor } from "../../../shared/lib/printers/tonerColors";
import cls from "./Report.module.scss";

const Report = () => {
    const report = useAppSelector((state) => state.report.report);

    if (!report || report.length === 0) {
        return (
            <div className={cls.report}>
                <div className={cls.empty}>
                    Нет данных для отображения
                </div>
            </div>
        );
    }

    const summary = report[0] || {};
    const tonerEntries = Object.entries(summary)
        .filter(([key]) => key.startsWith('toner') && key.length > 5)
        .map(([key, value]) => ({
            color: key.replace(/^toner/, ''),
            count: value as number,
        }));

    return (
        <div className={cls.report}>
            <div className={cls.header}>
                <h2 className={cls.title}>{summary.machine}</h2>
                <span className={cls.period}>{summary.period}</span>
            </div>
            <div className={cls.tonersWrapper}>
                <span className={cls.tonersTitle}>Тонеры:</span>
                <div className={cls.tonersGrid}>
                    {tonerEntries.map(({ color, count }) => (
                        <div className={cls.tonerItem} key={color}>
                            <div className={cls.colorWrapper}>
                                <span className={cls.colorTitle}>{color}</span>
                                <div
                                    className={cls.colorCircle}
                                    style={{ backgroundColor: getTonerSwatchColor(color) }}
                                />
                                <span className={cls.tonerValue}>{count}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={cls.partsSection}>
                <span className={cls.partsTitle}>Детали:</span>
                {report.slice(1).map((item: any, index: number) => (
                    <ReplacedPart
                        key={index}
                        id={item.id || `report-${index}`}
                        name={item.partName}
                        qty={item.quantity}
                        date={item.date}
                        man={item.man}
                        number={item.partN}
                        percent={item.percent}
                        life={item.life}
                    />
                ))}
            </div>
        </div>
    );
};

export default Report;
