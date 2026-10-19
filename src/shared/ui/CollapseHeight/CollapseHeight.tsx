import {
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import cls from './CollapseHeight.module.scss';

type CollapseHeightProps = {
    open: boolean;
    children: ReactNode;
    className?: string;
};

const CollapseHeight = ({ open, children, className }: CollapseHeightProps) => {
    const innerRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);

    useLayoutEffect(() => {
        const node = innerRef.current;
        if (!node || !open) {
            setHeight(0);
            return;
        }

        const measure = () => {
            setHeight(node.scrollHeight);
        };

        measure();

        const ro = new ResizeObserver(measure);
        ro.observe(node);

        return () => ro.disconnect();
    }, [open]);

    const rootClass = [
        cls.root,
        open ? cls.open : '',
        className ?? '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={rootClass}
            style={{ maxHeight: open ? height : 0 }}
            aria-hidden={!open}
        >
            <div ref={innerRef}>{children}</div>
        </div>
    );
};

export default CollapseHeight;
