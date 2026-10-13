import cls from './PrinterSelectTabs.module.scss';
import { usePrinters } from '../../../app/providers/StoreProvider/Store/hooks';

interface PrinterSelectTabsProps {
    selected: string;
    onSelect: (name: string) => void;
    /** stack — сайдбар; row — горизонтальные вкладки */
    variant?: 'stack' | 'row';
}

const PrinterSelectTabs = ({
    selected,
    onSelect,
    variant = 'stack',
}: PrinterSelectTabsProps) => {
    const { printers } = usePrinters();

    if (printers.length === 0) {
        return <p className={cls.empty}>Нет принтеров</p>;
    }

    if (variant === 'row') {
        return (
            <div className={cls.row} role="tablist" aria-label="Принтеры">
                {printers.map((printer) => {
                    const active = selected === printer.name;
                    return (
                        <button
                            key={printer.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => onSelect(printer.name)}
                            className={active ? cls.rowTabActive : cls.rowTab}
                            title={
                                printer.model
                                    ? `${printer.model}${printer.ip ? ` · ${printer.ip}` : ''}`
                                    : printer.ip || printer.name
                            }
                        >
                            {printer.name}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={cls.machineWrapper}>
            {printers.map((printer) => (
                <button
                    key={printer.id}
                    type="button"
                    onClick={() => onSelect(printer.name)}
                    className={
                        selected === printer.name
                            ? cls.activeButton
                            : cls.button
                    }
                    title={
                        printer.ip
                            ? `${printer.model} · ${printer.ip}`
                            : printer.model
                    }
                >
                    {printer.name}
                </button>
            ))}
        </div>
    );
};

export default PrinterSelectTabs;
