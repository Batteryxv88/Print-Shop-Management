import cls from "./Sidebar.module.scss";
import {
    useAppSelector,
    usePrinters,
} from "../../../app/providers/StoreProvider/Store/hooks";
import { SidebarLamination } from "../../SidebarLamination";
import SidebarRotation from "../../SidebarRotation/ui/SidebarRotation";
import { SidebarManuals } from "../../SidebarManuals";
import { SidebarAdmin } from "../../SidebarAdmin";
import { SidebarStock } from "../../SidebarStock";
import { SidebarAnalytics } from "../../SidebarAnalytics";
import { SidebarJournal } from "../../SidebarJournal";


const Sidebar = () => {
    const pageState = useAppSelector((state) => state.pages.page);
    usePrinters();

    return (
        <div className={cls.sidebar}>
            {pageState === "rotation" ? (
                <SidebarRotation />
            ) : pageState === "calculator" ? (
                <SidebarLamination />
            ) : pageState === "journal" ? (
                <SidebarJournal />
            ) : pageState === "manuals" ? (
                <SidebarManuals />
            ) : pageState === "admin" ? (
                <SidebarAdmin />
            ) : pageState === "main" ? (
                <SidebarStock />
            ) : pageState === "analytics" ? (
                <SidebarAnalytics />
            ) : (
                ""
            )}
        </div>
    );
};

export default Sidebar;
