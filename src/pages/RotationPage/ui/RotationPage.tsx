import { useSelector } from 'react-redux';
import { RootState } from '../../../app/providers/StoreProvider/Store';
import { changePage } from '../../../app/providers/StoreProvider/Store/ChangePageSlice';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import cls from './RotationPage.module.scss';
import RotationFormTable from '../../../widgets/RotationFormTable/ui/RotationFormTable';
import RotationFormPreview from '../../../widgets/RotationFormPreview/ui/RotationFormPreview';
import { useIsMobile } from '../../../shared/lib/hooks/useBreakpoint';

interface RotationPageProps {
    className?: string;
}

const RotationPage = ({ className }: RotationPageProps) => {
    const dispatch = useAppDispatch();
    dispatch(changePage('rotation'));

    const rotationModule = useSelector((state: RootState) => state.rotationModule.rotationModule);
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <div
                className={cls.rotationStub}
                data-testid="rotation-mobile-stub"
            >
                <h2>Ротация форм</h2>
                <p>
                    Таблица и превью ротации рассчитаны на планшет и компьютер.
                    Откройте раздел на большем экране.
                </p>
            </div>
        );
    }

    return (
        <>
            {rotationModule === 'table' && <RotationFormTable />}
            {rotationModule === 'preview' && <RotationFormPreview />}
        </>
    )
};

export default RotationPage;