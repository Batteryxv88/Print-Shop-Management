import classNames from 'classnames';
import cls from './TonerStockItem.module.scss';
import { getTonerSwatchColor } from '../../lib/printers/tonerColors';

type TonerStockItemTypes = {
    color: string;
    qty: string | number;
    id: string;
};

const TonerStockItem = ({ color, qty }: TonerStockItemTypes) => {
    const qtyNum = Number(qty) || 0;
    const isEmpty = qtyNum <= 0;

    return (
        <div
            className={classNames(cls.tonerBox, {
                [cls.tonerEmpty]: isEmpty,
            })}
        >
            <div className={cls.head}>
                <div
                    className={cls.swatch}
                    style={{ backgroundColor: getTonerSwatchColor(color) }}
                    aria-hidden
                />
                <p className={cls.colorCode}>{color}</p>
            </div>

            <div className={cls.qtyFrame}>
                <span className={cls.qtyNum}>{qtyNum}</span>
                <span className={cls.qtyUnit}>шт.</span>
            </div>
        </div>
    );
};

export default TonerStockItem;
