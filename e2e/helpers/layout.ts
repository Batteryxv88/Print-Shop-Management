import { expect, type Page } from '@playwright/test';

/** Document should not scroll horizontally (±1px for subpixel rounding). */
export async function expectNoHorizontalDocumentScroll(page: Page) {
    const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
        () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}
