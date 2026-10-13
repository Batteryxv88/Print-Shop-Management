import { useState } from 'react';
import cls from './VariablesEditor.module.scss';
import {
    CMYK_COLORS,
    defaultColorsForMode,
    normalizeColorCode,
    normalizeColorList,
    PrinterColorMode,
} from '../../../shared/lib/printers/tonerColors';
import DeleteButton from '../../../shared/ui/DeleteButton/DeleteButton';

interface ColorConfigFieldsProps {
    colorMode: PrinterColorMode;
    colors: string[];
    onChange: (next: { colorMode: PrinterColorMode; colors: string[] }) => void;
}

const ColorConfigFields = ({
    colorMode,
    colors,
    onChange,
}: ColorConfigFieldsProps) => {
    const [extraColor, setExtraColor] = useState('');

    const handleModeChange = (mode: PrinterColorMode) => {
        if (mode === 'bw') {
            onChange({ colorMode: mode, colors: defaultColorsForMode('bw') });
            return;
        }

        // Переход на цветной: CMYK + уже добавленные доп. цвета (кроме одиночного K)
        const extras = colors.filter(
            (c) => !(CMYK_COLORS as readonly string[]).includes(c) && c !== 'K'
        );
        onChange({
            colorMode: mode,
            colors: normalizeColorList([...CMYK_COLORS, ...extras]),
        });
    };

    const handleAddExtra = () => {
        const code = normalizeColorCode(extraColor);
        if (!code) return;
        if (colors.includes(code)) {
            setExtraColor('');
            return;
        }
        onChange({
            colorMode: 'color',
            colors: normalizeColorList([...colors, code]),
        });
        setExtraColor('');
    };

    const handleRemove = (code: string) => {
        // Базовый CMYK и единственный K у Ч/Б нельзя снять полностью
        if (colorMode === 'bw') return;
        if ((CMYK_COLORS as readonly string[]).includes(code)) return;

        onChange({
            colorMode,
            colors: colors.filter((c) => c !== code),
        });
    };

    return (
        <div className={cls.colorConfig}>
            <div className={cls.colorModeRow}>
                <span className={cls.colorModeLabel}>Тип печати</span>
                <div className={cls.colorModeButtons}>
                    <button
                        type="button"
                        className={
                            colorMode === 'color'
                                ? cls.modeActive
                                : cls.modeButton
                        }
                        onClick={() => handleModeChange('color')}
                    >
                        Цветной (CMYK)
                    </button>
                    <button
                        type="button"
                        className={
                            colorMode === 'bw' ? cls.modeActive : cls.modeButton
                        }
                        onClick={() => handleModeChange('bw')}
                    >
                        Чёрно-белый (K)
                    </button>
                </div>
            </div>

            <div className={cls.colorChips}>
                {colors.map((code) => {
                    const isBase =
                        colorMode === 'bw'
                            ? code === 'K'
                            : (CMYK_COLORS as readonly string[]).includes(code);
                    return (
                        <span key={code} className={cls.colorChip}>
                            {code}
                            {!isBase && (
                                <DeleteButton
                                    size="sm"
                                    label={`Удалить цвет ${code}`}
                                    onClick={() => handleRemove(code)}
                                />
                            )}
                        </span>
                    );
                })}
            </div>

            {colorMode === 'color' && (
                <div className={cls.extraColorRow}>
                    <input
                        className={cls.input}
                        value={extraColor}
                        onChange={(e) => setExtraColor(e.target.value)}
                        placeholder="Доп. цвет (W, Or, …)"
                        maxLength={8}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddExtra();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className={cls.submit}
                        onClick={handleAddExtra}
                    >
                        Добавить цвет
                    </button>
                </div>
            )}
        </div>
    );
};

export default ColorConfigFields;
