import { useEffect } from 'react';
import cls from './StockLotsModal.module.scss';
import StockLotsPanel from './StockLotsPanel';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    stockId: string;
    cardQty: number;
    /** Заголовок, напр. «KM · K» */
    title?: string;
};

const StockLotsModal = ({
    isOpen,
    onClose,
    stockId,
    cardQty,
    title,
}: Props) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className={cls.overlay}
            role="presentation"
            onClick={onClose}
        >
            <div
                className={cls.modal}
                role="dialog"
                aria-labelledby="stock-lots-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="stock-lots-modal-title" className={cls.title}>
                    Партии (FIFO)
                </h2>
                {title ? (
                    <p className={cls.subtitle}>
                        {title}
                        {' · '}
                        на складе <strong>{cardQty}</strong> шт.
                    </p>
                ) : (
                    <p className={cls.subtitle}>
                        На складе <strong>{cardQty}</strong> шт.
                    </p>
                )}

                <div className={cls.body}>
                    <StockLotsPanel
                        stockId={stockId}
                        cardQty={cardQty}
                        partLabel={title}
                        className={cls.embeddedPanel}
                    />
                </div>

                <div className={cls.actions}>
                    <button
                        type="button"
                        className={cls.closeBtn}
                        onClick={onClose}
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StockLotsModal;
