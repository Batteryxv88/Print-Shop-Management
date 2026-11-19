import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../app/providers/StoreProvider/Store/hooks';

type ModuleFlag = 'calculatorEnabled' | 'rotationEnabled' | 'manualsEnabled';

export const OptionalModuleRoute = ({
    module,
    children,
}: {
    module: ModuleFlag;
    children: ReactNode;
}) => {
    const enabled = useAppSelector((state) => state.appSettings[module]);
    if (!enabled) return <Navigate to="/" replace />;
    return <>{children}</>;
};
