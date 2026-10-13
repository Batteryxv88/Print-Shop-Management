import { changePage } from "../../../app/providers/StoreProvider/Store/ChangePageSlice";
import { useAppDispatch } from "../../../app/providers/StoreProvider/Store/hooks";
import AddReplacedPart from "../../../features/ui/AddReplacedPart/AddReplacedPart";
import Calendar from "../../../widgets/Calendar/Calendar";
import cls from "./SchedulePage.module.scss";

const SchedulePage = () => {
    const dispatch = useAppDispatch();
    
    dispatch(changePage("schedule")); 

    return (
        <div>
            <div className={cls.toolbar}>
                <AddReplacedPart />
            </div>
            <Calendar />
        </div>
    );
};

export default SchedulePage;
