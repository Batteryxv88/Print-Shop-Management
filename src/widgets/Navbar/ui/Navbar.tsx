import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from "react-router-dom";
import classNames from 'classnames';
import cls from "./Navbar.module.scss";
import Button from "../../../shared/ui/Button/Button";
import { useAuth } from "../../../contexts/AuthContext";
import { logout } from "../../../services/auth";
import CounterReadingReminder from '../../../shared/ui/CounterReadingReminder/CounterReadingReminder';
import { useCounterReadingReminder } from '../../../shared/lib/hooks/useCounterReadingReminder';

const SCROLL_SOLID_AT = 12;

const Navbar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
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

    const isAdmin = userData?.role === 'администратор';
    const isDirector = userData?.role === 'руководитель';
    const isPrinter = userData?.role === 'печатник';

    return (
        <div className={classNames(cls.navbar, scrolled && cls.scrolled)}>
            <div className={cls.navLinks}>
                <Link
                    className={`${cls.button} ${location.pathname === "/" ? cls.active : ""}`}
                    to={"/"}
                >
                    <Button name={'СКЛАД'} />
                </Link>
                {(isDirector || isAdmin || isPrinter) && (
                    <Link
                        className={`${cls.button} ${
                            location.pathname === '/journal' ||
                            location.pathname === '/toner' ||
                            location.pathname === '/schedule'
                                ? cls.active
                                : ''
                        }`}
                        to={'/journal'}
                    >
                        <Button name={'ЖУРНАЛ УЧЁТА'} />
                    </Link>
                )}
                {(isDirector || isAdmin) && (
                    <Link
                        className={`${cls.button} ${location.pathname === "/analytics" ? cls.active : ""}`}
                        to={"/analytics"}
                    >
                        <Button name={'АНАЛИТИКА'} />
                    </Link>
                )}
                <Link
                    className={`${cls.button} ${location.pathname === "/calculator" ? cls.active : ""}`}
                    to={"/calculator"}
                >
                    <Button name={'КАЛЬКУЛЯТОР'} />
                </Link>
                <Link
                    className={`${cls.button} ${location.pathname === "/rotation" ? cls.active : ""}`}
                    to={"/rotation"}
                >
                    <Button name={'РОТАЦИЯ'} />
                </Link>
                <Link
                    className={`${cls.button} ${location.pathname === "/manuals" ? cls.active : ""}`}
                    to={"/manuals"}
                >
                    <Button name={'СЕРВИС ИНСТРУКЦИИ'} />
                </Link>
                {/* Отображаем кнопку админ-панели только для администраторов */}
                {isAdmin && (
                    <Link
                        className={`${cls.button} ${location.pathname === "/admin" ? cls.active : ""}`}
                        to={"/admin"}
                    >
                        <Button name={'АДМИНИСТРИРОВАНИЕ'} />
                    </Link>
                )}
                {(isAdmin || isDirector || isPrinter) && <CounterReadingReminder />}
            </div>
            <div className={cls.rightSection}>
                {user && (
                    <div className={cls.userInfo}>
                        <div className={cls.userInfoContent}>
                            <span className={cls.name}>{user.displayName}</span>
                            {userData && <span className={cls.role}>{userData.role}</span>}
                        </div>
                        <button onClick={handleLogout} className={cls.logoutButton}>
                            Выйти
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Navbar;
