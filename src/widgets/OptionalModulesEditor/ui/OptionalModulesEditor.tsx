import { useEffect, useState } from 'react';
import cls from './OptionalModulesEditor.module.scss';
import { useAppDispatch, useAppSelector } from '../../../app/providers/StoreProvider/Store/hooks';
import {
    loadAppSettings,
    saveOptionalModuleSettings,
} from '../../../app/providers/StoreProvider/Store/AppSettingsSlice';

const OptionalModulesEditor = () => {
    const dispatch = useAppDispatch();
    const {
        calculatorEnabled,
        rotationEnabled,
        manualsEnabled,
        saving,
        loaded,
        error,
    } = useAppSelector((s) => s.appSettings);
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        dispatch(loadAppSettings());
    }, [dispatch]);

    const save = async (patch: {
        calculatorEnabled?: boolean;
        rotationEnabled?: boolean;
        manualsEnabled?: boolean;
    }) => {
        setFlash(false);
        const result = await dispatch(saveOptionalModuleSettings(patch));
        if (saveOptionalModuleSettings.fulfilled.match(result)) {
            setFlash(true);
        }
    };

    return (
        <div className={cls.editor}>
            <h2 className={cls.h2}>Разделы</h2>
            <section className={cls.card}>
                <h3 className={cls.cardTitle}>Модули типографии</h3>
                <p className={cls.hint}>
                    Выключенный раздел пропадает из меню. Прямой адрес
                    открывает склад.
                </p>
                <label className={cls.toggle}>
                    <input
                        type="checkbox"
                        checked={calculatorEnabled}
                        disabled={!loaded || saving}
                        onChange={(e) =>
                            save({ calculatorEnabled: e.target.checked })
                        }
                    />
                    <span>Калькулятор</span>
                </label>
                <label className={cls.toggle}>
                    <input
                        type="checkbox"
                        checked={rotationEnabled}
                        disabled={!loaded || saving}
                        onChange={(e) =>
                            save({ rotationEnabled: e.target.checked })
                        }
                    />
                    <span>Ротация</span>
                </label>
                <label className={cls.toggle}>
                    <input
                        type="checkbox"
                        checked={manualsEnabled}
                        disabled={!loaded || saving}
                        onChange={(e) =>
                            save({ manualsEnabled: e.target.checked })
                        }
                    />
                    <span>Сервис инструкции</span>
                </label>
                {flash && !error && (
                    <p className={cls.ok}>Настройки сохранены</p>
                )}
                {error && <p className={cls.error}>{error}</p>}
            </section>
        </div>
    );
};

export default OptionalModulesEditor;
