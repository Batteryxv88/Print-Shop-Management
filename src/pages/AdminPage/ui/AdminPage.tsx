import { changePage } from "../../../app/providers/StoreProvider/Store/ChangePageSlice";
import { useAppDispatch } from "../../../app/providers/StoreProvider/Store/hooks";
import cls from "./AdminPage.module.scss";
import { AdminMainComponent } from "../../../pages/AdminMainComponent";
import { useAppSelector } from "../../../app/providers/StoreProvider/Store/hooks";
import ReportEditor from "../../../widgets/ReportEditor/ui/ReportEditor";
import VariablesEditor from "../../../widgets/VariablesEditor/ui/VariablesEditor";
import StockModulesEditor from "../../../widgets/StockModulesEditor/ui/StockModulesEditor";

const AdminPage = () => {

    const dispatch = useAppDispatch();
    dispatch(changePage("admin"));
    const adminComponent = useAppSelector((state) => state.adminComponent.adminComponent);
    return (
        <div className={cls.adminPage}>
            {adminComponent === "Главная" && <AdminMainComponent />}
            {adminComponent === "Радактор отчета" && <ReportEditor />}
            {adminComponent === "Редактор переменных" && <VariablesEditor />}
            {adminComponent === "Склады материалов" && <StockModulesEditor />}
        </div>
    );
};

export default AdminPage;
