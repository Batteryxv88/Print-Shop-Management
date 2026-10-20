import { expect, test } from '@playwright/test';

import { expectNoHorizontalDocumentScroll } from '../helpers/layout';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@tablet Parts inventorization', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('inventory button next to purchase on parts section', async ({
        page,
    }) => {
        await page.goto('/');
        await page.getByTestId('storage-parts').click();
        const invBtn = page.getByTestId('inventory-open-parts');
        if (!(await invBtn.isVisible({ timeout: 30_000 }))) {
            test.skip(true, 'Inventorization not available for this role');
        }
        await invBtn.click();
        await expect(page.getByTestId('inventorization-root')).toBeVisible({
            timeout: 15_000,
        });
        await expect(
            page.getByTestId('inventorization-scan-input')
        ).toBeVisible();
        await expectNoHorizontalDocumentScroll(page);
    });
});
