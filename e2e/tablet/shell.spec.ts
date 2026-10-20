import { expect, test } from '@playwright/test';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@tablet App shell', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('sidebar visible without hamburger menu', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByPlaceholder('Артикул или название…')).toBeVisible({
            timeout: 30_000,
        });

        await expect(page.getByTestId('app-sidebar')).toBeVisible();
        await expect(page.getByTestId('nav-menu-toggle')).toBeHidden();
        await expect(page.getByTestId('mobile-primary-nav')).toBeHidden();
    });
});
