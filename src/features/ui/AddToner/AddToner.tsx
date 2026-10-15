import { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import cls from './AddToner.module.scss';
import { useDispatch } from 'react-redux';
import { addToner } from '../../../app/providers/StoreProvider/Store/TonerSlice';
import {
    useAppSelector,
    usePrinters,
    useToners,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import {
    findTonerStock,
    getModelByPrinterName,
} from '../../../shared/lib/printers/printerUtils';
import {
    getColorsForPrinterName,
    getTonerSwatchColor,
} from '../../../shared/lib/printers/tonerColors';
import { writeOffFifo } from '../../../services/stockAccounting';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';
import FifoBreakdownModal from '../../../shared/ui/FifoBreakdownModal/FifoBreakdownModal';
import { useFifoBreakdown } from '../../../shared/lib/hooks/useFifoBreakdown';

const formatDate = (date: Date) => {
    const pad = (num: number) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    const timezoneOffset = -date.getTimezoneOffset();
    const timezoneHours = pad(Math.floor(Math.abs(timezoneOffset) / 60));
    const timezoneMinutes = pad(Math.abs(timezoneOffset % 60));
    const timezoneSign = timezoneOffset >= 0 ? '+' : '-';

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${timezoneSign}${timezoneHours}:${timezoneMinutes}`;
};

const AddToner = () => {
    const { userData } = useAuth();
    const dispatch = useDispatch<any>();
    const { tonersArr } = useToners();
    const { printers } = usePrinters();
    const machineTonerState = useAppSelector(
        (state) => state.machines.tonerMachine
    );

    const printerModel = getModelByPrinterName(printers, machineTonerState);
    const availableColors = useMemo(
        () => getColorsForPrinterName(printers, machineTonerState),
        [printers, machineTonerState]
    );

    const isSingleColor = availableColors.length <= 1;
    const [selectedColor, setSelectedColor] = useState(
        availableColors[0] || 'K'
    );
    const [busy, setBusy] = useState(false);
    const [errorModal, setErrorModal] = useState<{
        open: boolean;
        message: string;
    }>({ open: false, message: '' });
    const { breakdown, openBreakdown, closeBreakdown } = useFifoBreakdown();

    useEffect(() => {
        setSelectedColor(availableColors[0] || 'K');
    }, [availableColors, machineTonerState]);

    const colorToReplace = isSingleColor
        ? availableColors[0] || 'K'
        : selectedColor;

    const handleReplace = async () => {
        if (!colorToReplace || busy) return;

        const manName = userData?.displayName || '';
        const stockToner = findTonerStock(
            tonersArr,
            colorToReplace,
            printerModel
        );

        if (!stockToner) {
            setErrorModal({
                open: true,
                message: `Тонер «${colorToReplace}» не найден на складе для модели «${printerModel || '—'}». Сначала оформите приход.`,
            });
            return;
        }

        setBusy(true);
        try {
            const formattedDate = formatDate(new Date());
            const writeOff = await writeOffFifo({
                type: 'toner',
                stockId: stockToner.id,
                color: colorToReplace,
                model: stockToner.toner.model || printerModel || '',
                costCategory: 'toner',
                qty: 1,
                date: formattedDate,
                machine: machineTonerState,
                man: manName,
                currentStockQty: Number(stockToner.toner.qty) || 0,
            });

            await dispatch(
                addToner({
                    color: colorToReplace,
                    man: manName,
                    counter: '',
                    date: formattedDate,
                    machine: machineTonerState,
                    totalCost: writeOff.totalCost,
                    unitPriceAvg: writeOff.unitPriceAvg,
                    movementId: writeOff.movementId,
                })
            ).unwrap();

            openBreakdown({
                title: 'Списание тонера (FIFO)',
                subtitle: `${colorToReplace} · ${machineTonerState}`,
                qty: 1,
                totalCost: writeOff.totalCost,
                unitPriceAvg: writeOff.unitPriceAvg,
                slices: writeOff.lots,
            });
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : String(err || 'Ошибка списания тонера');
            setErrorModal({ open: true, message: msg });
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className={cls.bar}>
                {!isSingleColor && (
                    <div
                        className={cls.colors}
                        role="radiogroup"
                        aria-label="Цвет тонера"
                    >
                        {availableColors.map((color) => {
                            const active = selectedColor === color;
                            return (
                                <button
                                    key={color}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    className={classNames(cls.colorBtn, {
                                        [cls.colorBtnActive]: active,
                                        [cls.colorBtnDim]:
                                            Boolean(selectedColor) && !active,
                                    })}
                                    onClick={() => setSelectedColor(color)}
                                    title={`Тонер ${color}`}
                                    disabled={busy}
                                >
                                    <span
                                        className={cls.swatch}
                                        style={{
                                            backgroundColor:
                                                getTonerSwatchColor(color),
                                        }}
                                    />
                                    <span className={cls.colorLabel}>
                                        {color}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                <button
                    type="button"
                    className={cls.replaceBtn}
                    onClick={handleReplace}
                    disabled={busy || !colorToReplace}
                >
                    {busy
                        ? 'Списание…'
                        : isSingleColor
                          ? 'Заменить'
                          : `Заменить ${colorToReplace}`}
                </button>
            </div>

            <NotificationModal
                isOpen={errorModal.open}
                onClose={() => setErrorModal({ open: false, message: '' })}
                title="Не удалось заменить тонер"
                message={errorModal.message}
                type="error"
            />

            <FifoBreakdownModal
                isOpen={Boolean(breakdown)}
                onClose={closeBreakdown}
                title={breakdown?.title || ''}
                subtitle={breakdown?.subtitle}
                qty={breakdown?.qty || 0}
                totalCost={breakdown?.totalCost || 0}
                unitPriceAvg={breakdown?.unitPriceAvg || 0}
                slices={breakdown?.slices || []}
            />
        </>
    );
};

export default AddToner;
