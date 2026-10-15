import { useMemo, useState, useEffect, useRef } from 'react';
import cls from './AddReplacedPart.module.scss';
import { addUsedPart } from '../../../app/providers/StoreProvider/Store/ReplacedPartSlice';
import { partsFilter } from '../../lib/partsFilter/partsFilter';
import { useForm } from 'react-hook-form';
import {
    useAppDispatch,
    useAppSelector,
    useParts,
    usePrinters,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { lifePercent } from '../../../shared/lib/calculatePercentOfLife';
import { useAuth } from '../../../contexts/AuthContext';
import {
    findStockPart,
    getModelByPrinterName,
    matchesModel,
} from '../../../shared/lib/printers/printerUtils';
import { writeOffFifo } from '../../../services/stockAccounting';
import { inferPartCostCategory } from '../../../shared/lib/stock/costCategory';
import { parsePartLife } from '../../../shared/lib/printers/parsePartLife';
import {
    formatLifeWithCommas,
    parseLifeExact,
} from '../../../shared/lib/formatLifeInput';
import PartPicker, {
    PartPickerOption,
} from '../PurchaseStock/PartPicker';
import FifoBreakdownModal from '../../../shared/ui/FifoBreakdownModal/FifoBreakdownModal';
import { useFifoBreakdown } from '../../../shared/lib/hooks/useFifoBreakdown';

const sameColorParts = [
    'A5WH0Y0C',
    'A5WH0Y0M',
    'A5WH0Y0Y',
    'A5WH0Y0K',
    'A50UR70323C',
    'A50UR70323M',
    'A50UR70323Y',
    'A50UR70323K',
    'A50UR70244C',
    'A50UR70244M',
    'A50UR70244Y',
    'A50UR70244K',
];

const formatNow = () => {
    const date = new Date();
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

const Modal = ({
    isOpen,
    onClose,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className={cls.modalOverlay}>
            <div className={cls.modalContent} ref={modalRef}>
                <h2 className={cls.modalTitle}>Замена детали</h2>
                <button className={cls.closeButton} onClick={onClose}>
                    ×
                </button>
                {children}
            </div>
        </div>
    );
};

type FormValues = {
    quantity: number;
};

const AddReplacedPart = () => {
    const { userData } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { breakdown, openBreakdown, closeBreakdown } = useFifoBreakdown();

    const [partQuery, setPartQuery] = useState('');
    const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
    const [serviceLifeDisplay, setServiceLifeDisplay] = useState('');

    const { partsArray } = useParts();
    const machineState = useAppSelector((state) => state.machines.machine);
    const { printers } = usePrinters();
    const printerModel = getModelByPrinterName(printers, machineState);
    const dispatch = useAppDispatch();

    const {
        register,
        formState: { errors },
        handleSubmit,
        reset,
    } = useForm<FormValues>({
        mode: 'onChange',
        defaultValues: { quantity: 1 },
    });

    const partOptions = useMemo<PartPickerOption[]>(() => {
        return partsArray
            .filter((item) => matchesModel(item.part?.model, printerModel))
            .map((item) => ({
                id: item.id,
                partN: String(item.part.partN || ''),
                partName: String(item.part.partName || ''),
                section: String(item.part.section || ''),
                qty: Number(item.part.quantity) || 0,
            }))
            .sort((a, b) => a.partN.localeCompare(b.partN, 'ru'));
    }, [partsArray, printerModel]);

    const selectedPart = useMemo(
        () => partOptions.find((o) => o.id === selectedPartId) || null,
        [partOptions, selectedPartId]
    );

    const exactMatch = useMemo(() => {
        const q = partQuery.trim().toUpperCase();
        if (!q) return null;
        return partOptions.find((o) => o.partN.toUpperCase() === q) || null;
    }, [partOptions, partQuery]);

    useEffect(() => {
        if (exactMatch && !selectedPartId) {
            setSelectedPartId(exactMatch.id);
        }
    }, [exactMatch, selectedPartId]);

    const lifePreview = useMemo(() => {
        const raw = parseLifeExact(serviceLifeDisplay);
        if (!raw || !selectedPart) return null;
        const percent = lifePercent(
            selectedPart.partN.toUpperCase(),
            partsArray,
            raw
        );
        return { raw, percent };
    }, [serviceLifeDisplay, selectedPart, partsArray]);

    const resetForm = () => {
        setPartQuery('');
        setSelectedPartId(null);
        setServiceLifeDisplay('');
        setSubmitError('');
        setError(false);
        reset({ quantity: 1 });
    };

    const handleCloseModal = () => {
        resetForm();
        setIsModalOpen(false);
    };

    const handlePartQueryChange = (value: string) => {
        setPartQuery(value);
        setSubmitError('');
        if (
            selectedPart &&
            value.trim().toUpperCase() !== selectedPart.partN.toUpperCase()
        ) {
            setSelectedPartId(null);
        }
    };

    const handlePickPart = (option: PartPickerOption) => {
        setPartQuery(option.partN);
        setSelectedPartId(option.id);
        setError(false);
        setSubmitError('');
    };

    const handleLifeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setServiceLifeDisplay(formatLifeWithCommas(e.target.value));
    };

    const handleAddPart = async (form: FormValues) => {
        setSubmitError('');
        const cleanedPartN = (selectedPart?.partN || partQuery)
            .trim()
            .toUpperCase();
        const actualLife = parseLifeExact(serviceLifeDisplay);
        const qty = Number(form.quantity);

        if (!cleanedPartN) {
            setSubmitError('Выберите или введите артикул');
            return;
        }
        if (!(actualLife > 0)) {
            setSubmitError('Укажите пройденный ресурс полностью, без «K»');
            return;
        }
        if (!(qty >= 1)) {
            setSubmitError('Количество — минимум 1');
            return;
        }

        const currentPart =
            (selectedPartId &&
                partsArray.find((p) => p.id === selectedPartId)) ||
            findStockPart(
                partsArray,
                cleanedPartN,
                printerModel,
                sameColorParts
            );

        if (!currentPart) {
            setError(true);
            setSubmitError(
                `Деталь ${cleanedPartN} не найдена на складе модели «${printerModel}»`
            );
            return;
        }

        setError(false);
        setSubmitting(true);

        const newName = currentPart.part.partName;
        // Секция со склада модели — не хардкод partsFilter
        const section =
            String(currentPart.part.section || '').trim() ||
            partsFilter(cleanedPartN);
        const percent = lifePercent(cleanedPartN, partsArray, actualLife);
        const costCategory = inferPartCostCategory(currentPart.part || {});
        // Заводской ресурс со склада (может быть «30K») — для %, экономии
        const factoryLife = parsePartLife(currentPart.part.partLife);
        const date = formatNow();
        const manName = userData?.displayName || '';

        try {
            const writeOff = await writeOffFifo({
                type: 'part',
                stockId: currentPart.id,
                partN: cleanedPartN,
                partName: newName,
                model: currentPart.part.model || printerModel || '',
                costCategory,
                qty,
                date,
                machine: machineState,
                man: manName,
                currentStockQty: Number(currentPart.part.quantity) || 0,
                factoryLife,
                actualLife,
            });

            // Новая запись получает СВОЙ percent/serviceLife.
            // Предыдущую замену больше не перезаписываем — иначе у всех
            // одинаковых артикулов «прыгает» процент на последний введённый.
            dispatch(
                addUsedPart({
                    partN: cleanedPartN,
                    quantity: qty,
                    date,
                    section,
                    man: manName,
                    partName: newName,
                    machine: machineState,
                    totalCost: writeOff.totalCost,
                    unitPriceAvg: writeOff.unitPriceAvg,
                    movementId: writeOff.movementId,
                    costCategory: writeOff.costCategory,
                    economyAmount: writeOff.economyAmount,
                    factoryLife,
                    actualLife,
                    serviceLife: actualLife,
                    percent,
                })
            );

            handleCloseModal();
            openBreakdown({
                title: 'Списание со склада (FIFO)',
                subtitle: `${newName} · ${cleanedPartN}`,
                qty,
                totalCost: writeOff.totalCost,
                unitPriceAvg: writeOff.unitPriceAvg,
                slices: writeOff.lots,
            });
        } catch (err: any) {
            setSubmitError(err?.message || 'Ошибка FIFO-списания');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button
                className={cls.openModalButton}
                onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                }}
            >
                Заменить деталь
            </button>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                <form
                    className={cls.addReplacedPart}
                    onSubmit={handleSubmit(handleAddPart)}
                >
                    <p className={cls.hint}>
                        Подсказки из склада модели «{printerModel || '—'}».
                        Ресурс вводите полностью: 1,028,400 — без буквы K.
                    </p>

                    <div className={cls.box}>
                        <label className={cls.label}>Артикул</label>
                        <PartPicker
                            query={partQuery}
                            onQueryChange={handlePartQueryChange}
                            options={partOptions}
                            selectedId={selectedPartId}
                            onSelect={handlePickPart}
                        />
                        {selectedPart && (
                            <div className={cls.selectedCard}>
                                <strong>{selectedPart.partName}</strong>
                                <span>
                                    {selectedPart.section || '—'} · на складе{' '}
                                    {selectedPart.qty} шт.
                                </span>
                            </div>
                        )}
                    </div>

                    <div className={cls.box}>
                        <label className={cls.label}>
                            Пройденный ресурс (полностью)
                        </label>
                        <input
                            className={cls.input}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="например 1,028,400"
                            value={serviceLifeDisplay}
                            onChange={handleLifeChange}
                        />
                        {lifePreview && (
                            <p className={cls.lifePreview}>
                                {formatLifeWithCommas(lifePreview.raw)} оттисков
                                {lifePreview.percent > 0
                                    ? ` · ${lifePreview.percent}% от заводского`
                                    : ''}
                            </p>
                        )}
                    </div>

                    <div className={cls.box}>
                        <label className={cls.label}>Кол-во</label>
                        <input
                            {...register('quantity', {
                                required: 'Обязательное поле',
                                min: {
                                    value: 1,
                                    message: 'Минимум 1',
                                },
                                valueAsNumber: true,
                            })}
                            className={cls.inputQty}
                            type="number"
                            min={1}
                            step={1}
                        />
                    </div>

                    <button
                        className={cls.button}
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting ? '...' : 'Добавить'}
                    </button>
                </form>

                <div className={cls.errorContainer}>
                    <div
                        className={`${cls.errMessage} ${
                            Object.keys(errors).length > 0 ||
                            error ||
                            submitError
                                ? cls.visible
                                : ''
                        }`}
                    >
                        {submitError ||
                            (error && 'Деталь не найдена на складе') ||
                            errors?.quantity?.message}
                    </div>
                </div>
            </Modal>

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

export default AddReplacedPart;
