import { useMemo } from 'react';
import cls from './LaminationStockPage.module.scss';
import { useLaminations } from '../../../app/providers/StoreProvider/Store/hooks';
import LoadingPlug from '../../../shared/ui/LoadingPlug/LoadingPlug';
import { Lamination } from '../../../services/laminations';

const metaLine = (l: Lamination) => {
    const bits: string[] = [];
    if (l.type) bits.push(l.type);
    const sub = l.subtype || l.sub_type;
    if (sub) bits.push(sub);
    if (l.thickness) bits.push(l.thickness);
    return bits.join(' · ');
};

const LaminationStockPage = () => {
    const { laminations, isLoading } = useLaminations();

    const items = useMemo(
        () =>
            laminations
                .filter((l) => l.status !== 'defective')
                .sort((a, b) =>
                    (a.name || a.type || '').localeCompare(
                        b.name || b.type || '',
                        'ru'
                    )
                ),
        [laminations]
    );

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
                                (s, l) => s + (Number(l.qty) || 0),
                                0
                            )}
                        </b>{' '}
                        на складе
                    </span>
                </div>
            </header>

            <div className={cls.titleBox}>
                <p className={cls.colName}>Наименование</p>
                <p className={cls.colMeta}>Тип · подтип · толщина</p>
                <p className={cls.colNote}>Примечание</p>
                <p className={cls.colQty}>Склад</p>
            </div>

            {items.length === 0 ? (
                <div className={cls.empty}>
                    <strong>Склад ламинации пуст</strong>
                    <p>Оформите приход — новая позиция или пополнение.</p>
                </div>
            ) : (
                items.map((l) => (
                    <div
                        key={l.id}
                        className={`${cls.row} ${
                            Number(l.qty) <= 0 ? cls.rowEmpty : ''
                        }`}
                    >
                        <p className={cls.colName}>{l.name || l.type || '—'}</p>
                        <p className={cls.colMeta}>{metaLine(l) || '—'}</p>
                        <p className={cls.colNote}>{l.note || '—'}</p>
                        <p className={cls.colQty}>{l.qty}</p>
                    </div>
                ))
            )}
        </div>
    );
};

export default LaminationStockPage;
