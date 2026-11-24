import { useEffect, useState } from 'react';
import cls from './MainPageButtonsBar.module.scss';
import PurchaseStock from '../../../features/ui/PurchaseStock/PurchaseStock';
import { useOrderList } from '../../../shared/lib/hooks/useOrderList';
import { exportOrderListToExcel, setNotificationCallback } from '../../../shared/lib/utils/exportOrderList';
import { useQuantityToOrderLive } from '../../../shared/lib/hooks/useQuantityToOrder';
import NotificationModal from '../../../shared/ui/NotificationModal/NotificationModal';

const MainPageButtonsBar = () => {
    useQuantityToOrderLive();
    const { orderList } = useOrderList();
    
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'info' | 'warning' | 'error' | 'success';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });
    
    useEffect(() => {
        setNotificationCallback((title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
            setNotification({
                isOpen: true,
                title,
                message,
                type
            });
        });
    }, []);

    const handleOrderExport = () => {
        void exportOrderListToExcel(orderList);
    };

    const handleCloseNotification = () => {
        setNotification(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <>
            <div className={cls.MainPageButtonsBar}>
                <PurchaseStock type="part" />
                <button className={cls.button}><span className={cls.buttonText}>Аудит</span></button>
                <button className={cls.button} onClick={handleOrderExport}>
                    <span className={cls.buttonText}>Заказ деталей</span>
                </button>
            </div>
            
            <NotificationModal
                isOpen={notification.isOpen}
                onClose={handleCloseNotification}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </>
    );
};

export default MainPageButtonsBar;
