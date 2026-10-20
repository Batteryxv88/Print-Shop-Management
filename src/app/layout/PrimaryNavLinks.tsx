import { Link, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import Button from '../../shared/ui/Button/Button';
import CounterReadingReminder from '../../shared/ui/CounterReadingReminder/CounterReadingReminder';
import { useAuth } from '../../contexts/AuthContext';

export type PrimaryNavLinksProps = {
    className?: string;
    linkClassName?: string;
    activeClassName?: string;
    onLinkClick?: () => void;
    showCounterReminder?: boolean;
};

export const PrimaryNavLinks = ({
    className,
    linkClassName,
    activeClassName = '',
    onLinkClick,
    showCounterReminder = true,
}: PrimaryNavLinksProps) => {
    const location = useLocation();
    const { userData } = useAuth();

    const isAdmin = userData?.role === 'администратор';
    const isDirector = userData?.role === 'руководитель';
    const isPrinter = userData?.role === 'печатник';

    const linkClass = (active: boolean) =>
        classNames(linkClassName, active && activeClassName);

    return (
        <nav className={className} aria-label="Основные разделы">
            <Link
                className={linkClass(location.pathname === '/')}
                to="/"
                onClick={onLinkClick}
            >
                <Button name="СКЛАД" />
            </Link>
            {(isDirector || isAdmin || isPrinter) && (
                <Link
                    className={linkClass(
                        location.pathname === '/journal' ||
                            location.pathname === '/toner' ||
                            location.pathname === '/schedule'
                    )}
                    to="/journal"
                    onClick={onLinkClick}
                >
                    <Button name="ЖУРНАЛ УЧЁТА" />
                </Link>
            )}
            {(isDirector || isAdmin) && (
                <Link
                    className={linkClass(location.pathname === '/analytics')}
                    to="/analytics"
                    onClick={onLinkClick}
                >
                    <Button name="АНАЛИТИКА" />
                </Link>
            )}
            <Link
                className={linkClass(location.pathname === '/calculator')}
                to="/calculator"
                onClick={onLinkClick}
            >
                <Button name="КАЛЬКУЛЯТОР" />
            </Link>
            <Link
                className={linkClass(location.pathname === '/rotation')}
                to="/rotation"
                onClick={onLinkClick}
            >
                <Button name="РОТАЦИЯ" />
            </Link>
            <Link
                className={linkClass(location.pathname === '/manuals')}
                to="/manuals"
                onClick={onLinkClick}
            >
                <Button name="СЕРВИС ИНСТРУКЦИИ" />
            </Link>
            {isAdmin && (
                <Link
                    className={linkClass(location.pathname === '/admin')}
                    to="/admin"
                    onClick={onLinkClick}
                >
                    <Button name="АДМИНИСТРИРОВАНИЕ" />
                </Link>
            )}
            {showCounterReminder && (isAdmin || isDirector || isPrinter) && (
                <CounterReadingReminder />
            )}
        </nav>
    );
};
