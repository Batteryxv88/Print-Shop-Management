import { useEffect, useMemo, useState } from 'react';

import cls from './StockLotsPanel.module.scss';

import {

    fetchLotsByStockId,

    type StockLot,

} from '../../../services/stockAccounting';

import {

    formatLotDate,

    formatMoneyRu,

} from '../../lib/stock/formatLotDate';

import PriceDriftModal from './PriceDriftModal';



type StockLotsPanelProps = {

    stockId: string;

    cardQty: number;

    /** Название позиции для заголовка модалки дрейфа */

    partLabel?: string;

    className?: string;

};



const StockLotsPanel = ({

    stockId,

    cardQty,

    partLabel,

    className,

}: StockLotsPanelProps) => {

    const [openLots, setOpenLots] = useState<StockLot[]>([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState('');

    const [driftOpen, setDriftOpen] = useState(false);



    useEffect(() => {

        let cancelled = false;

        setLoading(true);

        setError('');

        fetchLotsByStockId(stockId, true)

            .then((lots) => {

                if (!cancelled) setOpenLots(lots);

            })

            .catch((err) => {

                if (!cancelled) {

                    setError(

                        err instanceof Error

                            ? err.message

                            : 'Не удалось загрузить партии'

                    );

                }

            })

            .finally(() => {

                if (!cancelled) setLoading(false);

            });

        return () => {

            cancelled = true;

        };

    }, [stockId]);



    useEffect(() => {

        setDriftOpen(false);

    }, [stockId]);



    const lotsQtySum = useMemo(

        () => openLots.reduce((s, l) => s + Number(l.qtyLeft || 0), 0),

        [openLots]

    );



    const mismatch =

        openLots.length > 0 && Math.round(lotsQtySum) !== Math.round(cardQty);



    return (

        <div className={className ? `${cls.panel} ${className}` : cls.panel}>

            <div className={cls.panelHead}>

                <span className={cls.panelTitle}>Партии (FIFO)</span>

                <button

                    type="button"

                    className={cls.driftOpenBtn}

                    onClick={() => setDriftOpen(true)}

                >

                    Дрейф цены

                </button>

            </div>



            {loading ? (

                <p className={cls.loading}>Загрузка…</p>

            ) : error ? (

                <p className={cls.empty}>{error}</p>

            ) : (

                <>

                    {mismatch ? (

                        <p className={cls.warn}>

                            Сумма по открытым партиям ({lotsQtySum} шт.) не

                            совпадает с остатком на карточке ({cardQty} шт.).

                            Сообщите администратору.

                        </p>

                    ) : null}

                    <p className={cls.fifoNote}>

                        Следующее списание возьмёт товар с верхней строки

                        (самый старый приход).

                    </p>

                    {openLots.length === 0 ? (

                        <p className={cls.empty}>

                            Нет открытых партий — оформите приход.

                        </p>

                    ) : (

                        <table className={cls.table}>

                            <thead>

                                <tr>

                                    <th>Приход</th>

                                    <th>Остаток</th>

                                    <th>Цена</th>

                                    <th>Поставщик</th>

                                </tr>

                            </thead>

                            <tbody>

                                {openLots.map((lot, i) => (

                                    <tr

                                        key={lot.id}

                                        className={

                                            i === 0 ? cls.nextRow : undefined

                                        }

                                    >

                                        <td>

                                            {formatLotDate(lot.purchasedAt)}

                                            {i === 0 ? (

                                                <span className={cls.badge}>

                                                    След. списание

                                                </span>

                                            ) : null}

                                        </td>

                                        <td>

                                            {lot.qtyLeft} / {lot.qtyInitial}

                                        </td>

                                        <td>

                                            {formatMoneyRu(

                                                Number(lot.unitPrice)

                                            )}{' '}

                                            ₽

                                        </td>

                                        <td>

                                            {lot.supplier?.trim() || '—'}

                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    )}

                    {openLots.length > 0 ? (

                        <p className={cls.summary}>

                            Остаток по партиям:{' '}

                            <strong>{lotsQtySum} шт.</strong>

                            {' · '}

                            ≈{' '}

                            <strong>

                                {formatMoneyRu(

                                    openLots.reduce(

                                        (s, l) =>

                                            s +

                                            Number(l.qtyLeft) *

                                                Number(l.unitPrice),

                                        0

                                    )

                                )}{' '}

                                ₽

                            </strong>

                        </p>

                    ) : null}

                </>

            )}



            <PriceDriftModal

                isOpen={driftOpen}

                onClose={() => setDriftOpen(false)}

                stockId={stockId}

                title={partLabel}

            />

        </div>

    );

};



export default StockLotsPanel;

