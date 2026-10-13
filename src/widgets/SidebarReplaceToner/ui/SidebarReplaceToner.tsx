import { useAppDispatch, useAppSelector } from "../../../app/providers/StoreProvider/Store/hooks";
import { changeTonerMachine } from "../../../app/providers/StoreProvider/Store/ChangeMachineSlice";
import PrinterSelectTabs from "../../../shared/ui/PrinterSelectTabs/PrinterSelectTabs";

const SidebarReplaceToner = () => {
    const dispatch = useAppDispatch();
    const machineState = useAppSelector((state) => state.machines.tonerMachine);

    return (
        <PrinterSelectTabs
            selected={machineState}
            onSelect={(name) => dispatch(changeTonerMachine(name))}
        />
    );
};

export default SidebarReplaceToner;
