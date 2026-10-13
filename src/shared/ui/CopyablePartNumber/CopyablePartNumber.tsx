import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { copyText } from '../../lib/utils/copyText';
import cls from './CopyablePartNumber.module.scss';

type Props = {
    value: string;
    className?: string;
    /** Подпись в title / aria, напр. «артикул» или «наименование» */
    label?: string;
};

const CopyablePartNumber = ({
    value,
    className,
    label = 'текст',
}: Props) => {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const text = String(value ?? '').trim();

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleCopy = async () => {
        if (!text) return;
        const ok = await copyText(text);
        if (!ok) return;
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1200);
    };

    if (!text) {
        return <span className={classNames(cls.root, className)}>—</span>;
    }

    return (
        <button
            type="button"
            className={classNames(cls.root, className, {
                [cls.copied]: copied,
            })}
            onClick={handleCopy}
            title={copied ? 'Скопировано' : `Скопировать ${label}`}
            aria-label={
                copied
                    ? `${label} скопирован`
                    : `Скопировать ${label}: ${text}`
            }
        >
            {copied ? 'Скопировано' : text}
        </button>
    );
};

export default CopyablePartNumber;
