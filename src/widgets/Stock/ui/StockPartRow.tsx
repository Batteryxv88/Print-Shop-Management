import { useCallback } from 'react';
import cls from './StockPartRow.module.scss';
import Part from '../../../shared/ui/Part/Part';
import CollapseHeight from '../../../shared/ui/CollapseHeight/CollapseHeight';
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
    expanded: boolean;
    onToggle: (id: string) => void;
};

const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
        target.closest(
            'input, textarea, select, button, a, [contenteditable="true"]'
        )
    );
};

const StockPartRow = (props: StockPartRowProps) => {
    const { expanded, onToggle, id } = props;

    const toggle = useCallback(() => {
        onToggle(id);
    }, [id, onToggle]);

    const handleRowClick = (e: React.MouseEvent) => {
        if (isInteractiveTarget(e.target)) return;
        toggle();
    };

    const handleRowKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    };

    return (
        <div className={cls.row}>
            <div
                className={`${cls.main} ${expanded ? cls.mainExpanded : ''}`}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={
                    expanded
                        ? 'Скрыть партии FIFO'
                        : 'Показать партии FIFO и дрейф цены'
                }
                onClick={handleRowClick}
                onKeyDown={handleRowKeyDown}
            >
                <span
                    className={`${cls.chevron} ${expanded ? cls.chevronOpen : ''}`}
                    aria-hidden
                />
                <div className={cls.partWrap}>
                    <Part {...props} />
                </div>
            </div>
            <CollapseHeight open={expanded} className={cls.panelExpand}>
                {expanded ? (
                    <StockLotsPanel
                        stockId={props.id}
                        cardQty={props.qty}
                        partLabel={`${props.name}${props.number ? ` · ${props.number}` : ''}`}
                    />
                ) : null}
            </CollapseHeight>
        </div>
    );
};

export default StockPartRow;
