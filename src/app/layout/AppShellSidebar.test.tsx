import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import uiReducer from '../providers/StoreProvider/Store/UiSlice';
import { AppShellSidebar } from './AppShellSidebar';

vi.mock('../../widgets/Sidebar/ui/Sidebar', () => ({
    default: () => <div data-testid="context-sidebar-mock">Sidebar</div>,
}));

vi.mock('./PrimaryNavLinks', () => ({
    PrimaryNavLinks: () => (
        <div data-testid="primary-nav-mock">Nav</div>
    ),
}));

const renderShell = (sidebarOpen = false) => {
    const store = configureStore({
        reducer: { ui: uiReducer },
        preloadedState: { ui: { sidebarOpen } },
    });

    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={['/']}>
                <AppShellSidebar />
            </MemoryRouter>
        </Provider>
    );
};

describe('AppShellSidebar', () => {
    it('reflects open state on app-sidebar', () => {
        renderShell(true);
        expect(screen.getByTestId('app-sidebar')).toHaveAttribute(
            'data-open',
            'true'
        );
    });

    it('closes when backdrop is clicked', async () => {
        const user = userEvent.setup();
        renderShell(true);

        await user.click(screen.getByTestId('sidebar-backdrop'));
        expect(screen.getByTestId('app-sidebar')).toHaveAttribute(
            'data-open',
            'false'
        );
    });
});
