import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

const hasE2EAuth = Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim()
);

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: `npm run start -- --env port=${port}`,
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          },
    projects: [
        ...(hasE2EAuth
            ? [
                  {
                      name: 'setup',
                      testMatch: /auth\.setup\.ts/,
                  },
                  {
                      name: 'chromium-authenticated',
                      testMatch: /authenticated\.spec\.ts/,
                      dependencies: ['setup'],
                      use: {
                          ...devices['Desktop Chrome'],
                          storageState: 'e2e/.auth/user.json',
                      },
                  },
              ]
            : []),
        {
            name: 'chromium-smoke',
            testMatch: '**/*.spec.ts',
            testIgnore: ['**/mobile/**', '**/tablet/**', '**/authenticated.spec.ts'],
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-chrome',
            testMatch: 'mobile/**/*.spec.ts',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'tablet-chrome',
            testMatch: 'tablet/**/*.spec.ts',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 768, height: 1024 },
                isMobile: true,
                hasTouch: true,
            },
        },
    ],
});
