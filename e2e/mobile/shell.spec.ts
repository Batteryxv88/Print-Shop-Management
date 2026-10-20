import { expect, test } from '@playwright/test';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@mobile App shell', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('opens drawer and navigates to journal', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByPlaceholder('Артикул или название…')).toBeVisible({
            timeout: 30_000,
        });

        await page.getByTestId('nav-menu-toggle').click();
        await expect(page.getByTestId('mobile-primary-nav')).toBeVisible();
        await page
            .getByTestId('mobile-primary-nav')
            .getByRole('button', { name: 'ЖУРНАЛ УЧЁТА' })
            .click();

        await expect(page).toHaveURL(/\/journal/);
        await expect(page.getByTestId('app-sidebar')).toHaveAttribute(
            'data-open',
            'false'
        );
    });

    test('main content has no horizontal document scroll', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByTestId('nav-menu-toggle')).toBeVisible({
            timeout: 30_000,
        });

        const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth
        );
        const clientWidth = await page.evaluate(
            () => document.documentElement.clientWidth
        );
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
});
