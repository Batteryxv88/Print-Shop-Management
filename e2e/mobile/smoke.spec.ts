import { expect, test } from '@playwright/test';

/**
 * @mobile Public smoke on phone viewport (Phase 0).
 */
test.describe('@mobile Public smoke', () => {
    test('login form fits viewport without horizontal scroll', async ({ page }) => {
        await page.goto('/login');

        await expect(
            page.getByRole('heading', { name: 'Вход в систему' })
        ).toBeVisible();

        const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth
        );
        const clientWidth = await page.evaluate(
            () => document.documentElement.clientWidth
        );
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test('unauthenticated user is redirected to login from home', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });
});
