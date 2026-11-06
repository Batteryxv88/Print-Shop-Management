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
    const viewLabel = rotationModule === 'preview' ? 'Предпросмотр' : 'Таблица';

    return (
        <div className={`${cls.page} ${className ?? ''}`}>
            <div className={cls.browser}>
                <div className={cls.browserTop}>
                    <nav className={cls.breadcrumb} aria-label="Путь">
                        <span className={cls.crumbHome} aria-hidden>
                            ⌂
                        </span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumb}>Ротация</span>
                        <span className={cls.crumbSep}>›</span>
                        <span className={cls.crumbCurrent}>{viewLabel}</span>
                    </nav>
                </div>
                <div className={cls.content}>
                    {isMobile ? (
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
                    ) : (
                        <>
                            {rotationModule === 'table' && <RotationFormTable />}
                            {rotationModule === 'preview' && <RotationFormPreview />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RotationPage;
