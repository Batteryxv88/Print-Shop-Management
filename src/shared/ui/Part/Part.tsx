import { useState, useEffect, useCallback } from 'react';
import classNames from 'classnames';
import cls from './Part.module.scss';
import { updateStock } from '../../../app/providers/StoreProvider/Store/PartSlice';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import CopyablePartNumber from '../CopyablePartNumber/CopyablePartNumber';

export type PartProps = {
    name: string;
    number: string;
    qty: number;
    id: string;
    partLife?: string | number;
    installedQty?: number;
    optionModel?: string;
    orderQty?: number;
};

const Part = (props: PartProps) => {
    const {
        name,
        number,
        qty,
        id,
        partLife,
        installedQty,
        optionModel,
        orderQty = 0,
    } = props;
    const dispatch = useAppDispatch();
    const [orderValue, setOrderValue] = useState(String(orderQty || 0));

    useEffect(() => {
        setOrderValue(String(orderQty || 0));
    }, [orderQty]);

    const saveOrderQty = useCallback(() => {
        const n = Math.max(0, parseInt(orderValue, 10) || 0);
        setOrderValue(String(n));
        if (n === (Number(orderQty) || 0)) return;
        dispatch(
            updateStock({
                id,
                part: { orderQty: n },
            })
        );
    }, [orderValue, orderQty, id, dispatch]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if ((parseInt(orderValue, 10) || 0) === 0) {
            setOrderValue('');
        }
        e.currentTarget.select();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <div
            className={classNames(cls.part, {
                [cls.zeroQuantity]: qty <= 0,
            })}
        >
            <div className={cls.nameBlock}>
                <CopyablePartNumber
                    value={name}
                    className={cls.name}
                    label="наименование"
                />
                {optionModel && (
                    <span className={cls.optionBadge}>{optionModel}</span>
                )}
            </div>
            <CopyablePartNumber
                value={number}
                className={cls.number}
                label="артикул"
            />
            <p className={cls.life}>{partLife || '—'}</p>
            <p className={cls.installed}>
                {installedQty !== undefined && installedQty !== null
                    ? installedQty
                    : '—'}
            </p>
            <p className={cls.qty}>{qty}</p>
            <div className={cls.orderBox}>
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={orderValue}
                    onChange={(e) => setOrderValue(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={saveOrderQty}
                    onKeyDown={handleKeyDown}
                    className={classNames(cls.orderInput, {
                        [cls.orderInputActive]:
                            (parseInt(orderValue, 10) || 0) > 0,
                    })}
                    aria-label={`Кол-во к заказу: ${name}`}
                />
            </div>
        </div>
    );
};

export default Part;
