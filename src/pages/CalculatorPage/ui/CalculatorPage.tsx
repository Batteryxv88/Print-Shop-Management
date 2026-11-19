import { useEffect, useState, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { changePage } from '../../../app/providers/StoreProvider/Store/ChangePageSlice';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import cls from './CalculatorPage.module.scss';
import {
    LAMINATION_CORE_MM,
    LAMINATION_FILM_MM,
    PAPER_CODES,
    PAPER_CORE_MM,
    PAPER_FILM_MM,
    PaperCode,
    STANDARD_LENGTHS_M,
    formatMm,
    rollLengthM,
    rollThicknessMm,
} from '../../../shared/lib/calculator/rollThickness';

type CalcMode = 'length' | 'thickness';
type LaminateType = keyof typeof LAMINATION_FILM_MM;

const laminationOptions: { id: LaminateType; label: string }[] = [
    { id: 'matte', label: 'Матовая' },
    { id: 'glossy', label: 'Глянцевая' },
];

const paperOptions: { id: PaperCode; label: string }[] = PAPER_CODES.map((code) => ({
    id: code,
    label: code,
}));

interface CustomRollProps<T extends string> {
    title: string;
    mode: CalcMode;
    onMode: (mode: CalcMode) => void;
    options: { id: T; label: string }[];
    selected: T | null;
    onSelect: (id: T) => void;
    input: string;
    onInput: (value: string) => void;
    coreMm: number;
    filmMm: number | null;
    missingLabel: string;
}

const liveRoll = (
    input: string,
    filmMm: number | null,
    coreMm: number,
    mode: CalcMode,
    missingLabel: string,
) => {
    const trimmed = input.trim();
    if (trimmed === '') return { result: null as number | null, error: null as string | null };
    const value = parseFloat(trimmed);
    if (Number.isNaN(value)) {
        return {
            result: null,
            error: mode === 'thickness'
                ? 'Введите корректное значение метража'
                : 'Введите корректное значение толщины',
        };
    }
    if (filmMm == null) return { result: null, error: missingLabel };
    return {
        result: mode === 'thickness'
            ? rollThicknessMm(coreMm, filmMm, value)
            : rollLengthM(coreMm, filmMm, value),
        error: null,
    };
};

function CustomRoll<T extends string>({
    title,
    mode,
    onMode,
    options,
    selected,
    onSelect,
    input,
    onInput,
    coreMm,
    filmMm,
    missingLabel,
}: CustomRollProps<T>) {
    const { result, error } = liveRoll(input, filmMm, coreMm, mode, missingLabel);
    const unit = mode === 'thickness' ? 'мм' : 'м';
    const selectedLength = mode === 'thickness' ? parseFloat(input) : NaN;

    const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
    };

    const pickLength = (length: number) => {
        onMode('thickness');
        onInput(String(length));
    };

    return (
        <section className={cls.calc}>
            <h2 className={cls.calcTitle}>{title}</h2>
            <div className={cls.calcRow}>
                <button
                    type="button"
                    className={`${cls.chip} ${mode === 'thickness' ? cls.active : ''}`}
                    onClick={() => onMode('thickness')}
                >
                    Толщина
                </button>
                <button
                    type="button"
                    className={`${cls.chip} ${mode === 'length' ? cls.active : ''}`}
                    onClick={() => onMode('length')}
                >
                    Метраж
                </button>
                {options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        className={`${cls.chip} ${selected === option.id ? cls.active : ''}`}
                        onClick={() => onSelect(option.id)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <div className={cls.ruler} role="list">
                {STANDARD_LENGTHS_M.map((length) => {
                    const thickness = filmMm == null
                        ? null
                        : formatMm(rollThicknessMm(coreMm, filmMm, length));
                    const active = selectedLength === length;
                    return (
                        <button
                            key={length}
                            type="button"
                            role="listitem"
                            className={`${cls.tick} ${active ? cls.tickActive : ''}`}
                            aria-label={thickness == null ? `${length} м` : `${length} м, толщина ${thickness} мм`}
                            aria-pressed={active}
                            onClick={() => pickLength(length)}
                        >
                            <span className={cls.tickLength}>{length} м</span>
                            <span className={cls.tickThickness}>{thickness ?? '\u00a0'}</span>
                        </button>
                    );
                })}
            </div>
            <div className={cls.calcLine}>
                <input
                    type="number"
                    value={input}
                    onChange={(e) => onInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={mode === 'thickness' ? 'Метраж, м' : 'Толщина слоя, мм'}
                    className={cls.input}
                />
                <span className={`${cls.calcValue} ${result === null ? cls.calcValueEmpty : ''}`}>
                    {result === null ? '—' : `${result.toFixed(2)} ${unit}`}
                </span>
            </div>
            {error && <div className={cls.error}>{error}</div>}
        </section>
    );
}

const CalculatorPage = () => {
    const dispatch = useAppDispatch();
    dispatch(changePage('calculator'));

    useEffect(() => {
        let buffer = '';
        const handleKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Enter') {
                if (buffer.length > 0) {
                    console.log('Scanned barcode:', buffer);
                    buffer = '';
                }
            } else if (e.key.length === 1) {
                buffer += e.key;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    const [laminationMode, setLaminationMode] = useState<CalcMode>('length');
    const [laminateType, setLaminateType] = useState<LaminateType | null>(null);
    const [laminationInput, setLaminationInput] = useState('');

    const [materialMode, setMaterialMode] = useState<CalcMode>('length');
    const [paper, setPaper] = useState<PaperCode | null>(null);
    const [materialInput, setMaterialInput] = useState('');

    return (
        <div className={cls.page} data-testid="calculator-root">
            <div className={cls.browser}>
                <div className={cls.browserTop}>
                    <nav className={cls.breadcrumb} aria-label="Путь">
                        <span className={cls.crumbHome} aria-hidden>⌂</span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumbCurrent}>Калькулятор</span>
                    </nav>
                </div>
                <div className={cls.content}>
                    <div className={cls.calcs}>
                        <CustomRoll
                            title="Бумага"
                            mode={materialMode}
                            onMode={setMaterialMode}
                            options={paperOptions}
                            selected={paper}
                            onSelect={(id) => setPaper(id)}
                            input={materialInput}
                            onInput={setMaterialInput}
                            coreMm={PAPER_CORE_MM}
                            filmMm={paper ? PAPER_FILM_MM[paper] : null}
                            missingLabel="Выберите материал"
                        />
                        <CustomRoll
                            title="Ламинация"
                            mode={laminationMode}
                            onMode={setLaminationMode}
                            options={laminationOptions}
                            selected={laminateType}
                            onSelect={(id) => setLaminateType(id)}
                            input={laminationInput}
                            onInput={setLaminationInput}
                            coreMm={LAMINATION_CORE_MM}
                            filmMm={laminateType ? LAMINATION_FILM_MM[laminateType] : null}
                            missingLabel="Выберите тип ламинации"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculatorPage;
