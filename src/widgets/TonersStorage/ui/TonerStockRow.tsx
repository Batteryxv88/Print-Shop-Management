import { useCallback, useState } from 'react';
import cls from './TonerStockRow.module.scss';
import TonerStockItem from '../../../shared/ui/tonerStockItem/TonerStockItem';
import StockLotsModal from '../../../shared/ui/StockLotsPanel/StockLotsModal';

type TonerStockRowProps = {
    id: string;
    color: string;
    qty: string | number;
    /** Для заголовка дрейфа цены, напр. «KM · K» */
    partLabel?: string;
};

const TonerStockRow = ({
    id,
    color,
    qty,
    partLabel,
}: TonerStockRowProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const qtyNum = Number(qty) || 0;

    const openModal = useCallback(() => {
        setModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal();
        }
    };

    return (
        <>
            <div
                className={cls.main}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-label={`Партии FIFO и дрейф цены, тонер ${color}`}
                onClick={openModal}
                onKeyDown={handleKeyDown}
            >
                <TonerStockItem id={id} color={color} qty={qty} />
            </div>

            <StockLotsModal
                isOpen={modalOpen}
                onClose={closeModal}
                stockId={id}
                cardQty={qtyNum}
                title={partLabel || color}
            />
        </>
    );
};

export default TonerStockRow;
