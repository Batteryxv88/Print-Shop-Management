import { expect, test } from '@playwright/test';

import { expectNoHorizontalDocumentScroll } from '../helpers/layout';

const hasAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

test.describe('@tablet Journal', () => {
    test.skip(!hasAuth, 'Requires E2E_EMAIL and E2E_PASSWORD');

    test('journal and counter reading form on tablet viewport', async ({
        page,
    }) => {
        await page.goto('/journal');

        await expect(page.getByTestId('journal-root')).toBeVisible({
            timeout: 30_000,
        });

        await page.getByTestId('journal-kind-counters').click();
        await expect(page.getByTestId('counter-reading-form')).toBeVisible();
    });

    test('no horizontal document scroll on journal', async ({ page }) => {
        await page.goto('/journal');

        await expect(page.getByTestId('journal-root')).toBeVisible({
            timeout: 30_000,
        });
        await expectNoHorizontalDocumentScroll(page);
    });
});
