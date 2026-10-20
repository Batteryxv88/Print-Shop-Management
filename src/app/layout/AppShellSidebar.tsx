import { useEffect, useRef } from 'react';
import classNames from 'classnames';
import { useLocation } from 'react-router-dom';
import Sidebar from '../../widgets/Sidebar/ui/Sidebar';
import {
    useAppDispatch,
    useAppSelector,
} from '../providers/StoreProvider/Store/hooks';
import { closeSidebar } from '../providers/StoreProvider/Store/UiSlice';
import { PrimaryNavLinks } from './PrimaryNavLinks';
import shellCls from './AppShell.module.scss';

export const AppShellSidebar = () => {
    const dispatch = useAppDispatch();
    const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
    const location = useLocation();
    const pathRef = useRef(location.pathname);

    useEffect(() => {
        if (pathRef.current !== location.pathname) {
            pathRef.current = location.pathname;
            dispatch(closeSidebar());
        }
    }, [location.pathname, dispatch]);

    useEffect(() => {
        if (!sidebarOpen) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                dispatch(closeSidebar());
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [sidebarOpen, dispatch]);

    const close = () => dispatch(closeSidebar());

    return (
        <>
            <button
                type="button"
                className={classNames(
                    shellCls.backdrop,
                    sidebarOpen && shellCls.backdropVisible
                )}
                aria-label="Закрыть меню"
                tabIndex={sidebarOpen ? 0 : -1}
                onClick={close}
                data-testid="sidebar-backdrop"
            />
            <aside
                className={classNames(
                    shellCls.sidebarShell,
                    sidebarOpen && shellCls.sidebarShellOpen
                )}
                data-testid="app-sidebar"
                data-open={sidebarOpen ? 'true' : 'false'}
                aria-hidden={undefined}
            >
                <div
                    className={shellCls.mobilePrimaryNav}
                    data-testid="mobile-primary-nav"
                >
                    <p className={shellCls.mobileNavTitle}>Разделы</p>
                    <PrimaryNavLinks
                        className={shellCls.mobileNavLinks}
                        linkClassName={shellCls.mobileNavLink}
                        activeClassName={shellCls.mobileNavLinkActive}
                        onLinkClick={close}
                        showCounterReminder
                    />
                </div>
                <div className={shellCls.contextSidebar}>
                    <Sidebar />
                </div>
            </aside>
        </>
    );
};
