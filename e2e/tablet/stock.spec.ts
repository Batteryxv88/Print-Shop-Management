import { expect, test } from '@playwright/test';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@tablet Stock sections', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('inline sidebar and toners storage', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByTestId('nav-menu-toggle')).toBeHidden({
            timeout: 30_000,
        });
        await expect(page.getByTestId('app-sidebar')).toBeVisible();

        const tonersTab = page.getByTestId('storage-toners');
        await expect(tonersTab).toBeVisible();
        await tonersTab.click();

        await expect(page.getByTestId('toners-storage-root')).toBeVisible();
        await expect(page.getByTestId('toners-search')).toBeVisible();
    });

    test('paper and lamination sections when enabled', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByTestId('app-sidebar')).toBeVisible({
            timeout: 30_000,
        });

        const paperTab = page.getByTestId('storage-paper');
        if (await paperTab.isVisible().catch(() => false)) {
            await paperTab.click();
            await expect(page.getByTestId('paper-stock-root')).toBeVisible();
        }

        const lamTab = page.getByTestId('storage-lamination');
        if (await lamTab.isVisible().catch(() => false)) {
            await lamTab.click();
            await expect(page.getByTestId('lamination-stock-root')).toBeVisible();
        }
    });

    test('main content has no horizontal document scroll', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByTestId('storage-parts')).toBeVisible({
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
