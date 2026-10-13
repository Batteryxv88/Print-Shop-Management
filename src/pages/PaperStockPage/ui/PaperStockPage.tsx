import { useMemo } from 'react';
import cls from './PaperStockPage.module.scss';
import { useMaterials, useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';
import LoadingPlug from '../../../shared/ui/LoadingPlug/LoadingPlug';
import { Material } from '../../../services/materials';

const metaLine = (m: Material) => {
    const bits: string[] = [];
    bits.push(m.form === 'sheet' ? 'Лист' : 'Рулон');
    if (m.materialType) bits.push(m.materialType);
    if (m.thickness) bits.push(m.thickness);
    if (m.form === 'roll') {
        if (m.subtype) bits.push(m.subtype); // свойства
        if (m.adhesive) bits.push(m.adhesive);
        if (m.metersPerRoll) bits.push(`${m.metersPerRoll} м`);
    } else {
        if (m.subtype) bits.push(m.subtype);
        if (m.density) bits.push(m.density);
        if (m.format) bits.push(m.format);
        if (m.color) bits.push(m.color);
        if (m.coating) bits.push(m.coating);
    }
    return bits.join(' · ');
};

const PaperStockPage = () => {
    const { materials, isLoading } = useMaterials();
    const paperFormMode = useAppSelector((s) => s.appSettings.paperFormMode);

    const items = useMemo(() => {
        return materials
            .filter((m) => m.status !== 'defective')
            .filter(
                (m) =>
                    paperFormMode === 'both' ||
                    m.form === paperFormMode ||
                    // legacy без form — показываем всегда
                    !m.form
            )
            .sort((a, b) =>
                (a.name || a.type).localeCompare(b.name || b.type, 'ru')
            );
    }, [materials, paperFormMode]);

    if (isLoading) return <LoadingPlug />;

    return (
        <div className={cls.page}>
            <header className={cls.header}>
                <div className={cls.stats}>
                    <span className={cls.stat}>
                        <b>{items.length}</b> позиций
                    </span>
                    <span className={cls.statDot} />
                    <span className={cls.stat}>
                        <b>
                            {items.reduce(
                                (s, m) => s + (Number(m.qty) || 0),
                                0
                            )}
                        </b>{' '}
                        на складе
                    </span>
                </div>
            </header>

            <div className={cls.titleBox}>
                <p className={cls.colName}>Наименование</p>
                <p className={cls.colMeta}>Параметры</p>
                <p className={cls.colNote}>Примечание</p>
                <p className={cls.colQty}>Склад</p>
            </div>

            {items.length === 0 ? (
                <div className={cls.empty}>
                    <strong>Склад бумаги пуст</strong>
                    <p>Оформите приход — новая позиция или пополнение.</p>
                </div>
            ) : (
                items.map((m) => (
                    <div
                        key={m.id}
                        className={`${cls.row} ${
                            Number(m.qty) <= 0 ? cls.rowEmpty : ''
                        }`}
                    >
                        <div className={cls.colName}>
                            <span className={cls.name}>
                                {m.name || m.type}
                            </span>
                        </div>
                        <p className={cls.colMeta}>{metaLine(m) || '—'}</p>
                        <p className={cls.colNote}>{m.note || '—'}</p>
                        <p className={cls.colQty}>{m.qty}</p>
                    </div>
                ))
            )}
        </div>
    );
};

export default PaperStockPage;
