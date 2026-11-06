import cls from './SidebarRotationSkeleton.module.scss';

const SidebarRotationSkeleton = () => (
    <>
        {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={cls.skeletonItem} />
        ))}
    </>
);

export default SidebarRotationSkeleton;
