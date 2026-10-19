import { useEffect, useRef } from 'react';
import cls from './NotificationModal.module.scss';

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    autoClose?: boolean;
    autoCloseDelay?: number;
    /** Если задан — модалка подтверждения (Отмена / действие) */
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmLoading?: boolean;
}

const NotificationModal = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    autoClose = false,
    autoCloseDelay = 5000,
    onConfirm,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    confirmLoading = false,
}: NotificationModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );
    const isConfirm = typeof onConfirm === 'function';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (confirmLoading) return;
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !confirmLoading) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscapeKey);

            if (!isConfirm && (autoClose || type === 'success')) {
                autoCloseTimerRef.current = setTimeout(() => {
                    onClose();
                }, autoCloseDelay);
            }
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);

            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
                autoCloseTimerRef.current = null;
            }
        };
    }, [
        isOpen,
        onClose,
        autoClose,
        autoCloseDelay,
        type,
        isConfirm,
        confirmLoading,
    ]);

    useEffect(() => {
        if (!isOpen && autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = null;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className={cls.modalOverlay}>
            <div className={`${cls.modalContent} ${cls[type]}`} ref={modalRef}>
                <div className={cls.header}>
                    <h3 className={cls.title}>{title}</h3>
                    <button
                        type="button"
                        className={cls.closeButton}
                        onClick={onClose}
                        disabled={confirmLoading}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>
                <div className={cls.body}>
                    <p className={cls.message}>{message}</p>
                </div>
                <div className={cls.footer}>
                    {isConfirm ? (
                        <>
                            <button
                                type="button"
                                className={cls.cancelButton}
                                onClick={onClose}
                                disabled={confirmLoading}
                            >
                                {cancelLabel}
                            </button>
                            <button
                                type="button"
                                className={`${cls.okButton} ${
                                    type === 'warning' || type === 'error'
                                        ? cls.dangerButton
                                        : ''
                                }`}
                                onClick={onConfirm}
                                disabled={confirmLoading}
                            >
                                {confirmLoading ? 'Подождите…' : confirmLabel}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={cls.okButton}
                            onClick={onClose}
                        >
                            Понятно
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationModal;
