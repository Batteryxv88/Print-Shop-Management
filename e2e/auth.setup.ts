import { expect, test as setup } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
    const email = process.env.E2E_EMAIL?.trim();
    const password = process.env.E2E_PASSWORD;

    await page.goto('/login');
    await page.locator('#email').fill(email!);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).not.toHaveURL(/\/login$/);
    await page.context().storageState({ path: authFile });
});
