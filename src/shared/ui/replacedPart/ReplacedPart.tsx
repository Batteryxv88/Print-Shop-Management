import { useState } from 'react';
import cls from './ReplacedPart.module.scss';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import { deleteUsedPart } from '../../../app/providers/StoreProvider/Store/ReplacedPartSlice';
import DeleteButton from '../DeleteButton/DeleteButton';
import { formatLifeWithCommas } from '../../lib/formatLifeInput';
import NotificationModal from '../NotificationModal/NotificationModal';
import CopyablePartNumber from '../CopyablePartNumber/CopyablePartNumber';

export type replacedPartProps = {
    id: string;
    name: string;
    number: string;
    qty: number;
    man: string;
    date: any;
    life: number;
    percent: number;
};

const ReplacedPart = (props: replacedPartProps) => {
    const { id, name, number, qty, date, man, life, percent } = props;
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
            await dispatch(deleteUsedPart(id)).unwrap();
            setConfirmOpen(false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setConfirmOpen(false);
            setErrorModal({
                open: true,
                message: msg || 'Не удалось сторнировать замену',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className={cls.replacedPart}>
                <CopyablePartNumber
                    value={name}
                    className={cls.name}
                    label="наименование"
                />
                <CopyablePartNumber
                    value={number}
                    className={cls.number}
                    label="артикул"
                />
                <p className={cls.man}>{man}</p>
                <p className={cls.qty}>{qty}</p>
                <div className={cls.percent}>
                    <p
                        className={
                            percent < 100
                                ? cls.percentRed
                                : !percent
                                  ? cls.percentRed
                                  : cls.percentGreen
                        }
                        title={
                            life
                                ? `${formatLifeWithCommas(life)} оттисков`
                                : undefined
                        }
                    >
                        {percent ? percent + '%' : '0 %'}
                    </p>
                </div>
                <div className={cls.date}>
                    <p>{day + '.'}</p>
                    <p>{month + '.'}</p>
                    <p>{year}</p>
                </div>
                <div className={cls.deleteBox}>
                    <DeleteButton
                        onClick={() => setConfirmOpen(true)}
                        label="Сторнировать замену"
                    />
                </div>
            </div>

            <NotificationModal
                isOpen={confirmOpen}
                onClose={() => {
                    if (!busy) setConfirmOpen(false);
                }}
                title="Сторнировать замену?"
                message={`«${name}» (${number}) будет отменена. Списание со склада вернётся в партии FIFO и на остаток, запись исчезнет из журнала.`}
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

export default ReplacedPart;
