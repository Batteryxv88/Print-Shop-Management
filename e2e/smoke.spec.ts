import { expect, test } from '@playwright/test';

test.describe('Public smoke', () => {
    test('login page renders form', async ({ page }) => {
        await page.goto('/login');

        await expect(
            page.getByRole('heading', { name: 'Вход в систему' })
        ).toBeVisible();
        await expect(page.locator('#email')).toBeVisible();
        await expect(page.locator('#password')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Войти' })).toBeEnabled();
    });

    test('unauthenticated user is redirected to login from home', async ({
        page,
    }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/login/);
    });
});
