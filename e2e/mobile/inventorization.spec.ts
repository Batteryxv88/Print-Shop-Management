import { expect, test } from '@playwright/test';

import { expectNoHorizontalDocumentScroll } from '../helpers/layout';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

async function openPartsInventorization(page: import('@playwright/test').Page) {
    await page.goto('/');
    await expect(page.getByTestId('stock-root')).toBeVisible({
        timeout: 30_000,
    });

    const invBtn = page.getByTestId('inventory-open-parts');
    if (!(await invBtn.isVisible())) {
        test.skip(true, 'Inventorization not available for this role');
    }
    await invBtn.click();
    await expect(page.getByTestId('inventorization-root')).toBeVisible({
        timeout: 15_000,
    });
    await expect(page.getByTestId('inventorization-root')).toHaveAttribute(
        'data-inventory-kind',
        'part'
    );
}

test.describe('@mobile Parts inventorization', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('scan input visible on phone', async ({ page }) => {
        await openPartsInventorization(page);
        await expect(
            page.getByTestId('inventorization-scan-input')
        ).toBeVisible();
    });

    test('no horizontal document scroll', async ({ page }) => {
        await openPartsInventorization(page);
        await expectNoHorizontalDocumentScroll(page);
    });

    test('legacy /inventorization URL opens parts inventory on stock', async ({
        page,
    }) => {
        await page.goto('/inventorization');
        await expect(page).toHaveURL('/');
        await expect(page.getByTestId('inventorization-root')).toBeVisible({
            timeout: 30_000,
        });
    });
});
