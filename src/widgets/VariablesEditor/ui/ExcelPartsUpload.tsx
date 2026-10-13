import { useRef, useState } from 'react';
import cls from './VariablesEditor.module.scss';
import { parsePartsExcel } from '../../../shared/lib/printers/parsePartsExcel';
import { importResourceParts } from '../../../services/parts';

interface ExcelPartsUploadProps {
    printerModel: string;
    source: 'body' | 'option';
    optionModel?: string;
    label?: string;
}

const ExcelPartsUpload = ({
    printerModel,
    source,
    optionModel,
    label = 'Загрузить Excel ресурсных деталей',
}: ExcelPartsUploadProps) => {
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
            const rows = parsePartsExcel(buffer);
            const result = await importResourceParts(rows, {
                printerModel,
                source,
                optionModel,
            });
            setStatus(
                `Импортировано: ${rows.length} дет. (новых ${result.created}, обновлено ${result.updated})`
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось импортировать файл'
            );
        } finally {
            setLoading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className={cls.uploadBlock}>
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
                className={cls.uploadBtn}
                disabled={loading || !printerModel}
                onClick={() => inputRef.current?.click()}
            >
                {loading ? 'Импорт...' : label}
            </button>
            {status && <p className={cls.uploadOk}>{status}</p>}
            {error && <p className={cls.error}>{error}</p>}
        </div>
    );
};

export default ExcelPartsUpload;
