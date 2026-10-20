import { expect, test } from '@playwright/test';

test.describe('Warehouse (parts stock)', () => {
    test('main page loads stock header', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByPlaceholder('Артикул или название…')).toBeVisible({
            timeout: 30_000,
        });
    });

    test('can expand FIFO panel on first part row', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByPlaceholder('Артикул или название…')).toBeVisible({
            timeout: 30_000,
        });

        const expandRow = page
            .getByRole('button', {
                name: /Показать партии FIFO/i,
            })
            .first();

        const hasRow = await expandRow.isVisible().catch(() => false);
        if (!hasRow) {
            test.skip(true, 'No parts in stock for current model — skip FIFO UI');
        }

        await expandRow.click();

        await expect(page.getByText('Партии (FIFO)')).toBeVisible();
        await expect(
            page.getByText(/Следующее списание возьмёт товар/i)
        ).toBeVisible();
    });

    test('purchase modal opens from sidebar action', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByPlaceholder('Артикул или название…')).toBeVisible({
            timeout: 30_000,
        });

        const purchaseBtn = page.getByRole('button', { name: 'Приход' }).first();
        await expect(purchaseBtn).toBeVisible();
        await purchaseBtn.click();

        await expect(
            page.getByRole('heading', { name: 'Приход деталей' })
        ).toBeVisible();
        await expect(
            page.getByPlaceholder('Артикул или название')
        ).toBeVisible();
    });
});
