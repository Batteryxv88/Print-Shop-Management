import { expect, test } from '@playwright/test';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@mobile Journal field flows', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('journal page and counter reading form render on phone', async ({
        page,
    }) => {
        await page.goto('/journal');

        await expect(page.getByTestId('journal-root')).toBeVisible({
            timeout: 30_000,
        });

        await page.getByTestId('nav-menu-toggle').click();
        await expect(page.getByTestId('app-sidebar')).toHaveAttribute(
            'data-open',
            'true'
        );
        await page.getByTestId('journal-kind-counters').click();

        await expect(page.getByTestId('counter-reading-form')).toBeVisible();
    });

    test('journal has no horizontal document scroll', async ({ page }) => {
        await page.goto('/journal');

        await expect(page.getByTestId('journal-root')).toBeVisible({
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
