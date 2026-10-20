import { expect, test } from '@playwright/test';

import { expectNoHorizontalDocumentScroll } from '../helpers/layout';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@mobile Primary routes layout', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('stock, calculator, journal — no horizontal scroll', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page.getByTestId('stock-root')).toBeVisible({
            timeout: 30_000,
        });
        await expectNoHorizontalDocumentScroll(page);

        await page.goto('/calculator');
        await expect(page.getByTestId('calculator-root')).toBeVisible({
            timeout: 30_000,
        });
        await expectNoHorizontalDocumentScroll(page);

        await page.goto('/journal');
        await expect(page.getByTestId('journal-root')).toBeVisible({
            timeout: 30_000,
        });
        await expectNoHorizontalDocumentScroll(page);

        const invBtn = page.getByTestId('inventory-open-parts');
        if (await invBtn.isVisible().catch(() => false)) {
            await invBtn.click();
            await expect(page.getByTestId('inventorization-root')).toBeVisible({
                timeout: 15_000,
            });
            await expectNoHorizontalDocumentScroll(page);
        }
    });

    test('holders section — no horizontal scroll', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('stock-root')).toBeVisible({
            timeout: 30_000,
        });

        const holdersTab = page.getByTestId('storage-holders');
        if (!(await holdersTab.isVisible())) {
            test.skip(true, 'Holders section not available for this role');
        }

        await holdersTab.click();
        await expect(page.getByTestId('holders-stock-root')).toBeVisible({
            timeout: 15_000,
        });
        await expectNoHorizontalDocumentScroll(page);
    });
});
