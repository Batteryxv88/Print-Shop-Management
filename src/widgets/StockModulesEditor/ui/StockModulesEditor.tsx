import { useEffect, useState } from 'react';
import cls from './StockModulesEditor.module.scss';
import { useAppDispatch, useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';
import {
    loadAppSettings,
    saveStockModuleSettings,
} from '../../../app/providers/StoreProvider/Store/AppSettingsSlice';
import { PaperFormMode } from '../../../services/appSettings';
import {
    CATALOG_LABELS,
    MaterialCatalog,
    MaterialCatalogKey,
    fetchMaterialCatalog,
    saveMaterialCatalog,
} from '../../../services/materialCatalog';
import DeleteButton from '../../../shared/ui/DeleteButton/DeleteButton';

const StockModulesEditor = () => {
    const dispatch = useAppDispatch();
    const {
        paperStockEnabled,
        laminationStockEnabled,
        paperFormMode,
        saving,
        loaded,
        error,
    } = useAppSelector((s) => s.appSettings);

    const [catalog, setCatalog] = useState<MaterialCatalog | null>(null);
    const [catalogKey, setCatalogKey] =
        useState<MaterialCatalogKey>('paperTypes');
    const [newValue, setNewValue] = useState('');
    const [catalogMsg, setCatalogMsg] = useState('');
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        dispatch(loadAppSettings());
        fetchMaterialCatalog()
            .then(setCatalog)
            .catch(() => setCatalog(null));
    }, [dispatch]);

    const saveModules = async (patch: {
        paperStockEnabled?: boolean;
        laminationStockEnabled?: boolean;
        paperFormMode?: PaperFormMode;
    }) => {
        setFlash(false);
        const result = await dispatch(saveStockModuleSettings(patch));
        if (saveStockModuleSettings.fulfilled.match(result)) {
            setFlash(true);
        }
    };

    const handleAddCatalogValue = async () => {
        if (!catalog || !newValue.trim()) return;
        setCatalogMsg('');
        const next = {
            ...catalog,
            [catalogKey]: [
                ...catalog[catalogKey],
                newValue.trim(),
            ].filter(
                (v, i, arr) =>
                    arr.findIndex(
                        (x) => x.toLowerCase() === v.toLowerCase()
                    ) === i
            ),
        };
        const saved = await saveMaterialCatalog(next);
        setCatalog(saved);
        setNewValue('');
        setCatalogMsg('Сохранено');
    };

    const handleRemoveCatalogValue = async (value: string) => {
        if (!catalog) return;
        const next = {
            ...catalog,
            [catalogKey]: catalog[catalogKey].filter((v) => v !== value),
        };
        const saved = await saveMaterialCatalog(next);
        setCatalog(saved);
    };

    return (
        <div className={cls.editor}>
            <h2 className={cls.h2}>Склады материалов</h2>

            <section className={cls.card}>
                <h3 className={cls.cardTitle}>Модули</h3>
                <p className={cls.hint}>
                    Выключает разделы «Бумага» / «Ламинация» на складе и в
                    журнале. Учёт деталей и тонеров не затрагивается.
                </p>

                <label className={cls.toggle}>
                    <input
                        type="checkbox"
                        checked={paperStockEnabled}
                        disabled={!loaded || saving}
                        onChange={(e) =>
                            saveModules({
                                paperStockEnabled: e.target.checked,
                            })
                        }
                    />
                    <span>Склад бумаги</span>
                </label>

                <label className={cls.toggle}>
                    <input
                        type="checkbox"
                        checked={laminationStockEnabled}
                        disabled={!loaded || saving}
                        onChange={(e) =>
                            saveModules({
                                laminationStockEnabled: e.target.checked,
                            })
                        }
                    />
                    <span>Склад ламинации</span>
                </label>

                {paperStockEnabled && (
                    <div className={cls.field}>
                        <span className={cls.label}>Тип склада бумаги</span>
                        <select
                            value={paperFormMode}
                            disabled={!loaded || saving}
                            onChange={(e) =>
                                saveModules({
                                    paperFormMode: e.target
                                        .value as PaperFormMode,
                                })
                            }
                        >
                            <option value="roll">Только рулонная</option>
                            <option value="sheet">Только листовая</option>
                            <option value="both">Рулонная и листовая</option>
                        </select>
                    </div>
                )}

                {flash && !error && (
                    <p className={cls.ok}>Настройки сохранены</p>
                )}
                {error && <p className={cls.error}>{error}</p>}
            </section>

            <section className={cls.card}>
                <h3 className={cls.cardTitle}>Справочники свойств</h3>
                <p className={cls.hint}>
                    Значения появятся в выпадающих списках при приходе нового
                    типа. Можно добавить «иное» вручную.
                </p>

                <div className={cls.field}>
                    <span className={cls.label}>Справочник</span>
                    <select
                        value={catalogKey}
                        onChange={(e) =>
                            setCatalogKey(e.target.value as MaterialCatalogKey)
                        }
                    >
                        {(
                            Object.keys(CATALOG_LABELS) as MaterialCatalogKey[]
                        ).map((key) => (
                            <option key={key} value={key}>
                                {CATALOG_LABELS[key]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={cls.addRow}>
                    <input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Новое значение…"
                    />
                    <button type="button" onClick={handleAddCatalogValue}>
                        Добавить
                    </button>
                </div>

                {catalogMsg && <p className={cls.ok}>{catalogMsg}</p>}

                <ul className={cls.chips}>
                    {(catalog?.[catalogKey] || []).map((v) => (
                        <li key={v}>
                            <span>{v}</span>
                            <DeleteButton
                                size="sm"
                                label={`Удалить «${v}»`}
                                onClick={() => handleRemoveCatalogValue(v)}
                            />
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
};

export default StockModulesEditor;
