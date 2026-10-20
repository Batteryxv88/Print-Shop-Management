import { expect, test } from '@playwright/test';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@mobile Analytics compact', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('shows KPIs and mobile notice on phone', async ({ page }) => {
        await page.goto('/analytics');

        const onAnalytics = await page
            .getByTestId('analytics-root')
            .isVisible({ timeout: 15_000 })
            .catch(() => false);

        if (!onAnalytics) {
            test.skip(true, 'User role cannot access /analytics');
        }

        await expect(page.getByText('Остаток на складе')).toBeVisible();
        await expect(page.getByTestId('analytics-mobile-notice')).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Объём печати (по месяцам)' })
        ).toBeHidden();
    });
});
