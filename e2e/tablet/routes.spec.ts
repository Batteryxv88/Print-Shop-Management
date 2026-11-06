import { expect, test } from '@playwright/test';

import { expectNoHorizontalDocumentScroll } from '../helpers/layout';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@tablet Primary routes layout', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('stock and calculator — no horizontal scroll', async ({ page }) => {
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
    });
});
