import { changePage } from "../../../app/providers/StoreProvider/Store/ChangePageSlice";
import { useAppDispatch, useAppSelector } from "../../../app/providers/StoreProvider/Store/hooks";
import cls from "./AdminPage.module.scss";
import { AdminMainComponent } from "../../../pages/AdminMainComponent";
import VariablesEditor from "../../../widgets/VariablesEditor/ui/VariablesEditor";
import StockModulesEditor from "../../../widgets/StockModulesEditor/ui/StockModulesEditor";
import OptionalModulesEditor from "../../../widgets/OptionalModulesEditor/ui/OptionalModulesEditor";
import { useIsMobile } from "../../../shared/lib/hooks/useBreakpoint";

const SECTIONS = ["Редактор переменных", "Склады материалов", "Разделы"] as const;

const sectionLabel = (id: string) => {
    if (id === "Редактор переменных") return "Принтеры";
    if (id === "Склады материалов") return "Склады";
    if (id === "Разделы") return "Разделы";
    return "Пользователи";
};

const AdminPage = () => {
    const dispatch = useAppDispatch();
    dispatch(changePage("admin"));
    const adminComponent = useAppSelector((state) => state.adminComponent.adminComponent);
    const isMobile = useIsMobile();
    const section = (SECTIONS as readonly string[]).includes(adminComponent)
        ? adminComponent
        : "Главная";
    const isHeavyEditor = section === "Редактор переменных" || section === "Склады материалов";

    if (isMobile && isHeavyEditor) {
        return (
            <div className={cls.page} data-testid="admin-root">
                <div className={cls.browser}>
                    <div
                        className={cls.mobileEditorStub}
                        data-testid="admin-mobile-stub"
                    >
                        <h2>Админка на телефоне</h2>
                        <p>
                            Пользователи доступны здесь. Принтеры и склады
                            материалов откройте на планшете или компьютере.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cls.page} data-testid="admin-root">
            <div className={cls.browser}>
                <div className={cls.browserTop}>
                    <nav className={cls.breadcrumb} aria-label="Путь">
                        <span className={cls.crumbHome} aria-hidden>⌂</span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumb}>Администрирование</span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumbCurrent}>{sectionLabel(section)}</span>
                    </nav>
                </div>
                <div className={cls.content}>
                    {section === "Главная" && <AdminMainComponent />}
                    {section === "Редактор переменных" && <VariablesEditor />}
                    {section === "Склады материалов" && <StockModulesEditor />}
                    {section === "Разделы" && <OptionalModulesEditor />}
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
