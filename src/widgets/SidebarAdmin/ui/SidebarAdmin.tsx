import { changeAdminComponent } from "../../../app/providers/StoreProvider/Store/ChangeAdminComponent";
import { useAppDispatch, useAppSelector } from "../../../app/providers/StoreProvider/Store/hooks";
import cls from "./SidebarAdmin.module.scss";

const SECTIONS = [
    { id: "Главная", name: "Пользователи", hint: "Учётные записи" },
    { id: "Редактор переменных", name: "Принтеры", hint: "Список и расписание" },
    { id: "Склады материалов", name: "Склады", hint: "Бумага и ламинация" },
];

const SidebarAdmin = () => {
    const dispatch = useAppDispatch();
    const adminComponent = useAppSelector((state) => state.adminComponent.adminComponent);
    const current = SECTIONS.some((item) => item.id === adminComponent)
        ? adminComponent
        : "Главная";

    return (
        <div className={cls.panel}>
            <div className={cls.header}>
                <h2 className={cls.headerTitle}>Администрирование</h2>
                <span className={cls.headerMeta}>Разделы</span>
            </div>
            <div className={cls.list}>
                {SECTIONS.map((item) => {
                    const active = current === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={`${cls.item} ${active ? cls.itemActive : ""}`}
                            onClick={() => dispatch(changeAdminComponent(item.id))}
                        >
                            <span className={cls.itemText}>
                                <span className={cls.itemName}>{item.name}</span>
                                <span className={cls.itemHint}>{item.hint}</span>
                            </span>
                            <span className={cls.chevron} aria-hidden>›</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SidebarAdmin;
