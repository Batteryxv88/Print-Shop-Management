import cls from './SidebarLamination.module.scss';

const SidebarLamination = () => (
    <div className={cls.panel}>
        <header className={cls.header}>
            <h2 className={cls.headerTitle}>Калькулятор</h2>
            <span className={cls.headerMeta}>Приладка</span>
        </header>
        <div className={cls.list}>
            <p className={cls.groupLabel}>Добавьте к тиражу</p>
            <div className={cls.note}>
                <span className={cls.noteName}>Бумага</span>
                <span className={cls.noteHint}>минимум 7 м</span>
            </div>
            <div className={cls.note}>
                <span className={cls.noteName}>Ламинация</span>
                <span className={cls.noteHint}>минимум 3 м</span>
            </div>
        </div>
    </div>
);

export default SidebarLamination;
