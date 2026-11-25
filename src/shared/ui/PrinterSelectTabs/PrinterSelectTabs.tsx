import cls from './PrinterSelectTabs.module.scss';
import { usePrinters } from '../../../app/providers/StoreProvider/Store/hooks';

interface PrinterSelectTabsProps {
    /** printerId */
    selected: string;
    onSelect: (printerId: string) => void;
    /** stack — сайдбар; row — горизонтальные вкладки */
    variant?: 'stack' | 'row';
    /** Пока заявка открыта, чужие принтеры не переключаются */
    locked?: boolean;
}

const PrinterSelectTabs = ({
    selected,
    onSelect,
    variant = 'stack',
    locked = false,
}: PrinterSelectTabsProps) => {
    const { printers } = usePrinters();

    if (printers.length === 0) {
        return <p className={cls.empty}>Нет принтеров</p>;
    }

    if (variant === 'row') {
        return (
            <div className={cls.row} role="tablist" aria-label="Принтеры">
                {printers.map((printer) => {
                    const active = selected === printer.id;
                    const blocked = locked && !active;
                    return (
                        <button
                            key={printer.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-disabled={blocked}
                            disabled={blocked}
                            onClick={() => {
                                if (!blocked) onSelect(printer.id);
                            }}
                            className={
                                active
                                    ? cls.rowTabActive
                                    : `${cls.rowTab} ${blocked ? cls.rowTabLocked : ''}`
                            }
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
            {printers.map((printer) => {
                const active = selected === printer.id;
                const blocked = locked && !active;
                return (
                <button
                    key={printer.id}
                    type="button"
                    aria-disabled={blocked}
                    disabled={blocked}
                    onClick={() => {
                        if (!blocked) onSelect(printer.id);
                    }}
                    className={
                        active
                            ? cls.activeButton
                            : `${cls.button} ${blocked ? cls.buttonLocked : ''}`
                    }
                    title={
                        printer.ip
                            ? `${printer.model} · ${printer.ip}`
                            : printer.model
                    }
                >
                    {printer.name}
                </button>
                );
            })}
        </div>
    );
};

export default PrinterSelectTabs;
