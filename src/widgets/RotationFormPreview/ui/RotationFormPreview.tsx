import { useState, useEffect } from 'react';
import cls from './RotationFormPreview.module.scss';
import { RootState } from '../../../app/providers/StoreProvider/Store';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../../../app/providers/StoreProvider/Store/hooks';
import { setSelectedFormId } from '../../../app/providers/StoreProvider/Store/SelectedFormSlice';
import {
    FIGURED_DOG_FACE,
    FIGURED_DOG_MOUTH,
    FIGURED_LABEL_PATH,
    previewBorderRadius,
    previewOutline,
} from '../../../shared/lib/rotation/previewOutline';
import { streamLayout } from '../../../shared/lib/rotation/streamLayout';

const RotationFormPreview = () => {
    const dispatch = useAppDispatch();
    const rotationForms = useSelector((state: RootState) => state.rotationForms.rotationForms);
    const selectedFormId = useSelector((state: RootState) => state.selectedForm.selectedFormId);
    
    // Sort forms by width then height to match RotationFormTable
    const sortedForms = [...rotationForms].sort((a, b) => {
        if (a.width !== b.width) {
            return a.width - b.width;
        }
        return a.height - b.height;
    });

    // If no form is selected yet, default to the first one
    useEffect(() => {
        if (!selectedFormId && sortedForms.length > 0) {
            dispatch(setSelectedFormId(sortedForms[0].id));
        }
    }, [selectedFormId, rotationForms, dispatch]);

    const selectedItem = rotationForms.find(item => item.id === selectedFormId) ||
                        (sortedForms.length > 0 ? sortedForms[0] : null);

    // Add navigation logic for previous/next functionality
    const currentIndex = sortedForms.findIndex(item => item.id === selectedFormId);
    const prevForm = currentIndex > 0 ? sortedForms[currentIndex - 1] : null;
    const nextForm = currentIndex >= 0 && currentIndex < sortedForms.length - 1 ? sortedForms[currentIndex + 1] : null;
    const handlePrev = () => { if (prevForm) dispatch(setSelectedFormId(prevForm.id)); };
    const handleNext = () => { if (nextForm) dispatch(setSelectedFormId(nextForm.id)); };

    // SVG icons for navigation arrows
    const arrowLeftIcon = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    );
    const arrowRightIcon = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );

    if (!selectedItem) {
        return <div>Элемент не найден</div>;
    }
    
    // Реальные размеры формы в мм
    const FORM_WIDTH_MM = 284;
    const FORM_HEIGHT_MM = 478;
    
    // Междуэтикеточное расстояние в мм
    const GAP_SIZE_MM = 3;
    
    const { across, along } = streamLayout(
        Number(selectedItem.width),
        Number(selectedItem.height),
        Number(selectedItem.size_for_column)
    );

    // Ширина ручья = «W к ручью», высота ряда = другая сторона этикетки
    const gridFullWidthMM = (selectedItem.columns * across) + (GAP_SIZE_MM * (selectedItem.columns - 1));
    const gridFullHeightMM = (selectedItem.rows * along) + (GAP_SIZE_MM * (selectedItem.rows - 1));
    
    // Проверяем, превышает ли сетка доступный размер формы
    const isOverflowWidth = gridFullWidthMM > FORM_WIDTH_MM;
    const isOverflowHeight = gridFullHeightMM > FORM_HEIGHT_MM;
    
    // Вычисляем масштаб, если сетка не помещается в форму
    const scaleX = isOverflowWidth ? FORM_WIDTH_MM / gridFullWidthMM : 1;
    const scaleY = isOverflowHeight ? FORM_HEIGHT_MM / gridFullHeightMM : 1;
    const scale = Math.min(scaleX, scaleY);
    
    // Для случаев, когда масштаб меньше 1, предупреждаем пользователя
    const showScaleWarning = scale < 1;
    
    // Используем фиксированное значение отступа в 3мм
    const gapSizeMM = GAP_SIZE_MM;
    // Преобразуем его в проценты от размера формы для CSS
    const gapSizePercent = (gapSizeMM / Math.max(FORM_WIDTH_MM, FORM_HEIGHT_MM)) * 100 * scale;
    
    // Общая ширина и высота сетки с учетом масштаба
    const totalGridWidthPercent = Math.min(95, (gridFullWidthMM / FORM_WIDTH_MM) * 100 * scale);
    const totalGridHeightPercent = Math.min(95, (gridFullHeightMM / FORM_HEIGHT_MM) * 100 * scale);

    
    // Стили для сетки с учетом реальных размеров и отступов
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: `repeat(${selectedItem.columns}, 1fr)`,
        gridTemplateRows: `repeat(${selectedItem.rows}, 1fr)`,
        gap: `${gapSizePercent}%`,
        width: `${totalGridWidthPercent - 5}%`,
        height: `${totalGridHeightPercent - 5}%`,
        alignItems: 'flex-start',
        justifyContent: 'center',
    };
    
    const labelOutline = previewOutline(
        String(selectedItem.shape ?? ''),
        Number(selectedItem.width),
        Number(selectedItem.height)
    );
    const labelRadius = previewBorderRadius(labelOutline);

    // Функция для отображения ячейки с информацией с точным отражением междуэтикеточных расстояний
    const calculateWidthAndHeight = (content?: string | number, isSmallText = false) => {
        const textStyle = {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: 'rgba(255, 255, 255, 0.87)',
            fontSize: isSmallText ? '10px' : '14px',
            lineHeight: isSmallText ? '10px' : '14px',
            fontWeight: 'bold' as const,
            textAlign: 'center' as const,
            whiteSpace: 'pre-wrap' as const,
            wordBreak: 'break-word' as const,
            padding: isSmallText ? '2px' : '0',
            boxSizing: 'border-box' as const,
        };

        if (labelOutline === 'figured') {
            return (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                        }}
                    >
                        <path
                            d={FIGURED_LABEL_PATH}
                            fill="#2A2A2A"
                            stroke="#BB86FC"
                            strokeWidth="2"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                        <path d={FIGURED_DOG_FACE} fill="#BB86FC" />
                        <path
                            d={FIGURED_DOG_MOUTH}
                            fill="none"
                            stroke="#BB86FC"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    </svg>
                    <div style={{ ...textStyle, position: 'relative' }}>{content}</div>
                </div>
            );
        }

        return (
            <div
                style={{
                    ...textStyle,
                    border: '2px solid #BB86FC',
                    borderRadius: labelRadius,
                    background: '#2A2A2A',
                }}
            >
                {content}
            </div>
        );
    };
    
    return (
        <div className={cls.gridContainer} data-testid="rotation-preview-root">
            <div className={cls.content}>
                <div className={cls.leftColumn}>
                    <div className={`${cls.selectContainer} ${cls.navControls}`}>
                        <button onClick={handlePrev} disabled={!prevForm} className={cls.navButton}>
                            {arrowLeftIcon}
                        </button>
                        <select
                            value={selectedFormId || ''}
                            onChange={(e) => dispatch(setSelectedFormId(e.target.value))}
                            className={cls.select}
                        >
                            {sortedForms.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.width}×{item.height}, Ручьи: {item.columns}, Ряды: {item.rows}
                                </option>
                            ))}
                        </select>
                        <button onClick={handleNext} disabled={!nextForm} className={cls.navButton}>
                            {arrowRightIcon}
                        </button>
                    </div>
                    
                    <div className={cls.formDetails}>
                        <div className={cls.formDetailItem}>
                            <span className={cls.label}>Размер этикетки:</span>
                            <span className={cls.value}>{selectedItem.width} × {selectedItem.height} мм</span>
                        </div>
                        <div className={cls.formDetailItem}>
                            <span className={cls.label}>Ручьи (колонки):</span>
                            <span className={cls.value}>{selectedItem.columns}</span>
                        </div>
                        <div className={cls.formDetailItem}>
                            <span className={cls.label}>Ряды:</span>
                            <span className={cls.value}>{selectedItem.rows}</span>
                        </div>
                        <div className={cls.formDetailItem}>
                            <span className={cls.label}>Всего мест:</span>
                            <span className={cls.value}>{selectedItem.columns * selectedItem.rows}</span>
                        </div>
                        <div className={cls.formDetailItem}>
                            <span className={cls.label}>Размер формы:</span>
                            <span className={cls.value}>{FORM_WIDTH_MM} × {FORM_HEIGHT_MM} мм</span>
                        </div>
                    </div>
                </div>
                
                <div className={cls.rightColumn}>
                    <div className={cls.gridBox}>
                        <div
                            className={cls.grid}
                            style={gridStyle}
                        >
                            {[...Array(selectedItem.rows)].map((_, rowIndex) => (
                                [...Array(selectedItem.columns)].map((_, colIndex) => {
                                    const isTopRow = rowIndex === 0;
                                    const isLeftColumn = colIndex === 0;
                                    const isBottomRight = rowIndex === selectedItem.rows - 1 && colIndex === selectedItem.columns - 1;

                                    return (
                                        <div 
                                            key={`${rowIndex}-${colIndex}`} 
                                            style={{ 
                                                width: '100%', 
                                                height: '100%',
                                                aspectRatio: `${across} / ${along}`
                                            }}
                                        >
                                            {isTopRow
                                                ? calculateWidthAndHeight(colIndex + 1) // Номера столбцов
                                                : isLeftColumn
                                                    ? calculateWidthAndHeight(rowIndex + 1) // Номера строк
                                                    : isBottomRight
                                                        ? calculateWidthAndHeight(`${selectedItem.width} × ${selectedItem.height}`, true) // Размер в нижней правой ячейке (с меньшим шрифтом)
                                                        : calculateWidthAndHeight() // Обычная ячейка
                                            }
                                        </div>
                                    );
                                })
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RotationFormPreview;