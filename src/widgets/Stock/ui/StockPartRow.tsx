import { useState } from 'react';
import cls from './StockPartRow.module.scss';
import Part from '../../../shared/ui/Part/Part';
import StockLotsPanel from '../../../shared/ui/StockLotsPanel/StockLotsPanel';

type StockPartRowProps = {
    id: string;
    name: string;
    number: string;
    qty: number;
    partLife?: string | number;
    installedQty?: number;
    optionModel?: string;
    orderQty?: number;
};

const StockPartRow = (props: StockPartRowProps) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={cls.row}>
            <div className={cls.main}>
                <button
                    type="button"
                    className={`${cls.expandBtn} ${expanded ? cls.expandOpen : ''}`}
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    aria-label={
                        expanded ? 'Скрыть партии' : 'Показать партии и цены'
                    }
                    title="Партии FIFO и дрейф цены"
                >
                    ▶
                </button>
                <div className={cls.partWrap}>
                    <Part {...props} />
                </div>
            </div>
            {expanded ? (
                <StockLotsPanel
                    stockId={props.id}
                    cardQty={props.qty}
                    partLabel={`${props.name}${props.number ? ` · ${props.number}` : ''}`}
                />
            ) : null}
        </div>
    );
};

export default StockPartRow;
