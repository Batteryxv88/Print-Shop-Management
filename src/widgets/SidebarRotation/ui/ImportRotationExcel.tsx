import { useRef, useState } from 'react';
import cls from './SidebarRotation.module.scss';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import { importForms } from '../../../app/providers/StoreProvider/Store/RotationFormsSlice';
import { parseKnivesExcel } from '../../../shared/lib/rotation/parseKnivesExcel';

const ImportRotationExcel = () => {
    const dispatch = useAppDispatch();
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFile = async (file: File) => {
        setError('');
        setStatus('');
        setLoading(true);

        try {
            const buffer = await file.arrayBuffer();
            const { forms, errors } = parseKnivesExcel(buffer);
            const result = await dispatch(importForms(forms)).unwrap();
            const skipped = errors.length
                ? ` Пропущено строк: ${errors.length}.`
                : '';
            setStatus(
                `Импортировано: новых ${result.created}, обновлено ${result.updated}.${skipped}`
            );
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : typeof err === 'object' &&
                        err !== null &&
                        'message' in err &&
                        typeof err.message === 'string'
                      ? err.message
                      : 'Не удалось импортировать файл';
            setError(message);
        } finally {
            setLoading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className={cls.importBlock}>
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className={cls.fileInput}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                }}
            />
            <button
                type="button"
                className={cls.item}
                disabled={loading}
                onClick={() => inputRef.current?.click()}
            >
                <span className={cls.itemText}>
                    <span className={cls.itemName}>
                        {loading ? 'Импорт...' : 'Импорт Excel'}
                    </span>
                    <span className={cls.itemHint}>Ножи из файла в базу</span>
                </span>
                <span className={cls.chevron} aria-hidden>›</span>
            </button>
            {status && <p className={cls.importStatus}>{status}</p>}
            {error && <p className={cls.importError}>{error}</p>}
        </div>
    );
};

export default ImportRotationExcel;
