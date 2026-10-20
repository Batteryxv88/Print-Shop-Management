import { useMemo, useState } from 'react';
import PartPicker, {
    type PartPickerOption,
} from '../../../../features/ui/PurchaseStock/PartPicker';
import scanCls from './ScanInput.module.scss';
import cls from './PartInventoryScan.module.scss';

type PartInventoryScanProps = {
    options: PartPickerOption[];
    onAdd: (partN: string) => void;
};

const PartInventoryScan = ({ options, onAdd }: PartInventoryScanProps) => {
    const [query, setQuery] = useState('');

    const exactMatch = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return undefined;
        return options.find((o) => o.partN.toLowerCase() === q);
    }, [options, query]);

    const commit = (partN: string) => {
        const code = partN.trim();
        if (!code) return;
        onAdd(code);
        setQuery('');
    };

    const handleAddClick = () => {
        if (exactMatch) {
            commit(exactMatch.partN);
            return;
        }
        commit(query);
    };

    return (
        <div
            className={scanCls.scanInput}
            data-testid="inventorization-scan-input"
        >
            <div className={cls.pickerSlot}>
                <PartPicker
                    query={query}
                    onQueryChange={setQuery}
                    options={options}
                    selectedId={null}
                    onSelect={(option) => commit(option.partN)}
                />
            </div>
            <button
                type="button"
                className={scanCls.button}
                onClick={handleAddClick}
            >
                Добавить
            </button>
        </div>
    );
};

export default PartInventoryScan;
