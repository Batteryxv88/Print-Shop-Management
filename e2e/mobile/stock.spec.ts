import { expect, test } from '@playwright/test';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@mobile Stock pilot', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('search and expand FIFO panel on a part row', async ({ page }) => {
        await page.goto('/');

        const search = page.getByTestId('stock-search');
        await expect(search).toBeVisible({ timeout: 30_000 });

        await expect(page.getByTestId('stock-root')).toBeVisible();

        const expandRow = page
            .getByRole('button', {
                name: /Показать партии FIFO/i,
            })
            .first();

        const hasRow = await expandRow.isVisible().catch(() => false);
        if (!hasRow) {
            test.skip(true, 'No parts in stock for current model');
        }

        await expandRow.click();

        await expect(page.getByText('Партии (FIFO)')).toBeVisible();
    });

    test('purchase modal opens as bottom sheet layout on mobile', async ({
        page,
    }) => {
        await page.goto('/');

        await expect(page.getByTestId('stock-search')).toBeVisible({
            timeout: 30_000,
        });

        const purchaseBtn = page.getByRole('button', { name: 'Приход' }).first();
        await expect(purchaseBtn).toBeVisible();
        await purchaseBtn.click();

        const heading = page.getByRole('heading', { name: 'Приход деталей' });
        await expect(heading).toBeVisible();

        const box = await heading.boundingBox();
        const viewport = page.viewportSize();
        if (box && viewport) {
            expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
        }
    });
});
