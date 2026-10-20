import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import cls from './Navbar.module.scss';
import { useAuth } from '../../../contexts/AuthContext';
import { logout } from '../../../services/auth';
import { useCounterReadingReminder } from '../../../shared/lib/hooks/useCounterReadingReminder';
import { PrimaryNavLinks } from '../../../app/layout/PrimaryNavLinks';
import {
    useAppDispatch,
    useAppSelector,
} from '../../../app/providers/StoreProvider/Store/hooks';
import { toggleSidebar } from '../../../app/providers/StoreProvider/Store/UiSlice';

const SCROLL_SOLID_AT = 12;

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
    const { user, userData } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    useCounterReadingReminder();

    useEffect(() => {
        const readScrollTop = (target: EventTarget | null) => {
            if (target instanceof Document) {
                return (
                    window.scrollY ||
                    document.documentElement.scrollTop ||
                    document.body.scrollTop ||
                    0
                );
            }
            if (target instanceof Element) {
                return target.scrollTop;
            }
            return 0;
        };

        const onScroll = (event: Event) => {
            const top = Math.max(
                readScrollTop(event.target),
                window.scrollY || 0
            );
            setScrolled(top > SCROLL_SOLID_AT);
        };

        window.addEventListener('scroll', onScroll, true);
        return () => window.removeEventListener('scroll', onScroll, true);
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <div className={classNames(cls.navbar, scrolled && cls.scrolled)}>
            <div className={cls.leftCluster}>
                <button
                    type="button"
                    className={cls.menuButton}
                    aria-label="Открыть меню"
                    aria-expanded={sidebarOpen}
                    data-testid="nav-menu-toggle"
                    onClick={() => dispatch(toggleSidebar())}
                >
                    <span className={cls.menuIcon} aria-hidden />
                </button>
                <span className={cls.brand}>PSM</span>
                <PrimaryNavLinks
                    className={cls.navLinks}
                    linkClassName={cls.button}
                    activeClassName={cls.active}
                />
            </div>
            <div className={cls.rightSection}>
                {user && (
                    <div className={cls.userInfo}>
                        <div className={cls.userInfoContent}>
                            <span className={cls.name}>{user.displayName}</span>
                            {userData && (
                                <span className={cls.role}>{userData.role}</span>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            className={cls.logoutButton}
                        >
                            Выйти
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Navbar;
