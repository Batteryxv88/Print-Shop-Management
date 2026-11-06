import cls from './SidebarRotation.module.scss';
import { useState, useEffect } from 'react';
import AddRotationForm from '../../../features/ui/AddRotationForm/AddRotationForm';
import ImportRotationExcel from './ImportRotationExcel';
import { useAppSelector, useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import { RootState } from '../../../app/providers/StoreProvider/Store';
import { fetchForms } from '../../../app/providers/StoreProvider/Store/RotationFormsSlice';
import { changeRotationModule } from '../../../app/providers/StoreProvider/Store/ChangeRotationModule';
import { setSelectedFormId } from '../../../app/providers/StoreProvider/Store/SelectedFormSlice';
import SidebarRotationSkeleton from './SidebarRotationSkeleton';

const SidebarRotation = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const dispatch = useAppDispatch();
    const { rotationForms, loading } = useAppSelector((state: RootState) => state.rotationForms);
    const rotationModule = useAppSelector((state: RootState) => state.rotationModule.rotationModule);

    useEffect(() => {
        if (rotationForms.length === 0 && !loading) {
            dispatch(fetchForms());
        }
    }, [dispatch, rotationForms.length, loading]);

    const filteredForms = rotationForms
        .filter(form => {
            const query = searchQuery.trim();
            if (!query) return false;

            const searchNumber = parseInt(query, 10);
            if (isNaN(searchNumber)) return false;

            return form.width === searchNumber || form.height === searchNumber;
        })
        .sort((a, b) => {
            if (a.width !== b.width) {
                return a.width - b.width;
            }
            return a.height - b.height;
        });

    const handleSelectForm = (formId: string) => {
        dispatch(changeRotationModule('preview'));
        dispatch(setSelectedFormId(formId));
        setSearchQuery('');
    };

    const query = searchQuery.trim();

    return (
        <div className={cls.panel}>
            <header className={cls.header}>
                <h2 className={cls.headerTitle}>Ротация</h2>
                <span className={cls.headerMeta}>{rotationForms.length}</span>
            </header>

            <div className={cls.list}>
                <p className={cls.groupLabel}>Вид</p>
                <button
                    type="button"
                    className={`${cls.item} ${rotationModule === 'table' ? cls.itemActive : ''}`}
                    onClick={() => dispatch(changeRotationModule('table'))}
                >
                    <span className={cls.itemText}>
                        <span className={cls.itemName}>Таблица</span>
                        <span className={cls.itemHint}>Все формы списком</span>
                    </span>
                    <span className={cls.chevron} aria-hidden>›</span>
                </button>
                <button
                    type="button"
                    className={`${cls.item} ${rotationModule === 'preview' ? cls.itemActive : ''}`}
                    onClick={() => dispatch(changeRotationModule('preview'))}
                >
                    <span className={cls.itemText}>
                        <span className={cls.itemName}>Предпросмотр</span>
                        <span className={cls.itemHint}>Раскладка на форме</span>
                    </span>
                    <span className={cls.chevron} aria-hidden>›</span>
                </button>

                <p className={cls.groupLabel}>Найти</p>
                <input
                    type="text"
                    placeholder="Размер, мм"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cls.search}
                />
                {query && (
                    loading ? (
                        <SidebarRotationSkeleton />
                    ) : filteredForms.length > 0 ? (
                        filteredForms.map(form => (
                            <button
                                key={form.id}
                                type="button"
                                className={cls.item}
                                onClick={() => handleSelectForm(form.id)}
                            >
                                <span className={cls.itemText}>
                                    <span className={cls.itemName}>{form.width}×{form.height}</span>
                                    <span className={cls.itemHint}>
                                        ручьи: {form.columns}, ряды: {form.rows}
                                    </span>
                                </span>
                                <span className={cls.chevron} aria-hidden>›</span>
                            </button>
                        ))
                    ) : (
                        <p className={cls.empty}>Формы не найдены</p>
                    )
                )}

                <p className={cls.groupLabel}>Действия</p>
                <button
                    type="button"
                    className={cls.item}
                    onClick={() => setIsModalOpen(true)}
                >
                    <span className={cls.itemText}>
                        <span className={cls.itemName}>Добавить форму</span>
                        <span className={cls.itemHint}>Новая вырубка вручную</span>
                    </span>
                    <span className={cls.chevron} aria-hidden>›</span>
                </button>
                <ImportRotationExcel />
            </div>

            <AddRotationForm
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
};

export default SidebarRotation;
