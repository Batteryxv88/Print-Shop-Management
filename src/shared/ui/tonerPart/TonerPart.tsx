import { useState } from 'react';
import cls from './TonerPart.module.scss';
import DeleteButton from '../DeleteButton/DeleteButton';
import { deleteToner } from '../../../app/providers/StoreProvider/Store/TonerSlice';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import NotificationModal from '../NotificationModal/NotificationModal';
import { getTonerSwatchColor } from '../../lib/printers/tonerColors';

export type tonerPartProps = {
    color: string;
    date: any;
    man: string;
    id: string;
};

const TonerPart = (props: tonerPartProps) => {
    const { color, date, man, id } = props;
    const dispatch = useAppDispatch();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [errorModal, setErrorModal] = useState<{
        open: boolean;
        message: string;
    }>({ open: false, message: '' });

    const newDate = new Date(date);
    const month = newDate.toLocaleString('ru-RU', { month: 'numeric' });
    const day = newDate.toLocaleString('ru-RU', { day: '2-digit' });
    const year = newDate.getFullYear();

    const handleConfirmStorno = async () => {
        setBusy(true);
        try {
            await dispatch(deleteToner(id)).unwrap();
            setConfirmOpen(false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setConfirmOpen(false);
            setErrorModal({
                open: true,
                message: msg || 'Не удалось сторнировать замену тонера',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className={cls.tonerPart}>
                <div className={cls.colorBox}>
                    <p className={cls.colorName}>{color}</p>
                    <div
                        className={cls.swatch}
                        style={{
                            backgroundColor: getTonerSwatchColor(color),
                        }}
                    />
                </div>
                <p className={cls.man}>{man}</p>
                <div className={cls.dateBox}>
                    <p>{day + '.'}</p>
                    <p>{month + '.'}</p>
                    <p>{year}</p>
                </div>
                <div className={cls.deleteBox}>
                    <DeleteButton
                        onClick={() => setConfirmOpen(true)}
                        label="Сторнировать замену тонера"
                    />
                </div>
            </div>

            <NotificationModal
                isOpen={confirmOpen}
                onClose={() => {
                    if (!busy) setConfirmOpen(false);
                }}
                title="Сторнировать замену тонера?"
                message={`Тонер ${color} будет отменён. Списание со склада вернётся в партии FIFO и на остаток, запись исчезнет из журнала.`}
                type="warning"
                onConfirm={handleConfirmStorno}
                confirmLabel="Сторнировать"
                cancelLabel="Отмена"
                confirmLoading={busy}
            />

            <NotificationModal
                isOpen={errorModal.open}
                onClose={() => setErrorModal({ open: false, message: '' })}
                title="Не удалось сторнировать"
                message={errorModal.message}
                type="error"
            />
        </>
    );
};

export default TonerPart;
