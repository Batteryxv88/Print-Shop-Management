import classNames from 'classnames';
import DeleteBinIcon from '../../assets/icon/delete-bin.svg';
import cls from './DeleteButton.module.scss';

type Props = {
    onClick: () => void;
    /** Подсказка и aria-label */
    label?: string;
    /** sm — для чипов/тегов, md — для строк списков */
    size?: 'sm' | 'md';
    disabled?: boolean;
    className?: string;
};

const DeleteButton = ({
    onClick,
    label = 'Удалить',
    size = 'md',
    disabled,
    className,
}: Props) => (
    <button
        type="button"
        className={classNames(
            cls.button,
            size === 'sm' && cls.sm,
            className
        )}
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        aria-label={label}
        title={label}
        disabled={disabled}
    >
        <DeleteBinIcon className={cls.icon} />
    </button>
);

export default DeleteButton;
