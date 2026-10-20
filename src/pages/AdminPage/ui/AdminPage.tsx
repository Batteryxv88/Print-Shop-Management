import { changePage } from "../../../app/providers/StoreProvider/Store/ChangePageSlice";
import { useAppDispatch } from "../../../app/providers/StoreProvider/Store/hooks";
import cls from "./AdminPage.module.scss";
import { AdminMainComponent } from "../../../pages/AdminMainComponent";
import { useAppSelector } from "../../../app/providers/StoreProvider/Store/hooks";
import ReportEditor from "../../../widgets/ReportEditor/ui/ReportEditor";
import VariablesEditor from "../../../widgets/VariablesEditor/ui/VariablesEditor";
import StockModulesEditor from "../../../widgets/StockModulesEditor/ui/StockModulesEditor";
import { useIsMobile } from "../../../shared/lib/hooks/useBreakpoint";

const AdminPage = () => {

    const dispatch = useAppDispatch();
    dispatch(changePage("admin"));
    const adminComponent = useAppSelector((state) => state.adminComponent.adminComponent);
    const isMobile = useIsMobile();
    const isHeavyEditor = adminComponent !== "Главная";

    if (isMobile && isHeavyEditor) {
        return (
            <div className={cls.adminPage} data-testid="admin-root">
                <div
                    className={cls.mobileEditorStub}
                    data-testid="admin-mobile-stub"
                >
                    <h2>Админка на телефоне</h2>
                    <p>
                        Управление пользователями — на вкладке «Главная».
                        Редакторы отчёта, переменных и складов материалов
                        откройте на планшете или компьютере.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={cls.adminPage} data-testid="admin-root">
            <div className={cls.adminSurface}>
                {adminComponent === "Главная" && <AdminMainComponent />}
                {adminComponent === "Радактор отчета" && <ReportEditor />}
                {adminComponent === "Редактор переменных" && <VariablesEditor />}
                {adminComponent === "Склады материалов" && <StockModulesEditor />}
            </div>
        </div>
    );
};

export default AdminPage;
